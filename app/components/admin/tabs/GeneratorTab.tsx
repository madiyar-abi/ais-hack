'use client';
import React, { useState, useEffect } from 'react';
import GenerationWizard from './schedule/GenerationWizard';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const GENERATOR_HISTORY_KEY = 'generator_schedule_history';

type SavedSchedule = {
  id: string;
  name: string;
  createdAt: string;
  schedule: any[];
  teachers: any[];
  totalLessons: number;
  ribbonLessons: number;
};

// ─── Schedule Preview Table ────────────────────────────────────────
function SchedulePreviewTable({ schedule }: { schedule: any[] }) {
  const DAYS = [
    { num: 1, label: 'Пн', full: 'Понедельник' },
    { num: 2, label: 'Вт', full: 'Вторник' },
    { num: 3, label: 'Ср', full: 'Среда' },
    { num: 4, label: 'Чт', full: 'Четверг' },
    { num: 5, label: 'Пт', full: 'Пятница' },
  ];

  // ── Step 1: extract base class name (strip ribbon suffix) ─────────
  const baseOf = (cn: string) =>
    (cn ?? '')
      .replace(/\s*\[ЛЕНТА[^\]]*\]/gi, '')
      .replace(/\s*\(ЛЕНТА\)/gi, '')
      .trim() || cn;

  // ── Step 2: collect unique base class names ────────────────────────
  const allBases = [...new Set(schedule.map((l: any) => baseOf(l.class_name ?? '')))]
    .filter(Boolean)
    .sort();

  // ── Step 3: collect unique time slots, sorted chronologically ────
  const allSlots = [...new Set(schedule.map((l: any) => l.time_slot ?? ''))].filter(Boolean).sort();

  // ── Step 4: build grid keyed by baseClass → day → slot → lessons[] ─
  const grid: Record<string, Record<number, Record<string, any[]>>> = {};
  for (const lesson of schedule) {
    const base = baseOf(lesson.class_name ?? '');
    const day: number = Number(lesson.day_of_week) || 0;
    const slot: string = lesson.time_slot ?? '';
    if (!base || !day || !slot) continue;
    if (!grid[base]) grid[base] = {};
    if (!grid[base][day]) grid[base][day] = {};
    if (!grid[base][day][slot]) grid[base][day][slot] = [];
    grid[base][day][slot].push(lesson);
  }

  // ── Step 5: selected class — use useEffect to sync with new data ──
  const [selectedClass, setSelectedClass] = useState<string>('');
  useEffect(() => {
    if (allBases.length > 0 && (!selectedClass || !allBases.includes(selectedClass))) {
      setSelectedClass(allBases[0]);
    }
  }, [allBases.join(',')]);

  const currentGrid = grid[selectedClass] ?? {};

  // ── Render ─────────────────────────────────────────────────────────
  if (schedule.length === 0) {
    return <div className="text-center py-10 text-muted-foreground text-sm">Нет данных расписания</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Class selector */}
      {allBases.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Класс:</span>
          {allBases.map(cls => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                selectedClass === cls
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {selectedClass && (
        <div className="text-xs text-muted-foreground flex items-center gap-4">
          <span>Класс: <strong className="text-foreground">{selectedClass}</strong></span>
          <span>Уроков в неделю: <strong className="text-foreground">
            {Object.values(currentGrid).reduce((sum, dayMap) =>
              sum + Object.values(dayMap).reduce((s2, arr) => s2 + arr.length, 0), 0)}
          </strong></span>
        </div>
      )}

      {/* Weekly timetable grid */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="border-r border-border px-3 py-3 text-left font-black text-muted-foreground uppercase tracking-wider min-w-[110px] sticky left-0 bg-muted/60 z-10 text-[10px]">
                Время
              </th>
              {DAYS.map(d => (
                <th key={d.num} className="border-r border-border last:border-r-0 px-2 py-3 text-center font-black text-foreground text-[11px]">
                  <span className="hidden sm:inline">{d.full}</span>
                  <span className="inline sm:hidden">{d.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allSlots.map((slot, rowIdx) => {
              // Check if this row has ANY lesson for selected class
              const hasAny = DAYS.some(d => (currentGrid[d.num]?.[slot]?.length ?? 0) > 0);
              return (
                <tr key={slot} className={`border-b border-border/60 ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                  {/* Time */}
                  <td className={`border-r border-border px-3 py-2.5 font-mono text-[10px] font-bold sticky left-0 z-10 ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/5'} ${hasAny ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {slot}
                  </td>
                  {/* Day cells */}
                  {DAYS.map(d => {
                    const lessons: any[] = currentGrid[d.num]?.[slot] ?? [];
                    return (
                      <td key={d.num} className="border-r border-border/40 last:border-r-0 px-1.5 py-1.5 align-top min-w-[110px]">
                        {lessons.length === 0 ? (
                          <div className="flex items-center justify-center h-10 opacity-15">
                            <div className="w-6 h-px bg-current rounded-full"></div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {lessons.map((lesson: any, i: number) => (
                              <div
                                key={i}
                                className={`rounded-lg px-2 py-1.5 ${
                                  lesson.is_lenta
                                    ? 'bg-violet-500/10 border border-violet-500/25'
                                    : 'bg-primary/5 border border-primary/15'
                                }`}
                              >
                                <p className={`font-black text-[11px] leading-snug ${lesson.is_lenta ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'}`}>
                                  {lesson.is_lenta && '🎓 '}{lesson.subject ?? '—'}
                                </p>
                                {lesson.teacher_name && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate">{lesson.teacher_name}</p>
                                )}
                                {lesson.room_number && (
                                  <p className="text-[9px] text-muted-foreground/50 font-mono leading-tight">каб.{lesson.room_number}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



// ─── Main Component ────────────────────────────────────────────────
export default function GeneratorTab() {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [history, setHistory] = useState<SavedSchedule[]>([]);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [justGeneratedId, setJustGeneratedId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GENERATOR_HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  const handleApply = (newSchedules: any[], generatedTeachers?: any[], _mergeMode?: boolean) => {
    if (!newSchedules.length) return;

    const ribbonCount = newSchedules.filter((l: any) => l.is_lenta).length;
    const formattedTeachers = (generatedTeachers ?? []).map((t: any) => ({
      id: t.id,
      full_name: t.name,
      specialty: t.subjects?.join(', ') ?? 'Общий профиль',
      role: 'teacher',
    }));

    const entry: SavedSchedule = {
      id: Date.now().toString(),
      name: `Расписание от ${new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      schedule: newSchedules,
      teachers: formattedTeachers,
      totalLessons: newSchedules.length,
      ribbonLessons: ribbonCount,
    };

    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, 30); // keep last 30
      localStorage.setItem(GENERATOR_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    setJustGeneratedId(entry.id);
    setOpenEntryId(entry.id);
    setActiveTab('history');
  };

  const handleDeleteEntry = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem(GENERATOR_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    if (openEntryId === id) setOpenEntryId(null);
  };

  const handleRename = (id: string) => {
    const newName = prompt('Введите название расписания:');
    if (!newName?.trim()) return;
    setHistory(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, name: newName.trim() } : e);
      localStorage.setItem(GENERATOR_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Inner tab bar ────────────────────────────────── */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'form'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Создать расписание
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Мои расписания
          {history.length > 0 && (
            <span className="ml-0.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full">{history.length}</span>
          )}
        </button>
      </div>

      {/* ── FORM TAB ─────────────────────────────────────── */}
      {activeTab === 'form' && (
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <GenerationWizard
            onApply={handleApply}
            onCancel={() => {}}
          />
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border-2 border-dashed border-border rounded-3xl">
              <div className="p-4 bg-muted rounded-2xl">
                <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Ни одного расписания пока нет</p>
                <p className="text-sm text-muted-foreground mt-1">Перейдите во вкладку «Создать расписание» и сгенерируйте первое!</p>
              </div>
              <button
                onClick={() => setActiveTab('form')}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Создать расписание
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-semibold">Сохранено расписаний: <span className="text-foreground font-black">{history.length}</span></p>
                <button
                  onClick={() => {
                    if (confirm('Удалить всю историю расписаний?')) {
                      setHistory([]);
                      setOpenEntryId(null);
                      localStorage.removeItem(GENERATOR_HISTORY_KEY);
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold transition-colors"
                >
                  Очистить всё
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {history.map(entry => (
                  <div key={entry.id} className={`border rounded-2xl overflow-hidden bg-card transition-all ${justGeneratedId === entry.id ? 'border-emerald-500/50 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]' : 'border-border'}`}>
                    {/* Entry Header */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <button
                        className="flex items-center gap-4 flex-1 text-left"
                        onClick={() => setOpenEntryId(openEntryId === entry.id ? null : entry.id)}
                      >
                        <div className={`p-2.5 rounded-xl ${justGeneratedId === entry.id ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-foreground">{entry.name}</p>
                            {justGeneratedId === entry.id && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20">Новое</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-[11px] font-semibold text-foreground">{entry.totalLessons} уроков</span>
                            {entry.ribbonLessons > 0 && (
                              <span className="text-[11px] font-bold text-violet-500">🎓 {entry.ribbonLessons} ленточных</span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleRename(entry.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Переименовать"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          title="Удалить"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <button
                          onClick={() => setOpenEntryId(openEntryId === entry.id ? null : entry.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <svg className={`w-4 h-4 transition-transform duration-300 ${openEntryId === entry.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Preview */}
                    {openEntryId === entry.id && (
                      <div className="border-t border-border px-5 pb-5 pt-4">
                        <SchedulePreviewTable schedule={entry.schedule} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
