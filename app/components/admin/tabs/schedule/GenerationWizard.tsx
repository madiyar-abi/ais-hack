'use client';
import React, { useState } from 'react';

// --- INLINE ICONS ---
const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// --- TYPES ---
type TimeGrid = { days: number; lessons: number };
type Room = { id: string; name: string; capacity: number; type: string };
type ForbiddenSlot = { day: number; lesson: number };
type Teacher = { id: string; name: string; subjects: string[]; maxLoad: number; forbiddenSlots: ForbiddenSlot[] };
type CurriculumItem = { subject: string; hours: number };
type ClassGroup = { id: string; name: string; parallel: string; students: number; curriculum: CurriculumItem[] };
type Staff = { id: string; name: string; role: string; workHours: number };
type RibbonProfile = { profile: string; subjectHint: string };
type Ribbon = { id: string; targetClasses: string[]; profiles: RibbonProfile[]; hoursPerWeek: number; };

type WizardProps = {
  onApply: (newSchedules: any[], generatedTeachers?: any[], mergeMode?: boolean) => void;
  onCancel: () => void;
};

export default function GenerationWizard({ onApply, onCancel }: WizardProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // --- STATE CORE ---
  const [timeGrid, setTimeGrid] = useState<TimeGrid>({ days: 5, lessons: 8 });

  // 1. Rooms
  const [rooms, setRooms] = useState<Room[]>([
    { id: '1', name: '101', capacity: 30, type: 'Обычный' },
    { id: '2', name: 'Спортзал', capacity: 60, type: 'Спортзал' }
  ]);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: 30, type: 'Обычный' });

  // 2. Teachers
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newTeacher, setNewTeacher] = useState({ name: '', subjects: '', maxLoad: 6 });

  // 3. Classes
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [newClass, setNewClass] = useState({ name: '', parallel: '9', students: 30 });
  const [newCurriculumSubject, setNewCurriculumSubject] = useState<{classId: string, subject: string, hours: number}>({ classId: '', subject: '', hours: 1 });

  // 4. Staff
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Завхоз', workHours: 8 });

  // 5. Ribbons (Профильные Ленты)
  const [ribbonList, setRibbonList] = useState<Ribbon[]>([]);
  const [newRibbon, setNewRibbon] = useState({ targetClassesRaw: '', profilesRaw: 'Физмат,Химбио,Гуманитарный', hoursPerWeek: 2 });

  const handleAddRibbon = () => {
    const classes = newRibbon.targetClassesRaw.split(',').map(s => s.trim()).filter(Boolean);
    const profiles = newRibbon.profilesRaw.split(',').map(s => s.trim()).filter(Boolean).map(p => ({ profile: p, subjectHint: p }));
    if (classes.length < 2 || profiles.length < 2) return;
    setRibbonList(prev => [...prev, { id: Date.now().toString(), targetClasses: classes, profiles, hoursPerWeek: newRibbon.hoursPerWeek }]);
    setNewRibbon({ targetClassesRaw: '', profilesRaw: 'Физмат,Химбио,Гуманитарный', hoursPerWeek: 2 });
  };
  const handleRemoveRibbon = (id: string) => setRibbonList(prev => prev.filter(r => r.id !== id));

  // ── DEMO DATA (Quick Fill for Testing) ────────────────────────────
  const loadDemoData = () => {
    setTimeGrid({ days: 5, lessons: 7 });

    setRooms([
      { id: 'd-r1',  name: '101',      capacity: 32, type: 'Обычный' },
      { id: 'd-r2',  name: '102',      capacity: 32, type: 'Обычный' },
      { id: 'd-r3',  name: '103',      capacity: 32, type: 'Обычный' },
      { id: 'd-r4',  name: '104',      capacity: 30, type: 'Обычный' },
      { id: 'd-r5',  name: '105',      capacity: 30, type: 'Обычный' },
      { id: 'd-r6',  name: '106',      capacity: 30, type: 'Обычный' },
      { id: 'd-r7',  name: '201',      capacity: 30, type: 'Обычный' },
      { id: 'd-r8',  name: '202',      capacity: 30, type: 'Обычный' },
      { id: 'd-r9',  name: '203',      capacity: 30, type: 'Обычный' },
      { id: 'd-r10', name: 'Лаб Хим',  capacity: 24, type: 'Лаборатория' },
      { id: 'd-r11', name: 'Лаб Физ',  capacity: 24, type: 'Лаборатория' },
      { id: 'd-r12', name: 'Спортзал', capacity: 80, type: 'Спортзал' },
      { id: 'd-r13', name: 'Инфо-А',   capacity: 26, type: 'Информатика' },
      { id: 'd-r14', name: 'Инфо-Б',   capacity: 26, type: 'Информатика' },
      { id: 'd-r15', name: 'Лингаф',   capacity: 26, type: 'Обычный' },
    ]);

    setTeachers([
      { id: 'd-t1',  name: 'Иванов А.А.',      subjects: ['Математика', 'Алгебра', 'Геометрия'], maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t2',  name: 'Ким Б.Б.',          subjects: ['Математика', 'Алгебра'],              maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t3',  name: 'Орлова В.В.',       subjects: ['Математика', 'Геометрия'],            maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t4',  name: 'Петрова Г.Г.',      subjects: ['Физика'],                             maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t5',  name: 'Серов Д.Д.',        subjects: ['Физика'],                             maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t6',  name: 'Смирнова Е.Е.',     subjects: ['Химия', 'Биология'],                  maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t7',  name: 'Кузова Ж.Ж.',       subjects: ['Биология', 'Химия'],                  maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t8',  name: 'Карпова З.З.',      subjects: ['Русский язык', 'Литература'],         maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t9',  name: 'Лебедь И.И.',       subjects: ['Русский язык', 'Литература'],         maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t10', name: 'Алиев К.К.',        subjects: ['История', 'Обществознание'],          maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t11', name: 'Нурова Л.Л.',       subjects: ['История', 'Обществознание'],          maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t12', name: 'Попова М.М.',       subjects: ['Английский язык'],                    maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t13', name: 'Садыков Н.Н.',      subjects: ['Английский язык'],                    maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t14', name: 'Жаксыбеков О.О.',   subjects: ['Физкультура'],                        maxLoad: 10, forbiddenSlots: [] },
      { id: 'd-t15', name: 'Байтасов П.П.',     subjects: ['Физкультура'],                        maxLoad: 10, forbiddenSlots: [] },
      { id: 'd-t16', name: 'Байсеитова Р.Р.',   subjects: ['Информатика'],                        maxLoad: 6, forbiddenSlots: [] },
      { id: 'd-t17', name: 'Ахметова С.С.',     subjects: ['Казахский язык'],                     maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t18', name: 'Досова Т.Т.',       subjects: ['Казахский язык'],                     maxLoad: 7, forbiddenSlots: [] },
      { id: 'd-t19', name: 'Ермеков У.У.',      subjects: ['География', 'Экономика'],             maxLoad: 5, forbiddenSlots: [] },
    ]);

    const cp = (plan: any[]) => JSON.parse(JSON.stringify(plan));

    const c7  = [
      { subject: 'Математика',      hours: 5 }, { subject: 'Русский язык',    hours: 3 },
      { subject: 'Литература',      hours: 2 }, { subject: 'Казахский язык',  hours: 3 },
      { subject: 'История',         hours: 2 }, { subject: 'Английский язык', hours: 2 },
      { subject: 'Биология',        hours: 2 }, { subject: 'География',       hours: 2 },
      { subject: 'Физкультура',     hours: 2 }, { subject: 'Информатика',     hours: 1 },
    ];
    const c8  = [
      { subject: 'Математика',      hours: 5 }, { subject: 'Русский язык',    hours: 3 },
      { subject: 'Литература',      hours: 2 }, { subject: 'Казахский язык',  hours: 3 },
      { subject: 'История',         hours: 2 }, { subject: 'Английский язык', hours: 2 },
      { subject: 'Химия',           hours: 2 }, { subject: 'Физика',          hours: 2 },
      { subject: 'Физкультура',     hours: 2 }, { subject: 'Информатика',     hours: 1 },
    ];
    const c9  = [
      { subject: 'Математика',      hours: 5 }, { subject: 'Русский язык',    hours: 2 },
      { subject: 'Литература',      hours: 2 }, { subject: 'Казахский язык',  hours: 2 },
      { subject: 'История',         hours: 2 }, { subject: 'Обществознание',  hours: 1 },
      { subject: 'Английский язык', hours: 2 }, { subject: 'Химия',           hours: 2 },
      { subject: 'Физика',          hours: 2 }, { subject: 'Биология',        hours: 1 },
      { subject: 'Физкультура',     hours: 2 }, { subject: 'Информатика',     hours: 1 },
    ];
    const c10 = [
      { subject: 'Математика',      hours: 4 }, { subject: 'Русский язык',    hours: 2 },
      { subject: 'Литература',      hours: 1 }, { subject: 'Казахский язык',  hours: 2 },
      { subject: 'История',         hours: 2 }, { subject: 'Обществознание',  hours: 1 },
      { subject: 'Английский язык', hours: 2 }, { subject: 'Химия',           hours: 2 },
      { subject: 'Физика',          hours: 2 }, { subject: 'Биология',        hours: 1 },
      { subject: 'Физкультура',     hours: 2 }, { subject: 'Информатика',     hours: 1 },
    ];
    const c11 = [
      { subject: 'Математика',      hours: 4 }, { subject: 'Русский язык',    hours: 2 },
      { subject: 'Литература',      hours: 1 }, { subject: 'Казахский язык',  hours: 2 },
      { subject: 'История',         hours: 2 }, { subject: 'Обществознание',  hours: 1 },
      { subject: 'Английский язык', hours: 2 }, { subject: 'Химия',           hours: 2 },
      { subject: 'Физика',          hours: 2 }, { subject: 'Биология',        hours: 1 },
      { subject: 'Физкультура',     hours: 2 }, { subject: 'Экономика',       hours: 1 },
    ];

    setClassesList([
      { id: 'd-c1',  name: '7А',  parallel: '7',  students: 30, curriculum: cp(c7)  },
      { id: 'd-c2',  name: '7Б',  parallel: '7',  students: 29, curriculum: cp(c7)  },
      { id: 'd-c3',  name: '8А',  parallel: '8',  students: 31, curriculum: cp(c8)  },
      { id: 'd-c4',  name: '8Б',  parallel: '8',  students: 30, curriculum: cp(c8)  },
      { id: 'd-c5',  name: '9А',  parallel: '9',  students: 29, curriculum: cp(c9)  },
      { id: 'd-c6',  name: '9Б',  parallel: '9',  students: 28, curriculum: cp(c9)  },
      { id: 'd-c7',  name: '10А', parallel: '10', students: 27, curriculum: cp(c10) },
      { id: 'd-c8',  name: '10Б', parallel: '10', students: 26, curriculum: cp(c10) },
      { id: 'd-c9',  name: '11А', parallel: '11', students: 25, curriculum: cp(c11) },
      { id: 'd-c10', name: '11Б', parallel: '11', students: 24, curriculum: cp(c11) },
    ]);

    setRibbonList([
      {
        id: 'd-rib10',
        targetClasses: ['10А', '10Б'],
        profiles: [
          { profile: 'Физмат',       subjectHint: 'Физмат' },
          { profile: 'Химбио',       subjectHint: 'Химбио' },
          { profile: 'Гуманитарный', subjectHint: 'Гуманитарный' },
        ],
        hoursPerWeek: 2,
      },
      {
        id: 'd-rib11',
        targetClasses: ['11А', '11Б'],
        profiles: [
          { profile: 'Физмат',       subjectHint: 'Физмат' },
          { profile: 'Химбио',       subjectHint: 'Химбио' },
          { profile: 'Гуманитарный', subjectHint: 'Гуманитарный' },
        ],
        hoursPerWeek: 2,
      },
    ]);

    setStaffList([]);
  };

  // ── STRESS TEST (10 классов, 6 уроков в день, ленты) ──────────────
  const loadStressTestData = () => {
    setTimeGrid({ days: 5, lessons: 6 });

    // 15 обычных + спецкабинетов = всегда есть свободный кабинет
    setRooms(Array.from({ length: 15 }, (_, i) => ({
      id: `s-r${i + 1}`,
      name: `${200 + i + 1}`,
      capacity: 32,
      type: 'Обычный',
    })).concat([
      { id: 's-rsp', name: 'Спортзал', capacity: 80, type: 'Спортзал' },
      { id: 's-rl1', name: 'Лаб-1',    capacity: 26, type: 'Лаборатория' },
    ]));

    // Учителя с высоким maxLoad чтобы покрыть 10 классов × ~6ч = ~60ч на предмет
    setTeachers([
      { id: 's-t1',  name: 'Иванов А.',  subjects: ['Математика'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t2',  name: 'Петров Б.',  subjects: ['Математика'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t3',  name: 'Сидоров В.',  subjects: ['Математика'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t4',  name: 'Козлова Г.',   subjects: ['Русский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t5',  name: 'Кузнецов Д.',subjects: ['Русский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t6',  name: 'Львова Е.',   subjects: ['Русский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t7',  name: 'Волков Ж.',   subjects: ['Английский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t8',  name: 'Быкова З.',   subjects: ['Английский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t9',  name: 'Грецов И.',   subjects: ['Английский язык'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t10', name: 'Дорохова К.',subjects: ['Физика'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t11', name: 'Ермилов Л.',  subjects: ['Физика'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t12', name: 'Железнов М.', subjects: ['История'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t13', name: 'Зайцева Н.',  subjects: ['История'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t14', name: 'Иванова О.', subjects: ['Физкультура'], maxLoad: 35, forbiddenSlots: [] },
      { id: 's-t15', name: 'Карашов П.', subjects: ['Физкультура'], maxLoad: 35, forbiddenSlots: [] },
      // Лента-учителя (Физмат / Химбио / Гум)
      { id: 's-t16', name: 'Лента-Физмат', subjects: ['Физмат'], maxLoad: 10, forbiddenSlots: [] },
      { id: 's-t17', name: 'Лента-Химбио',  subjects: ['Химбио'],  maxLoad: 10, forbiddenSlots: [] },
      { id: 's-t18', name: 'Лента-Гум',    subjects: ['Гуманитарный'], maxLoad: 10, forbiddenSlots: [] },
    ]);

    // 5 дней × 6 уроков = 30ч на неделю. Для ленточных классов: 28 + 2 лента = 30
    const base30 = [
      { subject: 'Математика',      hours: 8 },
      { subject: 'Русский язык',    hours: 7 },
      { subject: 'Английский язык', hours: 7 },
      { subject: 'Физика',          hours: 5 },
      { subject: 'История',          hours: 2 },
      { subject: 'Физкультура',     hours: 1 },
    ]; // итого: 8+7+7+5+2+1 = 30

    // Для классов с лентой: -2 из Английского (2ч занята лентой) → 28 станд. + 2 лента = 30
    const base28 = [
      { subject: 'Математика',      hours: 8 },
      { subject: 'Русский язык',    hours: 7 },
      { subject: 'Английский язык', hours: 5 },
      { subject: 'Физика',          hours: 5 },
      { subject: 'История',          hours: 2 },
      { subject: 'Физкультура',     hours: 1 },
    ]; // итого: 28

    const cp = (p: any[]) => JSON.parse(JSON.stringify(p));

    setClassesList([
      { id: 's-c1',  name: '7А',  parallel: '7',  students: 30, curriculum: cp(base30) },
      { id: 's-c2',  name: '7Б',  parallel: '7',  students: 30, curriculum: cp(base30) },
      { id: 's-c3',  name: '8А',  parallel: '8',  students: 30, curriculum: cp(base30) },
      { id: 's-c4',  name: '8Б',  parallel: '8',  students: 30, curriculum: cp(base30) },
      { id: 's-c5',  name: '9А',  parallel: '9',  students: 30, curriculum: cp(base30) },
      { id: 's-c6',  name: '9Б',  parallel: '9',  students: 30, curriculum: cp(base30) },
      { id: 's-c7',  name: '10А', parallel: '10', students: 30, curriculum: cp(base28) },
      { id: 's-c8',  name: '10Б', parallel: '10', students: 30, curriculum: cp(base28) },
      { id: 's-c9',  name: '11А', parallel: '11', students: 30, curriculum: cp(base28) },
      { id: 's-c10', name: '11Б', parallel: '11', students: 30, curriculum: cp(base28) },
    ]);

    setRibbonList([
      {
        id: 's-rib10',
        targetClasses: ['10А', '10Б'],
        profiles: [
          { profile: 'Физмат',       subjectHint: 'Физмат' },
          { profile: 'Химбио',       subjectHint: 'Химбио' },
          { profile: 'Гуманитарный', subjectHint: 'Гуманитарный' },
        ],
        hoursPerWeek: 2,
      },
      {
        id: 's-rib11',
        targetClasses: ['11А', '11Б'],
        profiles: [
          { profile: 'Физмат',       subjectHint: 'Физмат' },
          { profile: 'Химбио',       subjectHint: 'Химбио' },
          { profile: 'Гуманитарный', subjectHint: 'Гуманитарный' },
        ],
        hoursPerWeek: 2,
      },
    ]);

    setStaffList([]);
  };

  // --- HANDLERS ---
  const handleAddRoom = () => {
    if (!newRoom.name) return;
    setRooms([...rooms, { id: Date.now().toString(), ...newRoom }]);
    setNewRoom({ name: '', capacity: 30, type: 'Обычный' });
  };
  const handleRemoveRoom = (id: string) => setRooms(rooms.filter(r => r.id !== id));

  const handleAddTeacher = () => {
    if (!newTeacher.name || !newTeacher.subjects) return;
    const subjArray = newTeacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
    setTeachers([...teachers, { id: Date.now().toString(), name: newTeacher.name, subjects: subjArray, maxLoad: newTeacher.maxLoad, forbiddenSlots: [] }]);
    setNewTeacher({ name: '', subjects: '', maxLoad: 6 });
  };
  const handleRemoveTeacher = (id: string) => setTeachers(teachers.filter(t => t.id !== id));
  
  const toggleForbiddenSlot = (teacherId: string, day: number, lesson: number) => {
    setTeachers(prev => prev.map(t => {
      if (t.id !== teacherId) return t;
      const isForbidden = t.forbiddenSlots.some(s => s.day === day && s.lesson === lesson);
      return {
        ...t,
        forbiddenSlots: isForbidden 
          ? t.forbiddenSlots.filter(s => !(s.day === day && s.lesson === lesson))
          : [...t.forbiddenSlots, { day, lesson }]
      };
    }));
  };

  const handleAddClass = () => {
    if (!newClass.name) return;
    setClassesList([...classesList, { id: Date.now().toString(), name: newClass.name, parallel: newClass.parallel, students: newClass.students, curriculum: [] }]);
    setNewClass({ name: '', parallel: '9', students: 30 });
  };
  const handleRemoveClass = (id: string) => setClassesList(classesList.filter(c => c.id !== id));
  const handleAddCurriculum = (classId: string) => {
    if (!newCurriculumSubject.subject) return;
    setClassesList(prev => prev.map(c => {
      if (c.id !== classId) return c;
      return { ...c, curriculum: [...c.curriculum, { subject: newCurriculumSubject.subject, hours: newCurriculumSubject.hours }] };
    }));
    setNewCurriculumSubject({ classId: '', subject: '', hours: 1 });
  };

  const handleAddStaff = () => {
    if (!newStaff.name) return;
    setStaffList([...staffList, { id: Date.now().toString(), ...newStaff }]);
    setNewStaff({ name: '', role: 'Завхоз', workHours: 8 });
  };
  const [generateError, setGenerateError] = useState("");
  const [mergeMode, setMergeMode] = useState(false);

  const handleGenerateClick = async () => {
    setIsGenerating(true);
    setGenerateError("");
    
    // Assemble the gigantic JSON object
    const finalPayload = {
      global_settings: timeGrid,
      rooms,
      teachers,
      classes: classesList,
      staff: staffList,
      ribbons: ribbonList,
    };

    console.log("🚀 [AI GENERATION PAYLOAD STARTING FETCH...]", finalPayload);

    try {
       const res = await fetch('/api/schedule/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload)
       });
       if (!res.ok) throw new Error('Сбой генерации на стороне сервера');
       
       const data = await res.json();
       console.log("✅ [GENERATED SCHEDULE RECEIVED]", data.schedule);
       
       // Pass genuine generated array back to parent SmartScheduleClient
       onApply(data.schedule || [], teachers, mergeMode); 
    } catch (err) {
       console.error(err);
       setGenerateError("Ошибка генерации алгоритма. Проверьте параметры.");
    } finally {
       setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <span className="text-primary text-3xl">🧩</span> ERP Мастер Сборки
          </h2>
          <p className="text-muted-foreground text-sm font-medium">Сконфигурируйте NP-трудные параметры для передачи в алгоритмическое Python-ядро.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
            title="Обычный демо-шаблон"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Быстрый старт
          </button>
          <button
            onClick={loadStressTestData}
            className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
            title="10 классов, 6 уроков в день, ленты"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
            Полная загрузка
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* 1. TIME GRID */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
           <h3 className="text-sm uppercase tracking-widest font-black text-muted-foreground mb-4">⏱️ Сетка времени</h3>
           <div className="grid sm:grid-cols-2 gap-4">
              <div>
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Учебные дни (в неделю)</label>
                 <select className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary"
                    value={timeGrid.days} onChange={e => setTimeGrid({...timeGrid, days: Number(e.target.value)})}>
                    <option value={5}>5 Дней (Пн-Пт)</option>
                    <option value={6}>6 Дней (Пн-Сб)</option>
                 </select>
              </div>
              <div>
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Макс. уроков в день</label>
                 <input type="number" min="4" max="10" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary"
                    value={timeGrid.lessons} onChange={e => setTimeGrid({...timeGrid, lessons: Number(e.target.value)})} />
              </div>
           </div>
        </div>

        {/* 2. ROOMS */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
           <h3 className="text-sm uppercase tracking-widest font-black text-muted-foreground mb-4">🏫 Кабинеты ({rooms.length})</h3>
           <div className="flex flex-wrap gap-2 mb-4">
              {rooms.map(room => (
                 <div key={room.id} className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg text-sm">
                    <span className="font-bold">{room.name}</span>
                    <span className="text-xs text-muted-foreground">({room.capacity} чел, {room.type})</span>
                    <button onClick={() => handleRemoveRoom(room.id)} className="text-rose-500 hover:text-rose-600"><TrashIcon className="w-4 h-4" /></button>
                 </div>
              ))}
           </div>
           
           <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Название / Номер</label>
                 <input className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Коб 101" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} />
              </div>
              <div className="w-full sm:w-24">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Вместимость</label>
                 <input type="number" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: Number(e.target.value)})} />
              </div>
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Тип специализации</label>
                 <select className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                    <option>Обычный</option><option>Лаборатория</option><option>Спортзал</option><option>Информатика</option><option>Лингафонный</option>
                 </select>
              </div>
              <button onClick={handleAddRoom} className="p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-colors"><PlusIcon className="w-5 h-5" /></button>
           </div>
        </div>

        {/* 3. TEACHERS & CONSTRAINTS */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
           <h3 className="text-sm uppercase tracking-widest font-black text-muted-foreground mb-4">👥 Учителя и Ограничения ({teachers.length})</h3>
           
           <div className="space-y-4 mb-6">
              {teachers.map(teacher => (
                 <div key={teacher.id} className="border border-border rounded-xl overflow-hidden bg-background">
                    <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border">
                       <div>
                          <p className="font-bold">{teacher.name} <span className="text-xs font-normal text-muted-foreground bg-border px-2 py-0.5 rounded ml-2">Нагрузка: до {teacher.maxLoad} час/день</span></p>
                          <p className="text-xs text-primary mt-1 font-medium">{teacher.subjects.join(', ')}</p>
                       </div>
                       <button onClick={() => handleRemoveTeacher(teacher.id)} className="text-rose-500 p-2"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                    {/* Time Grid Matrix */}
                    <div className="p-4 overflow-x-auto">
                       <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-3 h-3 block bg-rose-500 rounded-sm"></span> Кликните на ячейку, чтобы запретить урок
                       </p>
                       <div className="flex gap-2 min-w-max">
                          {Array.from({ length: timeGrid.days }).map((_, dIdx) => {
                             const dayNum = dIdx + 1;
                             const dayNames = ["Пн", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                             return (
                                <div key={dIdx} className="flex flex-col gap-1 w-12">
                                   <div className="text-[10px] text-center font-bold text-muted-foreground uppercase">{dayNames[dIdx]}</div>
                                   {Array.from({ length: timeGrid.lessons }).map((_, lIdx) => {
                                      const lesNum = lIdx + 1;
                                      const isForbidden = teacher.forbiddenSlots.some(s => s.day === dayNum && s.lesson === lesNum);
                                      return (
                                         <button 
                                            key={lesNum} 
                                            onClick={() => toggleForbiddenSlot(teacher.id, dayNum, lesNum)}
                                            className={`h-8 w-full rounded border text-[10px] font-bold transition-colors ${isForbidden ? 'bg-rose-500 border-rose-600 shadow-inner' : 'bg-background hover:bg-muted border-border text-muted-foreground/30'}`}
                                         >
                                            {isForbidden ? 'X' : lesNum}
                                         </button>
                                      )
                                   })}
                                </div>
                             )
                          })}
                       </div>
                    </div>
                 </div>
              ))}
           </div>

           <div className="flex flex-col sm:flex-row gap-3 items-end p-4 border border-dashed border-primary/30 bg-primary/5 rounded-xl">
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">ФИО Учителя</label>
                 <input className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Иванов И. И." value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} />
              </div>
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Предметы (через запятую)</label>
                 <input className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Математика, Алгебра" value={newTeacher.subjects} onChange={e => setNewTeacher({...newTeacher, subjects: e.target.value})} />
              </div>
              <div className="w-full sm:w-24">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Макс. нагр.</label>
                 <input type="number" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newTeacher.maxLoad} onChange={e => setNewTeacher({...newTeacher, maxLoad: Number(e.target.value)})} />
              </div>
              <button onClick={handleAddTeacher} className="p-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-colors whitespace-nowrap px-4 font-bold h-[38px] w-full sm:w-auto">Добавить</button>
           </div>
        </div>

        {/* 4. CLASSES & CURRICULUM */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
           <h3 className="text-sm uppercase tracking-widest font-black text-muted-foreground mb-4">📚 Классы и Нагрузка ({classesList.length})</h3>
           
           <div className="grid md:grid-cols-2 gap-4 mb-6">
              {classesList.map((cls) => (
                 <div key={cls.id} className="border border-border rounded-xl p-4 bg-muted/10 relative">
                    <button onClick={() => handleRemoveClass(cls.id)} className="absolute top-2 right-2 text-rose-500"><TrashIcon className="w-4 h-4" /></button>
                    <div className="font-black text-lg text-foreground flex items-center gap-2">
                       {cls.name} <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Параллель: {cls.parallel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">Учеников: {cls.students}</p>
                    
                    <div className="space-y-1 mb-3">
                       {cls.curriculum.map((c, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-background border border-border px-2 py-1 rounded text-xs">
                             <span className="font-semibold">{c.subject}</span>
                             <span>{c.hours} ч.</span>
                          </div>
                       ))}
                    </div>

                    {/* Add Curriculum Row */}
                    {newCurriculumSubject.classId === cls.id ? (
                       <div className="flex gap-1 animate-in fade-in zoom-in-95">
                          <input className="w-full bg-background border border-border rounded text-xs px-2 py-1" placeholder="Предмет..." value={newCurriculumSubject.subject} onChange={e => setNewCurriculumSubject({...newCurriculumSubject, subject: e.target.value})} autoFocus />
                          <input type="number" min="1" className="w-16 bg-background border border-border rounded text-xs px-2 py-1" value={newCurriculumSubject.hours} onChange={e => setNewCurriculumSubject({...newCurriculumSubject, hours: Number(e.target.value)})} />
                          <button onClick={() => handleAddCurriculum(cls.id)} className="bg-primary text-primary-foreground px-2 rounded text-xs font-bold">ОК</button>
                       </div>
                    ) : (
                       <button onClick={() => setNewCurriculumSubject({ classId: cls.id, subject: '', hours: 1 })} className="text-xs text-primary font-bold hover:underline">+ Добавить предмет</button>
                    )}
                 </div>
              ))}
           </div>

           <div className="flex flex-col sm:flex-row gap-3 items-end pt-4 border-t border-border">
              <div className="w-full sm:w-1/3">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Название (напр. 10 "А")</label>
                 <input className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
              </div>
              <div className="w-full sm:w-1/4">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Параллель (Ленты)</label>
                 <select className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newClass.parallel} onChange={e => setNewClass({...newClass, parallel: e.target.value})}>
                    {[7,8,9,10,11].map(n => <option key={n} value={n.toString()}>{n} классы</option>)}
                 </select>
              </div>
              <div className="w-full sm:w-1/4">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Кол-во учеников</label>
                 <input type="number" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newClass.students} onChange={e => setNewClass({...newClass, students: Number(e.target.value)})} />
              </div>
              <button onClick={handleAddClass} className="p-2.5 bg-muted border border-border hover:bg-primary hover:text-white rounded-xl transition-colors px-4 font-bold h-[38px] w-full sm:w-auto">Создать</button>
           </div>
        </div>

        {/* 5. STAFF */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
           <h3 className="text-sm uppercase tracking-widest font-black text-muted-foreground mb-4">⚙️ Персонал (Задачи)</h3>
           <div className="flex flex-wrap gap-2 mb-4">
              {staffList.map(staff => (
                 <div key={staff.id} className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg text-sm">
                    <span className="font-bold">{staff.name}</span>
                    <span className="text-xs text-primary font-bold uppercase">{staff.role}</span>
                    <button onClick={() => handleRemoveStaff(staff.id)} className="text-rose-500 hover:text-rose-600"><TrashIcon className="w-4 h-4" /></button>
                 </div>
              ))}
           </div>
           
           <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">ФИО / Должность</label>
                 <input className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Алиев А." value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
              </div>
              <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Роль ERP</label>
                 <select className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}>
                    <option>Завхоз</option><option>Директор</option><option>Охрана</option>
                 </select>
              </div>
              <button onClick={handleAddStaff} className="p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-colors"><PlusIcon className="w-5 h-5" /></button>
           </div>
        </div>

        {/* 6. RIBBONS (Профильные Ленты) */}
        <div className="bg-card border-2 border-violet-500/30 bg-violet-500/5 p-5 rounded-2xl shadow-sm">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h8m-8 4h4" /></svg>
             </div>
             <div>
               <h3 className="text-sm uppercase tracking-widest font-black text-foreground">🎓 Профильные Ленты — Ribbons ({ribbonList.length})</h3>
               <p className="text-xs text-muted-foreground mt-0.5">Ученики нескольких классов объединяются в профильные подгруппы (Физмат, Химбио, Гуманитарный) в одно и то же время.</p>
             </div>
           </div>

           {/* Existing Ribbons */}
           <div className="space-y-3 mb-4">
             {ribbonList.map((ribbon) => (
               <div key={ribbon.id} className="border border-violet-500/30 rounded-xl p-4 bg-background flex items-start justify-between gap-4">
                 <div className="flex-1">
                   <div className="flex flex-wrap gap-1.5 mb-2">
                     {ribbon.targetClasses.map(cls => (
                       <span key={cls} className="text-[10px] font-black uppercase px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md border border-violet-500/20">{cls}</span>
                     ))}
                     <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded-md">{ribbon.hoursPerWeek} ч/нед</span>
                   </div>
                   <div className="flex flex-wrap gap-1.5">
                     {ribbon.profiles.map(p => (
                       <span key={p.profile} className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20">📌 {p.profile}</span>
                     ))}
                   </div>
                 </div>
                 <button onClick={() => handleRemoveRibbon(ribbon.id)} className="text-rose-500 hover:text-rose-600 mt-1 shrink-0"><TrashIcon className="w-4 h-4" /></button>
               </div>
             ))}
           </div>

           {/* New Ribbon Form */}
           <div className="flex flex-col gap-3 p-4 border border-dashed border-violet-400/40 bg-violet-500/5 rounded-xl">
             <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">+ Новая лента</p>
             <div className="grid sm:grid-cols-2 gap-3">
               <div>
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Классы (через запятую)</label>
                 <input
                   className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-violet-500"
                   placeholder="10А, 10Б, 10В"
                   value={newRibbon.targetClassesRaw}
                   onChange={e => setNewRibbon({...newRibbon, targetClassesRaw: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Профили (через запятую)</label>
                 <input
                   className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-violet-500"
                   placeholder="Физмат, Химбио, Гуманитарный"
                   value={newRibbon.profilesRaw}
                   onChange={e => setNewRibbon({...newRibbon, profilesRaw: e.target.value})}
                 />
               </div>
             </div>
             <div className="flex items-end gap-3">
               <div className="w-32">
                 <label className="text-xs font-bold text-muted-foreground block mb-1">Часов в неделю</label>
                 <input
                   type="number" min="1" max="10"
                   className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm"
                   value={newRibbon.hoursPerWeek}
                   onChange={e => setNewRibbon({...newRibbon, hoursPerWeek: Number(e.target.value)})}
                 />
               </div>
               <button
                 onClick={handleAddRibbon}
                 className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black text-sm transition-colors flex items-center justify-center gap-2"
               >
                 <PlusIcon className="w-4 h-4" /> Добавить ленту
               </button>
             </div>
           </div>
        </div>

        {/* ACTION SUBMIT BUTTON */}
        <div className="pt-4 sticky bottom-6 w-full drop-shadow-2xl z-50">
           {generateError && <p className="text-center text-rose-500 font-bold mb-2 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">{generateError}</p>}
           
           <div className="bg-card/90 backdrop-blur-md border border-border p-4 rounded-xl shadow-lg mb-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMergeMode(!mergeMode)}>
              <div>
                 <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    Режим "Слияния" (Merge)
                 </h4>
                 <p className="text-xs text-muted-foreground mt-0.5">При включении новые уроки добавятся ПОВЕРХ старого расписания, не стирая его.</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${mergeMode ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                 <div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${mergeMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
              </div>
           </div>

           <button 
             onClick={handleGenerateClick}
             disabled={isGenerating || teachers.length === 0}
             className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(16,185,129,0.3)]"
           >
             {isGenerating ? (
               <>
                  <SpinnerIcon className="w-6 h-6 animate-spin" />
                  <span>ИИ собирает ленты...</span>
               </>
             ) : (
               <>
                  <span className="text-2xl pt-0.5">🚀</span>
                  <span>Сгенерировать Расписание</span>
               </>
             )}
           </button>
           {teachers.length === 0 && <p className="text-center text-xs text-rose-500 mt-2 font-bold animate-pulse">Для генерации добавьте минимум 1 учителя</p>}
        </div>

      </div>
    </div>
  );
}
