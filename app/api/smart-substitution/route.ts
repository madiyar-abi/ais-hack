import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'edge';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ============================================================
// AFFINITY GROUPS — Compatibility Matrix
// ============================================================
const AFFINITY_GROUPS: Record<string, string> = {
  // ФИЗМАТ
  'алгебра': 'ФИЗМАТ', 'геометрия': 'ФИЗМАТ', 'физика': 'ФИЗМАТ', 'информатика': 'ФИЗМАТ',
  // ХИМБИО
  'химия': 'ХИМБИО', 'биология': 'ХИМБИО', 'естествознание': 'ХИМБИО', 'география': 'ХИМБИО',
  // ГУМ
  'қазақ тілі': 'ГУМ', 'орыс тілі мен әдебиеті': 'ГУМ', 'ағылшын тілі': 'ГУМ',
  'ielts': 'ГУМ', 'қазақстан тарихы': 'ГУМ', 'история': 'ГУМ', 'обществознание': 'ГУМ',
  // ПРОЧЕЕ — 200 штрафа для академических замен
  'дене тәрбиесі': 'ПРОЧЕЕ', 'көркем еңбек': 'ПРОЧЕЕ', 'аәд': 'ПРОЧЕЕ',
  'музыка': 'ПРОЧЕЕ', 'профориентация': 'ПРОЧЕЕ', 'психология': 'ПРОЧЕЕ',
  // НЕЙТРАЛЬНЫЙ ПЕРСОНАЛ — технические, не педагогические
  'слесарь': 'ТЕХПЕРСОНАЛ', 'техник': 'ТЕХПЕРСОНАЛ', 'завхоз': 'ТЕХПЕРСОНАЛ',
  'охранник': 'ТЕХПЕРСОНАЛ', 'уборщица': 'ТЕХПЕРСОНАЛ',
};

// ============================================================
// PENALTY CALCULATOR — pure deterministic math
// ============================================================

function getAffinityGroup(subject: string): string {
  const s = subject?.toLowerCase().trim() || '';
  if (!s) return 'ДРУГОЕ';

  // Substring matching for non-teaching and admin staff
  if (s.includes('слесарь') || s.includes('техник') || s.includes('завхоз') || s.includes('охранник') || s.includes('уборщица') || s.includes('админ') || s.includes('завуч') || s.includes('директор') || s.includes('психолог') || s.includes('социал')) {
    return 'ТЕХПЕРСОНАЛ'; // Mark them as tech staff so the router entirely drops them from academic substitutions
  }

  // Substring matching for academic groups (Handles "Учитель математики", "Английский язык" etc.)
  if (s.includes('математ') || s.includes('алгебр') || s.includes('геометр') || s.includes('физик') || s.includes('информатик')) {
    return 'ФИЗМАТ';
  }
  if (s.includes('хими') || s.includes('биолог') || s.includes('естество') || s.includes('географ')) {
    return 'ХИМБИО';
  }
  if (s.includes('қазақ') || s.includes('казах') || s.includes('орыс') || s.includes('русск') || s.includes('ағылш') || s.includes('английск') || s.includes('ielts') || s.includes('тарих') || s.includes('истор') || s.includes('общество') || s.includes('әдебиет') || s.includes('литератур')) {
    return 'ГУМ';
  }
  if (s.includes('дене') || s.includes('физкультур') || s.includes('көркем') || s.includes('труд') || s.includes('аәд') || s.includes('музык')) {
    return 'ПРОЧЕЕ';
  }
  
  return AFFINITY_GROUPS[s] || 'ДРУГОЕ';
}

function subjectPenalty(teacherSubject: string, absentSubject: string): number {
  const ts = teacherSubject?.toLowerCase().trim() || '';
  const abs = absentSubject?.toLowerCase().trim() || '';
  if (ts === abs && ts !== '') return 0;                             // Exact match
  
  const tg = getAffinityGroup(teacherSubject);
  const ag = getAffinityGroup(absentSubject);
  
  if (tg === 'ТЕХПЕРСОНАЛ') return 500;                              // Non-teacher
  if (tg && ag && tg === ag && tg !== 'ПРОЧЕЕ' && tg !== 'ДРУГОЕ') return 50; // Same group
  return 200;                                                        // Unrelated subject
}

