import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Default config fallbacks
    const days = data.global_settings?.days || 5;
    const lessons = data.global_settings?.lessons || 8;
    
    const schedule: any[] = [];
    const grid: Record<string, boolean> = {}; // key: `${day}-${slot}-${type}-${id}`
    const teacherHours: Record<string, number> = {};

    const isBusy = (day: number, slot: number, eType: string, eId: string) => {
      return !!grid[`${day}-${slot}-${eType}-${eId}`];
    };

    const setBusy = (day: number, slot: number, eType: string, eId: string) => {
      grid[`${day}-${slot}-${eType}-${eId}`] = true;
    };

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

    // 1. Block Forbidden Slots
    if (Array.isArray(data.teachers)) {
      data.teachers.forEach((t: any) => {
        teacherHours[t.id] = 0;
        if (Array.isArray(t.forbiddenSlots)) {
          t.forbiddenSlots.forEach((slot: any) => {
            setBusy(slot.day, slot.lesson, 'teacher', t.id);
          });
        }
      });
    }

    const classes = data.classes || [];
    const teachers = data.teachers || [];
    const rooms = data.rooms || [];

    // 2. RIBBON ENGINE — Highest priority scheduling (Profile-based split streams)
    const ribbons = data.ribbons || [];
    
    ribbons.forEach((ribbon: any) => {
      const targetClassNames: string[] = ribbon.targetClasses || [];
      const profiles: any[] = ribbon.profiles || [];
      const hoursPerWeek: number = ribbon.hoursPerWeek || 2;

      // Find the class objects for this ribbon
      const targetClassObjs = classes.filter((c: any) => 
        targetClassNames.some((n: string) => c.name.trim() === n.trim())
      );
      if (targetClassObjs.length < 2 || profiles.length < 2) return;

      let hoursPlaced = 0;

      for (let d = 1; d <= days && hoursPlaced < hoursPerWeek; d++) {
        for (let l = 1; l <= lessons && hoursPlaced < hoursPerWeek; l++) {
          // RULE: Every target class must be free in this slot
          const allClassesFree = targetClassObjs.every((c: any) => !isBusy(d, l, 'class', c.id));
          if (!allClassesFree) continue;

          // For each profile, find a free teacher + free room
          const assignedProfiles: any[] = [];
          let canPlaceAll = true;

          for (const prof of profiles) {
            // Find a teacher who teaches this profile/subject and is free
            const profLower = prof.profile.toLowerCase();
            const candidateTeachers = teachers.filter((t: any) => {
              const teachesProfile = t.subjects.some((s: string) => {
                const sLow = s.toLowerCase();
                if (profLower.includes('физмат') || profLower.includes('физика') || profLower.includes('математ')) {
                  return sLow.includes('математ') || sLow.includes('физик') || sLow.includes('алгебр');
                }
                if (profLower.includes('химбио') || profLower.includes('хим') || profLower.includes('биол')) {
                  return sLow.includes('хими') || sLow.includes('биолог');
                }
                if (profLower.includes('гум') || profLower.includes('язык') || profLower.includes('истор') || profLower.includes('обществ')) {
                  return sLow.includes('русск') || sLow.includes('литера') || sLow.includes('истори') || sLow.includes('казах') || sLow.includes('английск') || sLow.includes('обществ');
                }
                // Fallback: keyword match
                return s.toLowerCase().includes(profLower.split(',')[0]);
              });
              return teachesProfile && !isBusy(d, l, 'teacher', t.id);
            });

            const freeRoom = rooms.find((r: any) => !isBusy(d, l, 'room', r.id));
            if (candidateTeachers.length === 0 || !freeRoom) { canPlaceAll = false; break; }

            // Pick the teacher with the least assigned hours (balance load)
            const teacher = candidateTeachers.sort((a: any, b: any) => (teacherHours[a.id] || 0) - (teacherHours[b.id] || 0))[0];
            assignedProfiles.push({ prof, teacher, room: freeRoom });
          }

          if (!canPlaceAll || assignedProfiles.length < profiles.length) continue;

          // Lock slots and push ribbon lessons
          // One lesson per profile group = one entry per profile with "(ЛЕНТА)" suffix per each class
          assignedProfiles.forEach(({ prof, teacher, room }) => {
            // Mark teacher and room busy
            setBusy(d, l, 'teacher', teacher.id);
            setBusy(d, l, 'room', room.id);
            teacherHours[teacher.id] = (teacherHours[teacher.id] || 0) + 1;

            // Each target class gets an entry for this ribbon slot
            targetClassObjs.forEach((cls: any) => {
              schedule.push({
                id: `ribbon-${ribbon.id}-${cls.id}-${prof.profile}-d${d}l${l}`,
                type: 'ribbon',
                day_of_week: d,
                time_slot: TIME_SLOTS[l - 1] || TIME_SLOTS[0],
                class_name: cls.name + ` [ЛЕНТА → ${prof.profile}]`,
                subject: prof.profile,
                teacher_id: teacher.id,
                teacher_name: teacher.name,
                room_number: room.name,
                is_lenta: true,
                ribbon_profile: prof.profile,
              });
            });
          });

          // Block the slot for ALL target classes
          targetClassObjs.forEach((cls: any) => {
            setBusy(d, l, 'class', cls.id);
          });

          hoursPlaced++;
        }
      }
    });

    // 2b. Legacy Parallel English Lenta (auto-detect, for backward compat)
    // Group classes by parallel
    const parallels: Record<string, any[]> = {};
    classes.forEach((c: any) => {
      const p = c.parallel;
      if (!parallels[p]) parallels[p] = [];
      parallels[p].push(c);
    });

    Object.keys(parallels).forEach(pKey => {
      const pClasses = parallels[pKey];
      if (pClasses.length < 2) return; // Need at least 2 classes for a Lenta
      
      const reqLentaHours = pClasses[0].curriculum?.find((c:any) => c.subject === 'Английский язык')?.hours || 0;
      if (reqLentaHours <= 0) return;

      const engTeachers = teachers.filter((t: any) => t.subjects.includes("Английский язык") || t.subjects.includes("Английский"));
      const engRooms = rooms.filter((r: any) => r.type === 'Лингафонный' || r.type === 'english' || r.type === 'Обычный');

      let hoursPlaced = 0;
      for (let d = 1; d <= days; d++) {
        for (let l = 1; l <= lessons; l++) {
          if (hoursPlaced >= reqLentaHours) break;

          const classesFree = pClasses.every(c => !isBusy(d, l, 'class', c.id));
          const reqTCount = pClasses.length;
          
          if (classesFree && engTeachers.length >= reqTCount && engRooms.length >= reqTCount) {
             const availableT = engTeachers.filter(t => !isBusy(d, l, 'teacher', t.id)).slice(0, reqTCount);
             const availableR = engRooms.filter(r => !isBusy(d, l, 'room', r.id)).slice(0, reqTCount);

             if (availableT.length >= reqTCount && availableR.length >= reqTCount) {
               pClasses.forEach((cls, idx) => {
                  const t = availableT[idx];
                  const r = availableR[idx];
                  
                  schedule.push({
                     id: `${cls.id}-${t.id}-lenta-${Date.now()}-${idx}`,
                     type: 'lesson',
                     day_of_week: d,
                     time_slot: TIME_SLOTS[l - 1] || TIME_SLOTS[0],
                     class_name: cls.name + ' (ЛЕНТА)',
                     subject: 'Английский язык',
                     teacher_id: t.id,
                     teacher_name: t.name,
                     room_number: r.name,
                     is_lenta: true
                  });
                  setBusy(d, l, 'class', cls.id);
                  setBusy(d, l, 'teacher', t.id);
                  setBusy(d, l, 'room', r.id);
                  teacherHours[t.id] = (teacherHours[t.id] || 0) + 1;
                  
                  // Decrease curriculum requirement
                  const currItem = cls.curriculum.find((c:any) => c.subject === 'Английский язык' || c.subject === 'Английский');
                  if (currItem) currItem.hours -= 1;
               });
               hoursPlaced++;
             }
          }
        }
      }
    });

    // 3. Assign Standard Curriculum — ROUND-ROBIN DAY BALANCER
    // Track per-class lesson count per day so we can distribute evenly
    const classDay: Record<string, Record<number, number>> = {};
    const getClassDayLoad = (clsId: string, d: number) => (classDay[clsId]?.[d] ?? 0);
    const incClassDay = (clsId: string, d: number) => {
      if (!classDay[clsId]) classDay[clsId] = {};
      classDay[clsId][d] = (classDay[clsId][d] ?? 0) + 1;
    };

    classes.forEach((cls: any) => {
      const curriculum = cls.curriculum || [];

      // Flatten: all lesson-hours into a list (Math×4 = [Math,Math,Math,Math])
      const lessonQueue: string[] = [];
      curriculum.forEach((item: any) => {
        for (let i = 0; i < item.hours; i++) lessonQueue.push(item.subject);
      });

      // Interleave subjects for even daily distribution: sort queue by day pressure
      for (const subject of lessonQueue) {
        // Pick teacher: least-loaded eligible
        const eligibleT = teachers
          .filter((t: any) => t.subjects.includes(subject) && (teacherHours[t.id] || 0) < t.maxLoad)
          .sort((a: any, b: any) => (teacherHours[a.id] || 0) - (teacherHours[b.id] || 0));

        if (eligibleT.length === 0) continue;
        const t = eligibleT[0];

        // Room type preference
        let roomType = 'Обычный';
        if (subject.toLowerCase().includes('физкультура')) roomType = 'Спортзал';
        else if (subject.toLowerCase().includes('химия') || subject.toLowerCase().includes('физика')) roomType = 'Лаборатория';
        else if (subject.toLowerCase().includes('информатика')) roomType = 'Информатика';

        const eligibleR = rooms.filter((r: any) => r.type === roomType || r.type === 'Обычный');

        // Sort days ascending by class load (prefer least-loaded days first)
        const dayOrder = Array.from({ length: days }, (_, i) => i + 1)
          .sort((a, b) => getClassDayLoad(cls.id, a) - getClassDayLoad(cls.id, b));

        let placed = false;
        for (const d of dayOrder) {
          // Try slots 1..min(lessons,6) — prefer early slots (max урок 6)
          const maxSlot = Math.min(lessons, 6);
          for (let l = 1; l <= maxSlot; l++) {
            if (!isBusy(d, l, 'class', cls.id) && !isBusy(d, l, 'teacher', t.id)) {
              const freeR = eligibleR.find(r => !isBusy(d, l, 'room', r.id));
              if (freeR) {
                schedule.push({
                  id: `${cls.id}-${t.id}-std-${d}-${l}-${subject}`,
                  type: 'lesson',
                  day_of_week: d,
                  time_slot: TIME_SLOTS[l - 1] || TIME_SLOTS[0],
                  class_name: cls.name,
                  subject,
                  teacher_id: t.id,
                  teacher_name: t.name,
                  room_number: freeR.name,
                  is_lenta: false,
                });
                setBusy(d, l, 'class', cls.id);
                setBusy(d, l, 'teacher', t.id);
                setBusy(d, l, 'room', freeR.id);
                teacherHours[t.id] = (teacherHours[t.id] || 0) + 1;
                incClassDay(cls.id, d);
                placed = true;
                break;
              }
            }
          }
          if (placed) break;
        }
      }
    });



    // 4. Assign Staff (Fixed Tasks)
    const staffList = data.staff || [];
    staffList.forEach((staff: any) => {
       if (Array.isArray(staff.fixedTasks)) {
          staff.fixedTasks.forEach((task: any) => {
             schedule.push({
                id: `${staff.id}-task-${Date.now()}`,
                type: 'task',
                day_of_week: task.day,
                time_slot: TIME_SLOTS[task.lesson - 1] || TIME_SLOTS[0],
                teacher_id: staff.id,
                teacher_name: staff.name,
                class_name: 'ЗАДАЧА: ' + task.task,
                is_lenta: false
             });
          });
       }
    });

    return NextResponse.json({ schedule: schedule, metrics: { total: schedule.length } });
  } catch (error: any) {
    console.error('Core Generator Error:', error);
    return NextResponse.json({ error: 'Generation Engine Error: ' + error.message }, { status: 500 });
  }
}
