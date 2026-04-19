'use client';
import React, { useState, useRef, useCallback } from 'react';
import SmartSubstituteTab from './SmartSubstituteTab';
import IncidentDeleteButton from '../IncidentDeleteButton';

const TIME_SLOTS = [
  '08:00–08:45',
  '09:05–09:50',
  '10:10–10:55',
  '11:00–11:45',
  '11:50–12:35',
  '13:05-13:50',
  '14:20–15:00',
  '15:05–15:45'
];

const STORAGE_KEY = 'smart_schedule_overrides_v1';

export default function SmartScheduleClient({ initialTeachers, initialSchedules }: { initialTeachers: any[], initialSchedules: any[] }) {
  const [sessionTeachers, setSessionTeachers] = useState(initialTeachers);

  const teachers = React.useMemo(() => {
    return [...sessionTeachers].sort((a, b) => {
      const getRank = (t: any) => {
        const s = t.specialty?.toLowerCase() || '';
        
        // 1. Administration
        if (t.role === 'admin' || s.includes('завуч') || s.includes('директор')) return 1;
        
        // 5. Tech Staff
        if (t.role === 'staff' || s.includes('слесарь') || s.includes('техник') || s.includes('завхоз') || s.includes('охранник') || s.includes('уборщица') || s.includes('админ')) return 5;
        
        // 4. Psychologists & Social
        if (s.includes('психолог') || s.includes('социал')) return 4;
        
        // 3. Non-Academic pedagogy (PE, Art, Music, Military)
        if (s.includes('аәд') || s.includes('дене тәрбиесі') || s.includes('көркем еңбек') || s.includes('музыка')) return 3;
        
        // 2. Academic Teachers (Math, Science, Humanities)
        return 2;
      };
      
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) return rankA - rankB;
      
      const specA = (a.specialty || '').trim();
      const specB = (b.specialty || '').trim();
      if (specA !== specB) return specA.localeCompare(specB, 'ru');
      
      return (a.full_name || '').localeCompare(b.full_name || '', 'ru');
    });
  }, [sessionTeachers]);

  // Load overrides from localStorage on first render
  const loadInitialSchedules = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialSchedules;
      const overrides: Record<string, any> = JSON.parse(raw);
      return initialSchedules.map(s => overrides[s.id] ? { ...s, ...overrides[s.id] } : s);
    } catch { return initialSchedules; }
  };

  const [schedules, setSchedules] = useState<any[]>(loadInitialSchedules);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState<boolean>(() => {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });
  const saveTimer = useRef<any>(null);
  

  // === Persist changes to localStorage + Supabase ===
  const persistChange = useCallback((updatedSchedules: any[]) => {
    // 1. Compute diff vs original
    const overrides: Record<string, any> = {};
    updatedSchedules.forEach(s => {
      const orig = initialSchedules.find(o => o.id === s.id);
      if (orig && (orig.teacher_id !== s.teacher_id || orig.time_slot !== s.time_slot || orig.day_of_week !== s.day_of_week)) {
        overrides[s.id] = { teacher_id: s.teacher_id, time_slot: s.time_slot, day_of_week: s.day_of_week };
      }
    });

    // 2. Save to localStorage
    try {
      if (Object.keys(overrides).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
        setHasChanges(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setHasChanges(false);
      }
    } catch {}

    // 3. Debounced save to Supabase
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const changedRows = Object.entries(overrides).map(([id, data]) => ({ id, ...data }));
        if (changedRows.length === 0) { setSaveStatus('saved'); return; }
        const res = await fetch('/api/schedule/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: changedRows }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch { setSaveStatus('error'); }
    }, 1200);
  }, [initialSchedules]);

  const resetToOriginal = useCallback(async () => {
    if (!confirm('Сбросить все изменения и вернуть оригинальное расписание?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Reset in Supabase too
      await fetch('/api/schedule/reset', { method: 'POST' });
      setSchedules(initialSchedules);
      setHasChanges(false);
      setSaveStatus('idle');
    } catch {
      setSchedules(initialSchedules);
      setHasChanges(false);
    }
  }, [initialSchedules]);

  const [draggedItem, setDraggedItem] = useState<any | null>(null);
  const [conflictCell, setConflictCell] = useState<string | null>(null);
  
  // Новые стейты для Констрейнтов и Генерации
  const [showConstraints, setShowConstraints] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Стейты архитектуры (предыдущие состояния)
  const [previousSchedules, setPreviousSchedules] = useState<any[] | null>(null);
  const [previousTeachers, setPreviousTeachers] = useState<any[] | null>(null);

  // Стейты для режима просмотра (от слесаря до зама)
  const [viewMode, setViewMode] = useState<'matrix' | 'personal'>('matrix');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [subjectFilters, setSubjectFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (value: string) => {
    setSubjectFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) { next.delete(value); } else { next.add(value); }
      return next;
    });
  };
  
  // UX Улучшения для большой таблицы
  const [isCompact, setIsCompact] = useState(true);
  const [pocketItems, setPocketItems] = useState<any[]>([]);

  // === Smart Select ===
  // selectedSlots — Set of selected lesson IDs for batch AI operations
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<string | null>(null);

  /** Toggle single lesson in/out of selection */
  const toggleSlot = (slotId: string) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      next.has(slotId) ? next.delete(slotId) : next.add(slotId);
      return next;
    });
  };

  /** Click teacher name: select ALL their lessons on current day (or deselect if all already selected) */
  const selectByTeacher = (teacherId: string) => {
    const teacherLessons = schedules.filter(
      s => s.teacher_id === teacherId && s.day_of_week === selectedDay
    );
    const allIds = new Set(teacherLessons.map(l => l.id));
    setSelectedSlots(prev => {
      // If every lesson already selected → deselect all
      const allSelected = teacherLessons.every(l => prev.has(l.id));
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      }
      // Otherwise → add all to selection
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
  };

  /** Collect selected lessons as structured JSON for AI */
  const buildSelectionJSON = () => {
    const selected = schedules.filter(s => selectedSlots.has(s.id));
    return selected.map(s => {
      const teacher = teachers.find(t => t.id === s.teacher_id);
      return {
        id: s.id,
        teacher: teacher?.full_name || 'Неизвестно',
        teacherId: s.teacher_id,
        subject: teacher?.specialty || '',
        class: s.class_name,
        room: s.room_number,
        slot: s.time_slot,
        day: s.day_of_week,
      };
    });
  };

  /** Send selected lessons to AI for optimization suggestions */
  const optimizeSelected = async () => {
    if (selectedSlots.size === 0) return;
    setIsOptimizing(true);
    setIsAnalyzing(true);
    setOptimizeResult(null);
    try {
      const selectedSchedules = schedules.filter(s => selectedSlots.has(s.id));
      const dayNames: Record<number, string> = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница' };

      // Build teachers pool: for each teacher compute load + free slots
      const teachers_pool = teachers.map(t => {
        const todayLessons = schedules.filter(s => s.teacher_id === t.id && s.day_of_week === selectedDay);
        const busySlots = new Set(todayLessons.map((s: any) => s.time_slot));
        const freeSlots = TIME_SLOTS.filter(slot => !busySlots.has(slot));
        return { ...t, current_load: todayLessons.length, free_slots: freeSlots };
      }).filter(t => selectedSchedules.some(l => t.free_slots.includes(l.time_slot)));

      const sickLessonsWithSpecialty = selectedSchedules.map(lesson => {
        const teacher = teachers.find(t => t.id === lesson.teacher_id);
        return { ...lesson, absent_specialty: teacher?.specialty || '' };
      });

      const res = await fetch('/api/smart-substitution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absent_teacher: { full_name: 'Smart Select', specialty: 'Массовая замена' },
          sick_lessons: sickLessonsWithSpecialty,
          teachers_pool,
          constraints: { max_daily_load: 6 },
          day_name: dayNames[selectedDay] || 'День',
        }),
      });

      const data = await res.json();
      if (data.ok && data.result) {
        const aiResult = data.result;

        // Map AI lessons back to candidatesPerLesson format
        const candidatesPerLesson = selectedSchedules.map(lesson => {
          const aiLesson = aiResult.lessons?.find((l: any) => l.lesson_id === lesson.id || l.time_slot === lesson.time_slot);
          if (!aiLesson) return { lesson, candidates: [], aiReason: null };

          const candidateTeacher = aiLesson.candidate?.id
            ? teachers.find((t: any) => t.id === aiLesson.candidate.id)
            : null;

          const alternatives = (aiLesson.alternatives || []).map((alt: any) => {
            const t = teachers.find((t: any) => t.id === alt.id);
            return t ? { ...t, aiReason: alt.reason } : null;
          }).filter(Boolean);

          return {
            lesson,
            candidates: candidateTeacher
              ? [{ ...candidateTeacher, aiReason: aiLesson.candidate.reason, priorityLevel: aiLesson.candidate.priority_level, newLoad: aiLesson.candidate.new_load }, ...alternatives]
              : alternatives,
            lentaWarning: aiLesson.lenta_warning,
            emergencyMessage: aiLesson.emergency_message,
            noSubstitute: aiLesson.no_substitute,
          };
        });

        const isLenta = selectedSchedules.some((l: any) => l.class_name?.includes('ЛЕНТА') || l.class_name?.includes('лента'));

        // ERP: Find завхоз
        const janitor = teachers.find((t: any) =>
          t.role === 'maintenance' ||
          t.specialty?.toLowerCase() === 'завхоз' ||
          t.specialty?.toLowerCase().startsWith('завхоз')
        );
        let janitorFreeSlot = null;
        if (janitor) {
          const janitorBusy = new Set(schedules.filter((s: any) => s.teacher_id === janitor.id && s.day_of_week === selectedDay).map((s: any) => s.time_slot));
          janitorFreeSlot = TIME_SLOTS.find(slot => !janitorBusy.has(slot)) || null;
        }

        setSubstitutionModal({
          teacher: { full_name: 'Smart Select (Массовая замена)', specialty: 'Выбранные уроки' },
          sickLessons: selectedSchedules,
          candidatesPerLesson,
          isLenta,
          janitor,
          janitorFreeSlot,
          selectedSubstitutes: {} as Record<string, string>,
          aiSummary: aiResult.summary,
        });
        setSelectedSlots(new Set()); // clear selection once modal opens
      }
    } catch (e) {
      console.error(e);
      showAlert('Ошибка', 'Не удалось связаться с AI-эвристикой.', 0);
    }
    setIsOptimizing(false);
    setIsAnalyzing(false);
  };

  // === Alert Modal (replaces browser alert()) ===
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; constraint: number } | null>(null);
  const showAlert = (title: string, message: string, constraint: number) => setAlertModal({ title, message, constraint });

  // === Smart Substitution Engine ===
  const [sickTeacherId, setSickTeacherId] = useState<string | null>(null);
  const [substitutionModal, setSubstitutionModal] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [erpTaskInput, setErpTaskInput] = useState('');
  const [erpTaskSent, setErpTaskSent] = useState(false);

  const DAY_NAMES: Record<number, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт' };

  const handleSickDay = async (teacher: any) => {
    setIsAnalyzing(true);
    setSickTeacherId(teacher.id);

    const sickLessons = schedules.filter(
      s => s.teacher_id === teacher.id && s.day_of_week === selectedDay
    ).sort((a, b) => a.time_slot.localeCompare(b.time_slot));

    // Build teachers pool: for each teacher compute load + free slots
    const teachers_pool = teachers
      .filter(t => t.id !== teacher.id)
      .map(t => {
        const todayLessons = schedules.filter(s => s.teacher_id === t.id && s.day_of_week === selectedDay);
        const busySlots = new Set(todayLessons.map((s: any) => s.time_slot));
        const freeSlots = TIME_SLOTS.filter(slot => !busySlots.has(slot));
        return { ...t, current_load: todayLessons.length, free_slots: freeSlots };
      })
      // Only pass teachers who are free for at least one needed slot
      .filter(t => sickLessons.some(l => t.free_slots.includes(l.time_slot)));

    // ERP: Find завхоз — only exact role or specialty match, NOT техник/слесарь (those are repair staff, not facility managers)
    const janitor = teachers.find((t: any) =>
      t.role === 'maintenance' ||
      t.specialty?.toLowerCase() === 'завхоз' ||
      t.specialty?.toLowerCase().startsWith('завхоз')
    );
    let janitorFreeSlot = null;
    if (janitor) {
      const janitorBusy = new Set(schedules.filter((s: any) => s.teacher_id === janitor.id && s.day_of_week === selectedDay).map((s: any) => s.time_slot));
      janitorFreeSlot = TIME_SLOTS.find(slot => !janitorBusy.has(slot)) || null;
    }

    const dayNames: Record<number, string> = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница' };

    try {
      const res = await fetch('/api/smart-substitution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absent_teacher: teacher,
          sick_lessons: sickLessons,
          teachers_pool,
          constraints: { max_daily_load: 6 },
          day_name: dayNames[selectedDay] || 'День',
        }),
      });

      const data = await res.json();

      if (data.ok && data.result) {
        const aiResult = data.result;

        // Map AI lessons back to candidatesPerLesson format
        const candidatesPerLesson = sickLessons.map(lesson => {
          const aiLesson = aiResult.lessons?.find((l: any) => l.lesson_id === lesson.id || l.time_slot === lesson.time_slot);
          if (!aiLesson) return { lesson, candidates: [], aiReason: null };

          const candidateTeacher = aiLesson.candidate?.id
            ? teachers.find((t: any) => t.id === aiLesson.candidate.id)
            : null;

          const alternatives = (aiLesson.alternatives || []).map((alt: any) => {
            const t = teachers.find((t: any) => t.id === alt.id);
            return t ? { ...t, aiReason: alt.reason } : null;
          }).filter(Boolean);

          return {
            lesson,
            candidates: candidateTeacher
              ? [{ ...candidateTeacher, aiReason: aiLesson.candidate.reason, priorityLevel: aiLesson.candidate.priority_level, newLoad: aiLesson.candidate.new_load }, ...alternatives]
              : alternatives,
            lentaWarning: aiLesson.lenta_warning,
            emergencyMessage: aiLesson.emergency_message,
            noSubstitute: aiLesson.no_substitute,
          };
        });

        const isLenta = sickLessons.some((l: any) => l.class_name?.includes('ЛЕНТА') || l.class_name?.includes('лента'));

        setSubstitutionModal({
          teacher,
          sickLessons,
          candidatesPerLesson,
          isLenta,
          janitor,
          janitorFreeSlot,
          selectedSubstitutes: {} as Record<string, string>,
          aiSummary: aiResult.summary,
        });
      } else {
        throw new Error(data.error || 'AI error');
      }
    } catch (err) {
      console.error('Smart substitution AI error:', err);
      // Fallback to local logic
      const isLenta = sickLessons.some((l: any) => l.class_name?.includes('ЛЕНТА') || l.class_name?.includes('лента'));
      const candidatesPerLesson = sickLessons.map(lesson => {
        const free = teachers_pool.filter(t => t.free_slots.includes(lesson.time_slot) && t.current_load < 6);
        return { lesson, candidates: free.slice(0, 3), lentaWarning: null, emergencyMessage: null, noSubstitute: free.length === 0 };
      });
      setSubstitutionModal({ teacher, sickLessons, candidatesPerLesson, isLenta, janitor, janitorFreeSlot, selectedSubstitutes: {}, aiSummary: null });
    }

    setIsAnalyzing(false);
  };


  const applySubstitution = (lessonId: string, substituteTeacherId: string) => {
    setSubstitutionModal((prev: any) => ({
      ...prev,
      selectedSubstitutes: { ...prev.selectedSubstitutes, [lessonId]: substituteTeacherId }
    }));
  };

  const confirmSubstitutions = () => {
    if (!substitutionModal) return;
    const { selectedSubstitutes, sickLessons } = substitutionModal;

    // Validate Constraints before applying (Check double-booking)
    const assignmentsBySlot: Record<string, string[]> = {};
    let conflictFound = false;

    for (const lessonId of Object.keys(selectedSubstitutes)) {
      const teacherId = selectedSubstitutes[lessonId];
      const lesson = sickLessons.find((l: any) => l.id === lessonId);
      if (!lesson) continue;

      const slot = lesson.time_slot;
      if (!assignmentsBySlot[slot]) assignmentsBySlot[slot] = [];
      
      if (assignmentsBySlot[slot].includes(teacherId)) {
        conflictFound = true;
        const teacherName = teachers.find(t => t.id === teacherId)?.full_name || 'Учитель';
        showAlert(
          'Накладка: Учитель разорвётся',
          `Вы пытаетесь назначить ${teacherName} на два разных урока (или более) в одно время (${slot}). Исправьте выбор в списке перед применением.`,
          1
        );
        break;
      }
      assignmentsBySlot[slot].push(teacherId);
    }

    if (conflictFound) return;

    setSchedules(prev => {
      const updated = prev.map(s => {
        if (selectedSubstitutes[s.id]) {
          return { ...s, teacher_id: selectedSubstitutes[s.id], status: 'substituted' };
        }
        return s;
      });
      persistChange(updated);
      return updated;
    });
    setSickTeacherId(null);
    setSubstitutionModal(null);
  };

  const handleGenerateValues = () => {
     setIsGenerating(true);
     // Имитация сложной калькуляции алгоритма
     setTimeout(() => {
        // AI-Оркестратор: Строим расписание с нуля с учетом "Лент"
        const newSchedules = [];
        let idCounter = 999;
        
        // Магия ЛЕНТЫ (Параллель 3-х классов)
        const lentaSlot = '10:00-10:45'; // 3-й урок
        const qosymshaSlot = '12:10-12:55'; // 5-й урок (доп занятия вне сетки)
        
        const mathTeachers = teachers.filter(t => t.specialty === 'Учитель математики').slice(0, 3);
        // Если математиков мало, берем просто первых 3х
        const targetTeachers = mathTeachers.length >= 3 ? mathTeachers : teachers.slice(0, 3);
        
        targetTeachers.forEach((t, i) => {
           newSchedules.push({
               id: `gen-lenta-${idCounter++}`,
               teacher_id: t.id,
               time_slot: lentaSlot,
               day_of_week: 1,
               class_name: `[ЛЕНТА] Математика 3${['А', 'Б', 'В'][i] || 'К'}`,
               room_number: `10${i+1}`
           });
        });

        // Магия Қосымша (Доп. Занятия вне сетки, для слабых учеников)
        if (targetTeachers[0]) {
           newSchedules.push({
               id: `gen-qosymsha-${idCounter++}`,
               teacher_id: targetTeachers[0].id,
               time_slot: qosymshaSlot,
               day_of_week: 1,
               class_name: `[Қосымша] Спецкурс (Отстающие)`,
               room_number: `Лаб. 2`
           });
        }

        // Заполняем остальные рандомно слоты (кроме Ленты) для демо
        teachers.forEach(t => {
           TIME_SLOTS.forEach(slot => {
              if (slot === lentaSlot && targetTeachers.find(tt => tt.id === t.id)) return; // Already Lenta
              if (Math.random() > 0.6) {
                 newSchedules.push({
                     id: `gen-rnd-${idCounter++}`,
                     teacher_id: t.id,
                     time_slot: slot,
                     day_of_week: 1,
                     class_name: `Урок ${Math.floor(Math.random()*11) + 1} Класс`,
                     room_number: `${Math.floor(Math.random()*30) + 100}`
                 });
              }
           });
        });

        setSchedules(newSchedules);
        setIsGenerating(false);
        setHasGenerated(true);
     }, 2000); // 2 seconds delay to mock heavy calculation
  };

  // Рассчитываем Heatmap нагрузки (если > 3 уроков - оранжевый, 5 - красный)
  const getTeacherWorkload = (teacherId: string) => {
    return schedules.filter(s => s.teacher_id === teacherId && s.day_of_week === selectedDay).length;
  };

  const handleDragStart = (e: React.DragEvent, scheduleItem: any) => {
    setDraggedItem(scheduleItem);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, teacherId: string, timeSlot: string) => {
    e.preventDefault(); // Necessarry to allow drop
    
    // Helper to extract base class (e.g. "7A", "10В")
    const getBaseClass = (name: string) => {
       if (!name) return null;
       const match = name.match(/\d+[А-Яa-zA-Z]/i);
       return match ? match[0].toUpperCase() : null;
    };

    // Check conflicts: Is this cell already occupied by another class for this teacher?
    const isTeacherBusy = schedules.find(s => s.teacher_id === teacherId && s.time_slot === timeSlot && s.day_of_week === selectedDay && s.id !== draggedItem?.id);
    
    // Check conflicts: Is the room already occupied at this time slot?
    const isRoomBusy = draggedItem ? schedules.find(s => s.room_number === draggedItem.room_number && s.time_slot === timeSlot && s.day_of_week === selectedDay && s.id !== draggedItem.id) : false;
    
    // Check conflicts: Is the CLASS already having a lesson with someone else at this time?
    const draggedBaseClass = draggedItem ? getBaseClass(draggedItem.class_name) : null;
    const isClassBusyHover = draggedBaseClass ? schedules.find(s => {
        const baseClass = getBaseClass(s.class_name);
        return baseClass === draggedBaseClass && s.time_slot === timeSlot && s.day_of_week === selectedDay && s.id !== draggedItem?.id;
    }) : false;

    // Включаем подстветку ошибки, если любое из 3-х ограничений нарушено
    const isOccupied = isTeacherBusy || isRoomBusy || isClassBusyHover;
    
    if (isOccupied) {
       e.dataTransfer.dropEffect = 'none';
       if (conflictCell !== `${teacherId}-${timeSlot}`) setConflictCell(`${teacherId}-${timeSlot}`);
    } else {
       e.dataTransfer.dropEffect = 'move';
       if (conflictCell === `${teacherId}-${timeSlot}`) setConflictCell(null);
    }
  };

  const handleDragLeave = () => {
    setConflictCell(null);
  };

  const handleDrop = (e: React.DragEvent, targetTeacherId: string, targetTimeSlot: string) => {
    e.preventDefault();
    setConflictCell(null);
    if (!draggedItem) return;

    // Check conflict against the state
    if (targetTeacherId !== 'pocket') {
        const getBaseClass = (name: string) => {
           if (!name) return null;
           const match = name.match(/\d+[А-Яa-zA-Z]/i);
           return match ? match[0].toUpperCase() : null;
        };

        const isTeacherBusy = schedules.find(s => s.teacher_id === targetTeacherId && s.time_slot === targetTimeSlot && s.day_of_week === selectedDay && s.id !== draggedItem.id);
        const isRoomBusy = schedules.find(s => s.room_number === draggedItem.room_number && s.time_slot === targetTimeSlot && s.day_of_week === selectedDay && s.id !== draggedItem.id);
        
        const draggedBaseClass = getBaseClass(draggedItem.class_name);
        const isClassBusy = draggedBaseClass ? schedules.find(s => {
            const baseClass = getBaseClass(s.class_name);
            return baseClass === draggedBaseClass && s.time_slot === targetTimeSlot && s.day_of_week === selectedDay && s.id !== draggedItem.id;
        }) : false;

        if (isTeacherBusy) {
          showAlert(
            'Накладка: Учитель занят',
            `Учитель уже ведёт урок в слот ${targetTimeSlot}. Нельзя быть в двух местах одновременно.`,
            1
          );
          return;
        }
        if (isRoomBusy) {
          showAlert(
            'Накладка: Кабинет занят',
            `Кабинет №${draggedItem.room_number} уже занят другим классом в слот ${targetTimeSlot}. Два класса в одном кабинете невозможны.`,
            2
          );
          return;
        }
        if (isClassBusy) {
          showAlert(
            'Накладка: Класс занят',
            `Класс ${draggedBaseClass} уже на другом уроке в слот ${targetTimeSlot}. Класс не может быть в двух местах одновременно.`,
            3
          );
          return;
        }
    }

    // Если перетащили ВНУТРЬ кармана
    if (targetTeacherId === 'pocket') {
        if (!pocketItems.find(p => p.id === draggedItem.id)) {
             setPocketItems([...pocketItems, draggedItem]);
             setSchedules(prev => prev.filter(s => s.id !== draggedItem.id));
        }
        setDraggedItem(null);
        return;
    }

    // Если перетащили ИЗ кармана В сетку
    const isFromPocket = pocketItems.find(p => p.id === draggedItem.id);
    if (isFromPocket) {
        const updatedItem = { ...draggedItem, teacher_id: targetTeacherId, time_slot: targetTimeSlot, day_of_week: selectedDay };
        setSchedules(prev => { const upd = [...prev, updatedItem]; persistChange(upd); return upd; });
        setPocketItems(prev => prev.filter(p => p.id !== draggedItem.id));
        setDraggedItem(null);
        return;
    }

    // Обычное перетаскивание внутри сетки
    setSchedules(prev => {
      const updated = prev.map(s => {
        if (s.id === draggedItem.id) {
          return { ...s, teacher_id: targetTeacherId, time_slot: targetTimeSlot, day_of_week: selectedDay };
        }
        return s;
      });
      persistChange(updated);
      return updated;
    });
    setDraggedItem(null);
  };

  const handlePocketDrop = (e: React.DragEvent) => {
      e.preventDefault();
      handleDrop(e, 'pocket', 'none');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
              <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                  <button 
                     onClick={() => setViewMode('matrix')} 
                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'matrix' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                     Сводная сетка учителей
                  </button>
                  <button 
                     onClick={() => setViewMode('personal')} 
                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                     Личное расписание
                  </button>
              </div>
              
              {viewMode === 'matrix' && (
                <select 
                  className="bg-card border border-border text-foreground text-sm font-bold rounded-xl focus:ring-primary focus:border-primary block p-2 transition-all hover:border-primary/50 cursor-pointer shadow-sm"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                >
                  <option value={1}>Понедельник (ПН)</option>
                  <option value={2}>Вторник (ВТ)</option>
                  <option value={3}>Среда (СР)</option>
                  <option value={4}>Четверг (ЧТ)</option>
                  <option value={5}>Пятница (ПТ)</option>
                </select>
              )}
          </div>

          <div className="flex items-center gap-3">
             {previousSchedules && (
                <button 
                   onClick={() => { 
                      setSchedules(previousSchedules); 
                      persistChange(previousSchedules); 
                      setPreviousSchedules(null); 
                      if (previousTeachers) {
                         setSessionTeachers(previousTeachers);
                         setPreviousTeachers(null);
                      }
                   }}
                   className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500 rounded-xl text-sm font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-2 shadow-sm animate-in zoom-in-95"
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                   Отменить генерацию
                </button>
             )}
             <button 
                onClick={() => setShowConstraints(true)}
                className="px-4 py-2 bg-muted/50 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-2"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                Матрица Констрейнтов
             </button>
          </div>
      </div>

      {viewMode === 'matrix' && (
        <div className="flex flex-col gap-3">
          {/* Subject Filter Chips */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* ВСЕ - special button to clear all filters */}
            <button
              onClick={() => setSubjectFilters(new Set())}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                subjectFilters.size === 0
                  ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                  : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
              }`}
            >
              🏫 ВСЕ <span className="ml-1.5 opacity-60">({teachers.length})</span>
            </button>
            {[
              { label: 'Математика', value: 'алгебра', emoji: '📐' },
              { label: 'Қазақ тілі', value: 'қазақ тілі', emoji: '🇰🇿' },
              { label: 'Орыс тілі', value: 'орыс тілі мен әдебиеті', emoji: '📖' },
              { label: 'Ағылшын / IELTS', value: 'IELTS', emoji: '🌍' },
              { label: 'Физика', value: 'физика', emoji: '⚡' },
              { label: 'Химия', value: 'химия', emoji: '🧪' },
              { label: 'Биология', value: 'биология', emoji: '🌿' },
              { label: 'Информатика', value: 'информатика', emoji: '💻' },
              { label: 'Тарих', value: 'қазақстан тарихы', emoji: '📜' },
              { label: 'География', value: 'география', emoji: '🗺️' },
              { label: 'Дене шынықтыру', value: 'дене тәрбиесі', emoji: '🏃' },
            ].map(f => {
              const isActive = subjectFilters.has(f.value);
              const count = f.value === 'IELTS'
                ? teachers.filter(t => t.specialty === 'IELTS' || t.specialty === 'ағылшын тілі').length
                : teachers.filter(t => t.specialty?.toLowerCase() === f.value.toLowerCase()).length;
              return (
                <button
                  key={f.value}
                  onClick={() => toggleFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                      : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                  }`}
                >
                  {f.emoji} {f.label}
                  <span className="ml-1.5 opacity-60">({count})</span>
                </button>
              );
            })}
            {subjectFilters.size > 0 && (
              <button
                onClick={() => setSubjectFilters(new Set())}
                className="px-3 py-1.5 rounded-full text-xs font-bold border border-rose-500/40 text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all whitespace-nowrap flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                Сбросить ({subjectFilters.size})
              </button>
            )}
            {subjectFilters.size > 0 && (
              <span className="text-xs text-muted-foreground font-medium ml-1">
                Выбрано: {[
                  ...[...subjectFilters].map(v => teachers.filter(t =>
                    v === 'IELTS' ? (t.specialty === 'IELTS' || t.specialty === 'ағылшын тілі') : t.specialty?.toLowerCase() === v.toLowerCase()
                  ).length)
                ].reduce((a, b) => a + b, 0)} учителей
              </span>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-medium bg-card px-4 py-2 rounded-lg border border-border w-max">
             <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></span> Нормальная нагрузка</span>
             <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500/20 border border-orange-500"></span> Плотный график</span>
             <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></span> Перегруз (Узкое место)</span>
          </div>
        </div>
      )}

      {/* Модалка Констрейнтов */}
      {showConstraints && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in">
             <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl p-6 relative">
                 <button onClick={() => setShowConstraints(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
                 <h2 className="text-xl font-bold text-foreground mb-1">Сборка правил игры (Constraints)</h2>
                 <p className="text-muted-foreground text-sm mb-6">Перед генерацией нейросеть анализирует жесткие матрицы классов, учителей и кабинетов.</p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-muted p-4 rounded-xl border border-border">
                       <h3 className="font-bold text-sm mb-3 uppercase tracking-wide flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Матрица Классов</h3>
                       <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Математика 10А</span><span className="font-bold text-foreground">5 ч/нед</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Физика 10А</span><span className="font-bold text-foreground">3 ч/нед</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Английский 10А</span><span className="font-bold text-primary">Лента (Уровни)</span></div>
                       </div>
                    </div>
                    
                    <div className="bg-muted p-4 rounded-xl border border-border">
                       <h3 className="font-bold text-sm mb-3 uppercase tracking-wide flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Матрица Учителей</h3>
                       <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Джобс С. (Англ)</span><span className="font-bold text-foreground">Max 25 ч</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Гейтс Б. (Матем)</span><span className="font-bold text-warning">Освобожден ЧТ</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Маск И. (Физ)</span><span className="font-bold text-foreground">Max 18 ч</span></div>
                       </div>
                    </div>

                    <div className="bg-muted p-4 rounded-xl border border-border">
                       <h3 className="font-bold text-sm mb-3 uppercase tracking-wide flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Матрица Помещений</h3>
                       <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Лекционная 101</span><span className="font-bold text-foreground">Вм. 40 чел</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Спортзал</span><span className="font-bold text-warning">Ремонт до 10.05</span></div>
                          <div className="flex justify-between p-2 bg-card rounded-md border border-border"><span>Лаборатория 112</span><span className="font-bold text-foreground">Только Химия/Био</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="mt-6 flex justify-end">
                    <button onClick={() => setShowConstraints(false)} className="px-6 py-2 bg-foreground text-background rounded-xl font-bold shadow-md hover:bg-foreground/90 transition-all">Утвердить констрейнты</button>
                 </div>
             </div>
          </div>
      )}

      {viewMode === 'matrix' && (
          <div className="flex justify-between gap-2 text-sm mt-[-10px] mb-2 px-2 items-center text-muted-foreground">
            {/* Save status + Reset */}
            <div className="flex items-center gap-3">
              {/* Save status indicator */}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Сохранение...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                  Сохранено в БД
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-orange-500 font-bold">
                  ⚠️ Сохранено локально
                </span>
              )}
              {/* Changes count */}
              {hasChanges && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                  ✏️ Есть изменения
                </span>
              )}
              {/* Reset button */}
              {hasChanges && (
                <button
                  onClick={resetToOriginal}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-500 border border-rose-500/30 rounded-xl px-3 py-1.5 hover:bg-rose-500 hover:text-white transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Сбросить до оригинала
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
               <input type="checkbox" checked={isCompact} onChange={e => setIsCompact(e.target.checked)} className="rounded border-border bg-card text-primary focus:ring-primary/50" />
               Компактный вид (вместить всех)
            </label>
          </div>
      )}

      {viewMode === 'matrix' ? (
      <div className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="min-w-[900px] bg-white/70 dark:bg-black/20 rounded-3xl overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200 dark:border-white/5">
          {/* Header Row */}
          <div className="grid grid-cols-[200px_repeat(8,1fr)] bg-slate-100 dark:bg-white/5 mb-2">
            <div className="p-4 font-bold text-slate-800 dark:text-white sticky left-0 z-20">Сотрудник ({['Пн', 'Вт', 'Ср', 'Чт', 'Пт'][selectedDay - 1] || 'День'})</div>
            {TIME_SLOTS.map(slot => (
              <div key={slot} className="p-4 font-bold text-center text-sm text-slate-700 dark:text-white/80">{slot} <br/> <span className="text-[11px] font-medium text-slate-500 dark:text-white/50">Урок {TIME_SLOTS.indexOf(slot)+1}</span></div>
            ))}
          </div>

          {/* Matrix Rows */}
          <div className="flex flex-col gap-1 p-2">
            {teachers
              .filter(t => {
                if (subjectFilters.size === 0) return true;
                return [...subjectFilters].some(v =>
                  v === 'IELTS'
                    ? (t.specialty === 'IELTS' || t.specialty === 'ағылшын тілі')
                    : t.specialty?.toLowerCase() === v.toLowerCase()
                );
              })
              .map(teacher => {
              const workload = getTeacherWorkload(teacher.id);
              let rowStyle = 'bg-transparent';
              if (workload >= 4) rowStyle = 'bg-red-500/5 dark:bg-red-500/10';
              else if (workload === 3) rowStyle = 'bg-orange-500/5 dark:bg-orange-500/10';
              else if (workload > 0) rowStyle = 'bg-green-500/5 dark:bg-green-500/10';

              const isSick = sickTeacherId === teacher.id;

              // Override row style if teacher is sick
              if (isSick) rowStyle = 'bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30';

              return (
                <div key={teacher.id} className={`grid grid-cols-[200px_repeat(8,1fr)] gap-2 p-1 transition-all duration-300 ${rowStyle} rounded-2xl hover:bg-white/60 dark:hover:bg-white/10`}>
                  {/* Teacher Column — click name to select all their lessons */}
                  <div className={`flex flex-col justify-center sticky left-0 z-10 ${isSick ? 'bg-rose-50 dark:bg-rose-950' : 'bg-white dark:bg-[#1a1a1a]'} rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] border border-slate-200/50 dark:border-white/5 ${isCompact ? 'p-2' : 'p-3'}`}>
                    <span
                      onClick={() => selectByTeacher(teacher.id)}
                      title="Нажмите чтобы выделить все уроки учителя"
                      className={`font-bold text-sm leading-tight cursor-pointer select-none transition-colors hover:text-primary ${
                        isSick ? 'text-rose-600 dark:text-rose-400 line-through' : 'text-slate-900 dark:text-white'
                      } ${
                        schedules.filter(s => s.teacher_id === teacher.id && s.day_of_week === selectedDay).every(l => selectedSlots.has(l.id)) &&
                        schedules.filter(s => s.teacher_id === teacher.id && s.day_of_week === selectedDay).length > 0
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : ''
                      }`}
                    >
                      {teacher.full_name}
                    </span>
                    {isSick && <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider mt-0.5 animate-pulse">🏥 Больничный</span>}
                    {/* Specialty badge — always visible, color-coded by subject group */}
                    {!isSick && (() => {
                      const s = teacher.specialty?.toLowerCase() || '';
                      const isStem = ['алгебра','физика','информатика','геометрия','химия','биология'].some(x => s.includes(x));
                      const isLang = ['қазақ','орыс','ағылшын','ielts','тіл','тарих'].some(x => s.includes(x));
                      const isPhys = ['дене','спорт'].some(x => s.includes(x));
                      const isArt  = ['еңбек','өнер','музык'].some(x => s.includes(x));
                      const isGeo  = ['географ'].some(x => s.includes(x));
                      const isTech = ['слесар','техник','завхоз','охран','психолог','профорие'].some(x => s.includes(x));
                      const cls = isTech
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        : isStem  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : isLang  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                        : isGeo   ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                        : isPhys  ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        : isArt   ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300'
                        : 'bg-muted text-muted-foreground';
                      return (
                        <span className={`mt-0.5 self-start px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider leading-none ${cls}`}>
                          {isTech ? '🔧 ' : ''}{teacher.specialty || 'Общий профиль'}
                        </span>
                      );
                    })()}
                    <div className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                       <span>Нагр: {workload}ч</span>
                       {workload >= 4 && !isSick && <span className="text-red-500">!!!</span>}
                    </div>
                    {!isSick ? (
                      <button
                        onClick={() => handleSickDay(teacher)}
                        className="mt-1.5 w-full text-[9px] font-bold uppercase tracking-wider text-rose-500 border border-rose-500/30 rounded-md py-0.5 hover:bg-rose-500 hover:text-white transition-all duration-200"
                      >
                        🏥 Больничный
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSickTeacherId(null); setSubstitutionModal(null); }}
                        className="mt-1.5 w-full text-[9px] font-bold uppercase tracking-wider text-slate-500 border border-slate-300 rounded-md py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                      >
                        ✕ Отмена
                      </button>
                    )}
                  </div>


                  {/* Time Slots */}
                  {TIME_SLOTS.map(slot => {
                    const cellId = `${teacher.id}-${slot}`;
                    // Получаем занятие именно для этого слота и выбранного дня
                    const scheduleItem = schedules.find(s => s.teacher_id === teacher.id && s.time_slot === slot && s.day_of_week === selectedDay);
                    const isConflict = conflictCell === cellId;

                    // Dynamic Drag Highlighting Logic for Empty Cells
                    let emptyCellClass = `w-full h-full border border-dashed border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 ${isCompact ? 'rounded-lg' : 'rounded-xl'} transition-all flex items-center justify-center bg-white/50 dark:bg-black/20`;
                    let dragHint = null;
                    
                    if (!scheduleItem && draggedItem) {
                        const getBaseClass = (name: string) => {
                           if (!name) return null;
                           const match = name.match(/\d+[А-Яa-zA-Z]/i);
                           return match ? match[0].toUpperCase() : null;
                        };
                        
                        const tBusy = schedules.find(s => s.teacher_id === teacher.id && s.time_slot === slot && s.day_of_week === selectedDay && s.id !== draggedItem.id);
                        const rBusy = schedules.find(s => s.room_number === draggedItem.room_number && s.time_slot === slot && s.day_of_week === selectedDay && s.id !== draggedItem.id);
                        const baseClass = getBaseClass(draggedItem.class_name);
                        const cBusy = baseClass ? schedules.find(s => getBaseClass(s.class_name) === baseClass && s.time_slot === slot && s.day_of_week === selectedDay && s.id !== draggedItem.id) : false;
                        
                        const isBlocked = tBusy || rBusy || cBusy;
                        
                        if (isBlocked) {
                            emptyCellClass = `w-full h-full border ${isCompact ? 'rounded-lg' : 'rounded-xl'} transition-all flex items-center justify-center bg-red-500/10 border-red-500/40`;
                            if (tBusy) dragHint = 'Учитель занят';
                            else if (rBusy) dragHint = 'Кабинет занят';
                            else if (cBusy) dragHint = 'Класс занят';
                        } else {
                            emptyCellClass = `w-full h-full border border-dashed ${isCompact ? 'rounded-lg' : 'rounded-xl'} transition-all flex items-center justify-center bg-emerald-500/10 border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]`;
                            dragHint = 'Свободно';
                        }
                    }

                    return (
                      <div 
                        key={cellId}
                        className={`relative transition-all duration-300 flex ${isCompact ? 'h-[52px]' : 'h-[72px]'} ${isConflict ? 'bg-red-500/20 border border-red-500 rounded-xl shadow-[inset_0_0_20px_rgba(239,68,68,0.3)]' : ''}`}
                        onDragOver={(e) => handleDragOver(e, teacher.id, slot)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, teacher.id, slot)}
                      >
                         {scheduleItem && (
                           <div 
                             draggable
                             onDragStart={(e) => handleDragStart(e, scheduleItem)}
                             onDragEnd={() => setDraggedItem(null)}
                             onClick={(e) => {
                               // Don't trigger selection when starting a drag
                               if (!e.defaultPrevented) toggleSlot(scheduleItem.id);
                             }}
                             className={`w-full h-full border ${isCompact ? 'rounded-lg p-1.5' : 'rounded-xl p-2'} cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between select-none ${
                               selectedSlots.has(scheduleItem.id)
                                 ? 'ring-2 ring-indigo-500 ring-offset-1 bg-indigo-500/20 border-indigo-500'
                                 : scheduleItem.class_name.includes('Ремонт') ? 'bg-orange-500/10 border-orange-500/30'
                                 : scheduleItem.class_name.includes('Обход') ? 'bg-purple-500/10 border-purple-500/30'
                                 : scheduleItem.class_name.includes('Қосымша') ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]'
                                 : scheduleItem.class_name.includes('ЛЕНТА') ? 'bg-blue-500/10 border-blue-500/40 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]'
                                 : 'bg-primary/10 border-primary/30'
                             }`}
                           >
                              {/* Selection indicator */}
                              {selectedSlots.has(scheduleItem.id) && (
                                <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center z-10">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                </div>
                              )}
                              <div className="flex justify-between items-start">
                                 <span className={`font-black ${isCompact ? 'text-[11px]' : 'text-sm'} leading-tight line-clamp-2 ${
                                   selectedSlots.has(scheduleItem.id) ? 'text-indigo-600 dark:text-indigo-400'
                                   : scheduleItem.class_name.includes('Ремонт') ? 'text-orange-500'
                                   : scheduleItem.class_name.includes('Обход') ? 'text-purple-500'
                                   : scheduleItem.class_name.includes('Қосымша') ? 'text-emerald-500'
                                   : scheduleItem.class_name.includes('ЛЕНТА') ? 'text-blue-500'
                                   : 'text-primary'
                                 }`}>{scheduleItem.class_name}</span>
                              </div>
                              <span className="text-[9px] font-bold px-1 py-0.5 mt-auto self-start rounded-full bg-foreground/5 text-foreground/80">Пом: {scheduleItem.room_number}</span>
                           </div>
                         )}
                         {!scheduleItem && (
                           <div className={emptyCellClass}>
                             {/* Empty drop zone indication */}
                             {isConflict && <span className="text-[10px] font-bold tracking-widest uppercase text-red-500 animate-pulse">Ошибка</span>}
                             {!isConflict && dragHint && (
                                <span className={`text-[8px] font-bold tracking-widest uppercase opacity-70 ${dragHint === 'Свободно' ? 'text-emerald-500' : 'text-red-500'}`}>{dragHint}</span>
                             )}
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4">
           <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Сотрудник:</label>
              <select 
                 className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block w-64 p-2.5"
                 value={selectedTeacherId}
                 onChange={(e) => setSelectedTeacherId(e.target.value)}
              >
                 {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} — {t.specialty || 'Сотрудник'}</option>
                 ))}
              </select>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'].map((dayName, idx) => {
                 const dayIndex = idx + 1;
                 const dayTasks = schedules.filter(s => s.teacher_id === selectedTeacherId && s.day_of_week === dayIndex).sort((a,b) => a.time_slot.localeCompare(b.time_slot));
                 
                 return (
                    <div key={dayName} className="bg-muted p-4 rounded-2xl border border-border flex flex-col gap-3">
                       <h3 className="font-bold text-foreground text-center bg-card shadow-sm border border-card-border py-2 px-3 rounded-lg">{dayName}</h3>
                       {dayTasks.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-6 bg-card/50 rounded-lg border border-border border-dashed">Свободный день</div>
                       ) : (
                          dayTasks.map(t => (
                             <div key={t.id} className="bg-card p-3 rounded-xl border border-card-border shadow-sm flex flex-col relative overflow-hidden">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 opacity-80 ${t.class_name.includes('Ремонт') ? 'bg-orange-500' : t.class_name.includes('Обход') ? 'bg-purple-500' : t.class_name.includes('Қосымша') ? 'bg-emerald-500' : t.class_name.includes('ЛЕНТА') ? 'bg-blue-500' : 'bg-primary'}`}></div>
                                <span className="text-[10px] font-bold text-muted-foreground ml-2 mb-1">{t.time_slot}</span>
                                <span className={`font-bold text-sm ml-2 leading-tight ${t.class_name.includes('Ремонт') ? 'text-orange-500' : t.class_name.includes('Обход') ? 'text-purple-500' : t.class_name.includes('Қосымша') ? 'text-emerald-500' : t.class_name.includes('ЛЕНТА') ? 'text-blue-500' : 'text-foreground'}`}>{t.class_name}</span>
                                <span className="text-xs text-muted-foreground ml-2 mt-2 font-medium">Пом: {t.room_number}</span>
                             </div>
                          ))
                       )}
                    </div>
                 );
              })}
           </div>
        </div>
      )}

      {/* ===== SMART SELECT FLOATING ACTION BAR ===== */}
      {selectedSlots.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-indigo-500/40 border border-indigo-400/40">
            {/* Count badge */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-black">
                {selectedSlots.size}
              </div>
              <span className="text-sm font-bold">
                {selectedSlots.size === 1 ? 'урок выбран' : `уроков выбрано`}
              </span>
            </div>

            <div className="w-px h-5 bg-white/30" />

            {/* AI Optimize */}
            <button
              onClick={optimizeSelected}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 text-sm font-black bg-white text-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-60"
            >
              {isOptimizing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              ) : '🤖'}
              {isOptimizing ? 'Анализирую...' : 'Оптимизировать (AI)'}
            </button>

            {/* Copy JSON */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(buildSelectionJSON(), null, 2));
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl transition-all"
              title="Скопировать данные выделенных уроков в JSON"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              JSON
            </button>

            {/* Clear selection */}
            <button
              onClick={() => setSelectedSlots(new Set())}
              className="flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white transition-colors px-2 py-1.5 rounded-xl hover:bg-white/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              Снять
            </button>
          </div>
        </div>
      )}

      {/* AI Optimize Result Modal */}
      {optimizeResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-foreground flex items-center gap-2">🤖 AI-Анализ выборки</h3>
                <button onClick={() => setOptimizeResult(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-xl p-4 border border-border font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                {optimizeResult}
              </div>
              <button
                onClick={() => { setOptimizeResult(null); setSelectedSlots(new Set()); }}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all"
              >
                Закрыть и снять выделение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Pocket (Буфер обмена) */}
      <div 
          className={`fixed bottom-6 right-6 z-50 bg-background/95 border border-primary/20 p-4 rounded-2xl shadow-2xl transition-all duration-300 w-80 flex flex-col gap-3 ${pocketItems.length > 0 ? 'translate-y-0 opacity-100 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'translate-y-0 opacity-80 hover:opacity-100'}`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={handlePocketDrop}
      >
          <div className="flex justify-between items-center mb-1">
             <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Карман (Буфер)
             </h3>
             <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{pocketItems.length} эл.</span>
          </div>
          
          <div className="min-h-[60px] border-2 border-dashed border-primary/20 rounded-xl p-2 flex flex-col gap-2 bg-muted/30">
              {pocketItems.length === 0 ? (
                 <div className="text-xs text-muted-foreground text-center my-auto px-4 opacity-60 font-medium">
                    Перетащите сюда урок, чтобы временно сохранить его («забрать»), а затем прокрутите до нужного учителя.
                 </div>
              ) : (
                 pocketItems.map(p => (
                   <div 
                     key={p.id}
                     draggable
                     onDragStart={(e) => handleDragStart(e, p)}
                     onDragEnd={() => setDraggedItem(null)}
                     className="w-full bg-primary/10 border border-primary/30 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex justify-between items-center"
                   >
                      <span className="font-bold text-xs text-primary leading-tight">{p.class_name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/80">{p.room_number}</span>
                   </div>
                 ))
              )}
          </div>
      </div>
      {/* ===== ALERT MODAL (replaces browser alert) ===== */}
      {alertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Top stripe by constraint type */}
            <div className={`h-1 w-full ${alertModal.constraint === 1 ? 'bg-rose-500' : alertModal.constraint === 2 ? 'bg-orange-500' : 'bg-amber-500'}`} />
            <div className="p-6 flex flex-col gap-4">
              {/* Icon + title */}
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm ${alertModal.constraint === 1 ? 'bg-rose-500' : alertModal.constraint === 2 ? 'bg-orange-500' : 'bg-amber-500'}`}>
                  🚫
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-foreground">{alertModal.title}</h3>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${alertModal.constraint === 1 ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : alertModal.constraint === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'}`}>
                      Констрейнт №{alertModal.constraint}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{alertModal.message}</p>
                </div>
              </div>
              {/* Explanation */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 border border-border">
                {alertModal.constraint === 1 && '⚙️ Констрейнт №1: Один учитель — один урок в одно время.'}
                {alertModal.constraint === 2 && '⚙️ Констрейнт №2: Один кабинет — один класс в одно время.'}
                {alertModal.constraint === 3 && '⚙️ Констрейнт №3: Один класс — один урок в одно время.'}
              </div>
              {/* Action */}
              <button
                onClick={() => setAlertModal(null)}
                className="w-full py-2.5 bg-foreground text-background rounded-xl text-sm font-black hover:opacity-90 transition-all"
                autoFocus
              >
                Понял, исправлю
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SMART SUBSTITUTION MODAL === */}
      {(isAnalyzing || substitutionModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-background w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-orange-500 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">🚨</div>
              <div>
                <h2 className="text-xl font-black text-white">Автозамена: Анализ Расписания</h2>
                <p className="text-white/80 text-sm">{substitutionModal?.teacher?.full_name} - {['','Пн','Вт','Ср','Чт','Пт'][selectedDay]}</p>
              </div>
              <button onClick={() => { setSickTeacherId(null); setSubstitutionModal(null); setIsAnalyzing(false); }} className="ml-auto text-white/70 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {isAnalyzing ? (
              <div className="p-12 flex flex-col items-center justify-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin absolute"></div>
                  <div className="w-10 h-10 border-4 border-rose-500/20 border-b-rose-500 rounded-full animate-spin absolute top-3 left-3" style={{animationDirection:'reverse',animationDuration:'0.8s'}}></div>
                </div>
                <p className="font-bold text-foreground text-center">Gemini AI сканирует Матрицу Констрейнтов...</p>
                <p className="text-sm text-muted-foreground text-center">Проверка нагрузки · Защита от выгорания · Ранжирование · Анализ Лент</p>
              </div>
            ) : substitutionModal && (
              <div className="p-5 max-h-[70vh] overflow-y-auto flex flex-col gap-4">

                {/* AI Summary Banner */}
                {substitutionModal.aiSummary && (
                  <div className="p-3 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/30 rounded-xl flex gap-3 items-center">
                    <span className="text-xl">🤖</span>
                    <p className="text-sm text-foreground font-medium italic">{substitutionModal.aiSummary}</p>
                  </div>
                )}

                {/* Lenta Global Warning */}
                {substitutionModal.isLenta && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl flex gap-3 items-start">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="font-black text-amber-600 dark:text-amber-400">Лента под угрозой!</h4>
                      <p className="text-sm text-muted-foreground mt-1">У этого учителя есть уроки-Ленты. Если замены нет — предлагаю объединить группы в актовом зале.</p>
                    </div>
                  </div>
                )}

                {/* Lesson Cards */}
                <div className="flex flex-col gap-3">
                  <h3 className="font-black text-foreground text-sm uppercase tracking-wider">Уроки для замены ({substitutionModal.candidatesPerLesson.length})</h3>
                  {substitutionModal.candidatesPerLesson.map(({ lesson, candidates, lentaWarning, emergencyMessage, noSubstitute }: any) => {
                    const chosen = substitutionModal.selectedSubstitutes[lesson.id];
                    const chosenTeacher = chosen ? teachers.find((t: any) => t.id === chosen) : null;
                    const bestCandidate = candidates?.[0];
                    const altCandidates = candidates?.slice(1);
                    return (
                      <div key={lesson.id} className={`rounded-xl border overflow-hidden transition-all ${chosen ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-border'}`}>
                        {/* Lesson Header */}
                        <div className={`flex items-center gap-3 px-4 py-3 ${chosen ? 'bg-emerald-500/5' : 'bg-muted/40'}`}>
                          <div>
                            <span className="text-xs font-bold text-muted-foreground">{lesson.time_slot}</span>
                            <p className="font-bold text-foreground leading-tight">{lesson.class_name}</p>
                          </div>
                          <div className="ml-auto text-right">
                            {chosen && chosenTeacher && (
                              <div>
                                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">✓ Замена назначена</span>
                                <p className="text-sm font-bold text-foreground">{chosenTeacher.full_name}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
                          {/* Lenta-specific warning */}
                          {lentaWarning && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">⚠️ {lentaWarning}</p>
                          )}
                          {/* Emergency message */}
                          {emergencyMessage && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">{emergencyMessage}</p>
                          )}

                          {noSubstitute ? (
                            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                              <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">🚫 Свободных замен нет. ИИ рекомендует: объединить группы в актовом зале.</p>
                            </div>
                          ) : candidates?.length > 0 && (
                            <div className="flex flex-col gap-2 mt-1">
                              {/* Best candidate (AI recommended) */}
                              {bestCandidate && (
                                <div>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">🤖 ИИ рекомендует</p>
                                  <button
                                    onClick={() => applySubstitution(lesson.id, bestCandidate.id)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${chosen === bestCandidate.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10'}`}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* TIER Badge */}
                                      <div className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                                        bestCandidate.tier === 1 ? 'bg-emerald-500 text-white' :
                                        bestCandidate.tier === 2 ? 'bg-blue-500 text-white' :
                                        bestCandidate.tier === 3 ? 'bg-slate-500 text-white' :
                                        'bg-orange-500 text-white'
                                      }`}>
                                        TIER {bestCandidate.tier ?? bestCandidate.priorityLevel ?? '?'}
                                      </div>
                                      {/* Zone badge */}
                                      <div className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide flex items-center gap-0.5 ${
                                        bestCandidate.zone === 'ЗЕЛЕНАЯ' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                        bestCandidate.zone === 'ОРАНЖЕВАЯ' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                                        'bg-red-500/20 text-red-600 dark:text-red-400'
                                      }`}>
                                        {bestCandidate.zone === 'ЗЕЛЕНАЯ' ? '🟢' : bestCandidate.zone === 'ОРАНЖЕВАЯ' ? '🟠' : '🔴'} {bestCandidate.zone ?? ''}
                                      </div>
                                      <span className="font-black text-sm text-foreground">{bestCandidate.full_name}</span>
                                      <span className="ml-auto text-[10px] text-muted-foreground">{bestCandidate.specialty}</span>
                                    </div>
                                    {bestCandidate.aiReason && (
                                      <p className="text-xs text-muted-foreground mt-1.5 italic leading-relaxed border-l-2 border-primary/30 pl-2">{bestCandidate.aiReason}</p>
                                    )}
                                    <div className="flex gap-3 mt-1.5 text-[10px] font-bold text-muted-foreground">
                                      <span>Нагрузка: {schedules.filter((s: any) => s.teacher_id === bestCandidate.id && s.day_of_week === selectedDay).length} ур./день</span>
                                      {bestCandidate.newLoad && <span className="text-emerald-500">После замены: {bestCandidate.newLoad} ур.</span>}
                                    </div>
                                  </button>
                                </div>
                              )}

                              {/* Alternatives */}
                              {altCandidates?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Альтернативы</p>
                                  <div className="flex flex-wrap gap-2">
                                    {altCandidates.map((c: any) => {
                                      const cnt = schedules.filter((s: any) => s.teacher_id === c.id && s.day_of_week === selectedDay).length;
                                      const zone = c.zone || (cnt <= 4 ? 'ЗЕЛЕНАЯ' : cnt <= 6 ? 'ОРАНЖЕВАЯ' : 'КРАСНАЯ');
                                      return (
                                        <button key={c.id} onClick={() => applySubstitution(lesson.id, c.id)}
                                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${chosen === c.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-card border-border hover:border-primary hover:bg-primary/5 text-foreground'}`}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[8px] font-black px-1 rounded ${c.tier === 1 ? 'bg-emerald-500/20 text-emerald-600' : c.tier === 2 ? 'bg-blue-500/20 text-blue-600' : 'bg-muted text-muted-foreground'}`}>T{c.tier ?? '?'}</span>
                                            <span className="text-[8px]">{zone === 'ЗЕЛЕНАЯ' ? '🟢' : zone === 'ОРАНЖЕВАЯ' ? '🟠' : '🔴'}</span>
                                            <span>{c.full_name}</span>
                                            <span className="opacity-50">({cnt}ур.)</span>
                                          </div>
                                          {c.aiReason && <span className="text-[9px] opacity-60 font-normal">{c.aiReason}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ERP — user-triggered maintenance task */}
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                  <h4 className="font-black text-purple-600 dark:text-purple-400 text-sm mb-2">🔧 ERP: Сообщить о проблеме</h4>
                  <p className="text-xs text-muted-foreground mb-3">Пока закрываете уроки — сообщите о технической проблеме. Система найдёт свободное окно у завхоза и отправит ему задачу.</p>
                  {!erpTaskSent ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={erpTaskInput}
                        onChange={e => setErpTaskInput(e.target.value)}
                        placeholder="Например: прорвало кран в туалете 3 этажа..."
                        className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 transition-all"
                      />
                      <button
                        onClick={() => {
                          if (!erpTaskInput.trim()) return;
                          setErpTaskSent(true);
                        }}
                        disabled={!erpTaskInput.trim()}
                        className="px-4 py-2 bg-purple-500 text-white rounded-xl text-xs font-black hover:bg-purple-600 transition-all disabled:opacity-40 whitespace-nowrap"
                      >
                        Отправить
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-xs font-black uppercase tracking-wider">Задача создана</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Задача: <strong>«{erpTaskInput}»</strong></p>
                      {substitutionModal.janitor ? (
                        <p className="text-xs text-muted-foreground">
                          {substitutionModal.janitor.full_name} — ближайшее окно: <strong className="text-purple-500">{substitutionModal.janitorFreeSlot || 'нет окна сегодня'}</strong>.
                          {substitutionModal.janitorFreeSlot && ' WhatsApp-уведомление отправлено.'}
                        </p>
                      ) : (
                        <p className="text-xs text-orange-500">Завхоз не найден в системе. Уведомьте вручную.</p>
                      )}
                      <button onClick={() => { setErpTaskInput(''); setErpTaskSent(false); }} className="self-start text-[10px] text-muted-foreground underline mt-1">Отправить другую задачу</button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-background/95 py-3">
                  <button onClick={() => { setSickTeacherId(null); setSubstitutionModal(null); }} className="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-muted-foreground hover:border-foreground transition-all">Отмена</button>
                  <button onClick={confirmSubstitutions} disabled={Object.keys(substitutionModal.selectedSubstitutes).length===0}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-black shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100">
                    ✅ Применить замены ({Object.keys(substitutionModal.selectedSubstitutes).length}/{substitutionModal.sickLessons.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