function workloadPenalty(load: number): number {
  if (load <= 4) return 0;
  if (load <= 6) return 25;
  return 999; // RED — forbidden
}

function getZone(load: number): string {
  if (load <= 4) return 'ЗЕЛЕНАЯ';
  if (load <= 6) return 'ОРАНЖЕВАЯ';
  return 'КРАСНАЯ';
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { absent_teacher, sick_lessons, teachers_pool, day_name } = body;
    const absentSubject = absent_teacher.specialty || '';

    // ── Step 1: Score static load for every teacher in the pool ──────────────
    const preScoredPool = teachers_pool.map((t: any) => {
      const wp = workloadPenalty(t.current_load);
      return {
        id: t.id,
        name: t.full_name,
        subject: t.specialty,
        group: getAffinityGroup(t.specialty),
        current_load: t.current_load,
        zone: getZone(t.current_load),
        free_slots: t.free_slots,
        penalty: { subject: 0, workload: wp, total: 0 },
      };
    });

    // ── Step 2: Per-lesson candidate selection ────────────────
    const assignedPerSlot: Record<string, Set<string>> = {};

    const lessonResults = sick_lessons.map((lesson: any) => {
      const slot = lesson.time_slot;
      if (!assignedPerSlot[slot]) {
        assignedPerSlot[slot] = new Set();
      }

      // Dynamically resolve target subject for THIS specific lesson (vital for Mass Substitution)
      const currentAbsentSubject = lesson.absent_specialty || absentSubject || '';
      const currentAbsentGroup = getAffinityGroup(currentAbsentSubject);

      // Map dynamic penalties per lesson, then filter
      const eligible = preScoredPool
        .map((t: any) => {
           const sp = subjectPenalty(t.subject, currentAbsentSubject);
           return {
             ...t,
             penalty: { subject: sp, workload: t.penalty.workload, total: sp + t.penalty.workload }
           };
        })
        .filter((t: any) => {
          if (!t.free_slots.includes(slot)) return false;
          if (t.penalty.workload >= 999) return false;
          if (t.group === 'ТЕХПЕРСОНАЛ') return false;
          if (assignedPerSlot[slot].has(t.id)) return false;
          
          // Strict academic filter: Физруки, Трудовики и АӘД ('ПРОЧЕЕ') не могут заменять ФИЗМАТ, ХИМБИО, ГУМ
          if (['ФИЗМАТ', 'ХИМБИО', 'ГУМ'].includes(currentAbsentGroup) && t.group === 'ПРОЧЕЕ') {
            return false;
          }

          // Strict faculty isolation (Cross-disciplinary ban):
          // English teachers (ГУМ) shouldn't sub for Math (ФИЗМАТ)
          if (['ФИЗМАТ', 'ХИМБИО', 'ГУМ'].includes(currentAbsentGroup)) {
            const ts = t.subject?.toLowerCase().trim() || '';
            const abs = currentAbsentSubject.toLowerCase().trim() || '';
            if (ts !== abs && t.group !== currentAbsentGroup) {
              return false; // Reject cross-faculty
            }
          }
          
          return true;
        })
        .sort((a: any, b: any) => a.penalty.total - b.penalty.total); // lowest penalty first

      const best = eligible[0] || null;
      if (best) {
        assignedPerSlot[slot].add(best.id); // Block this teacher for other parallel lessons
        // Bump their simulated workload penalty for the next assignments
        best.current_load += 1;
        best.penalty.workload = workloadPenalty(best.current_load);
        best.penalty.total = best.penalty.subject + best.penalty.workload;
      }

      // Re-sort alternatives in case penalty was updated, though alternatives are just the remaining ones
      const alternatives = eligible.slice(1, 3);

      return {
        lesson,
        best,
        alternatives,
        noSubstitute: !best,
        isLenta: !!(lesson.class_name?.includes('ЛЕНТА') || lesson.class_name?.includes('лента')),
      };
    });

    // ── Step 3: Ask Gemini only for REASON text (not math) ───
    const reasonRequests = lessonResults
      .filter((lr: any) => lr.best)
      .map((lr: any) => ({
        time_slot: lr.lesson.time_slot,
        class_name: lr.lesson.class_name,
        absent: { name: absent_teacher.full_name, subject: absentSubject },
        chosen: {
          name: lr.best.name, subject: lr.best.subject, zone: lr.best.zone,
          penalty_subject: lr.best.penalty.subject,
          penalty_workload: lr.best.penalty.workload,
          penalty_total: lr.best.penalty.total,
          group: lr.best.group,
        },
        alternatives_summary: lr.alternatives.map((a: any) =>
          `${a.name} (${a.subject}, штраф=${a.penalty.total})`
        ).join('; ') || 'нет',
      }));

    let aiReasons: Record<string, string> = {};

    if (reasonRequests.length > 0) {
      const prompt = `Ты — AI-ассистент школьного расписания. Для каждого урока напиши КРАТКОЕ обоснование выбора замены (1-2 предложения на русском). Используй данные о штрафных баллах.

Формула: Итоговый штраф = Штраф_предмет + Штраф_нагрузка
- Штраф_предмет: 0=тот же предмет, 50=смежная группа, 200=чужой предмет, 500=не педагог
- Штраф_нагрузка: 0=зеленая(0-4ур), 25=оранжевая(5-6ур), 999=красная(7+ур)

Данные для обоснования:
${JSON.stringify(reasonRequests, null, 2)}

Ответь ТОЛЬКО чистым JSON (без markdown):
{
  "reasons": {
    "<time_slot>": "обоснование выбора для этого урока"
  },
  "summary": "Общее резюме замены за весь день (2-3 предложения)"
}`;

      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiReasons = parsed.reasons || {};
          aiReasons['__summary__'] = parsed.summary || '';
        }
      } catch (aiErr) {
        console.warn('[smart-substitution] Gemini reason generation failed, using fallback');
      }
    }

    // ── Step 4: Assemble final response ──────────────────────
    const lessons = lessonResults.map((lr: any) => {
      const slot = lr.lesson.time_slot;
      const reason = aiReasons[slot]
        || (lr.best
          ? `Выбран ${lr.best.name} — штраф: предмет ${lr.best.penalty.subject}б + нагрузка ${lr.best.penalty.workload}б = ${lr.best.penalty.total}б (минимум в пуле).`
          : null);

      return {
        lesson_id: lr.lesson.id,
        time_slot: slot,
        class_name: lr.lesson.class_name,
        is_lenta: lr.isLenta,
        lenta_warning: lr.isLenta
          ? 'Этот урок является частью Ленты (уровневое деление). При отсутствии предметника методика может быть нарушена.'
          : null,
        candidate: lr.best
          ? {
              id: lr.best.id,
              name: lr.best.name,
              subject: lr.best.subject,
              group: lr.best.group,
              zone: lr.best.zone,
              tier: lr.best.penalty.subject === 0 ? 1 : lr.best.penalty.subject === 50 ? 2 : lr.best.penalty.subject === 200 ? 3 : 4,
              penalty: lr.best.penalty,
              priority_level: 1,
              reason,
              new_load: lr.best.current_load + 1,
            }
          : null,
        alternatives: lr.alternatives.map((a: any) => ({
          id: a.id,
          name: a.name,
          subject: a.subject,
          group: a.group,
          zone: a.zone,
          tier: a.penalty.subject === 0 ? 1 : a.penalty.subject === 50 ? 2 : a.penalty.subject === 200 ? 3 : 4,
          penalty: a.penalty,
          reason: `Штраф: ${a.penalty.subject}б (предмет) + ${a.penalty.workload}б (нагрузка) = ${a.penalty.total}б`,
        })),
        no_substitute: lr.noSubstitute,
        emergency_message: lr.noSubstitute
          ? 'Нет доступных учителей. Рекомендую: объединить классы в актовом зале или перенести урок.'
          : null,
      };
    });

    return NextResponse.json({
      ok: true,
      result: {
        status: 'success',
        lessons,
        summary: aiReasons['__summary__'] || `Обработано ${lessons.length} уроков. Замены подобраны по системе минимального штрафа.`,
      },
    });

  } catch (err: any) {
    console.error('[smart-substitution]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
