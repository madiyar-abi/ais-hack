import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';
import ProfileTab from '../../components/profile/ProfileTab';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];

type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function TeacherDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentTab = params?.tab || 'main';

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  let user: any = { role: '', full_name: 'Учитель', id: null };
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      user = payload;
    } catch(e) {}
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Рабочий стол</h1>
        <p className="text-muted-foreground mt-1">Добро пожаловать, {user.full_name}!</p>
      </div>

      <Suspense key={currentTab} fallback={
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-card-border mt-2 min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
            <p className="text-muted-foreground font-medium animate-pulse">Загрузка данных...</p>
          </div>
        </div>
      }>
        <DashboardContent user={user} currentTab={currentTab} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ user, currentTab }: { user: any, currentTab: string }) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  let scheduleData: any[] = [];
  if (user?.id && (currentTab === 'main' || currentTab === 'schedule')) {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('teacher_id', user.id)
      .order('day_of_week')
      .order('time_slot');
    if (data) scheduleData = data;
  }

  let taskData: any[] = [];
  if (user?.id && (currentTab === 'main' || currentTab === 'messages')) {
     const { data } = await supabase
       .from('tasks')
       .select('id, title, description, status')
       .eq('target_teacher_id', user.id)
       .order('id', { ascending: false });
     if (data) taskData = data;
  }

  // ==== Вкладка "Главная" ====
  if (currentTab === 'profile') {
    return <ProfileTab currentUser={user} />;
  }

  if (currentTab === 'main') {
    const nextLesson = scheduleData.length > 0 ? scheduleData[0] : null;
    const unreadTasks = taskData.filter(t => t.status === 'pending').length;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-card-border hover:border-primary/30 transition-colors">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Следующий урок
            </h3>
            {nextLesson ? (
              <div className="mt-4">
                <p className="text-4xl font-bold text-primary tracking-tight mb-2">{nextLesson.time_slot}</p>
                <div className="flex flex-col gap-1 mt-3">
                  <p className="text-foreground font-bold text-lg">{nextLesson.class_name}</p>
                  <p className="text-muted-foreground font-medium">Кабинет: {nextLesson.room_number}</p>
                  <p className="text-muted-foreground text-sm mt-1">День: {DAYS[nextLesson.day_of_week - 1]}</p>
                </div>
              </div>
            ) : (
              <p className="text-lg font-bold text-muted-foreground mt-2">Нет данных о предстоящих уроках</p>
            )}
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-card-border flex items-center justify-between hover:shadow-md transition-all cursor-pointer">
               <div>
                 <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Непрочитанные сообщения</h3>
                 <p className="text-3xl font-bold text-destructive">{unreadTasks}</p>
               </div>
               <div className="p-4 bg-destructive-light rounded-full text-destructive">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
               </div>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-card-border flex items-center justify-between">
               <div>
                 <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Всего уроков в неделю</h3>
                 <p className="text-3xl font-bold text-foreground">{scheduleData.length}</p>
               </div>
               <div className="p-4 bg-muted rounded-full text-muted-foreground">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
            </div>
          </div>
        </div>
    );
  }

  // ==== Вкладка "Сообщения" ====
  if (currentTab === 'messages') {
    return (
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-card-border min-h-[400px] mt-2">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
               <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
               Входящие поручения
            </h2>

            {taskData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-border rounded-xl">
                  <svg className="w-16 h-16 text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  <h3 className="text-lg font-bold text-foreground">Нет новых задач</h3>
                  <p className="text-muted-foreground mt-2 text-sm text-center">У вас нет назначенных задач или важных оповещений от директора.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                  {taskData.map(task => (
                    <div key={task.id} className="p-5 border border-card-border rounded-xl bg-muted hover:bg-card transition-colors relative group shadow-sm hover:shadow-md">
                       <span className="absolute top-4 right-4 bg-info-light text-info text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Voice AI</span>
                       <h3 className="font-bold text-foreground text-lg mb-2">{task.title}</h3>
                       <div className="bg-card p-3 rounded-lg border border-card-border">
                         <p className="text-foreground font-medium italic">"{task.description}"</p>
                       </div>
                       <div className="mt-4 flex justify-between items-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${task.status === 'pending' ? 'bg-warning-light text-warning' : 'bg-accent-light text-accent'}`}>
                             {task.status === 'pending' ? 'Ожидает выполнения' : 'Подтверждено'}
                          </span>
                       </div>
                    </div>
                  ))}
                </div>
            )}
        </div>
    );
  }

  // ==== Вкладка "Расписание и Таймлайн (ERP)" ====
  const TIME_SLOTS = ['08:00-08:45', '08:55-09:40', '10:00-10:45', '11:05-11:50', '12:10-12:55', '13:10-13:55'];

  const scheduleByDay = DAYS.map((dayName, index) => {
    const dayIndex = index + 1;
    let lessons = scheduleData.filter((s) => s.day_of_week === dayIndex).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    
    // ИИ-Оркестратор: Заполняем "окна" (свободные слоты) задачами и поручениями
    if (dayIndex === 1 && taskData.length > 0) { // Для примера внедряем на понедельник или сегодняшний день
       const occupiedSlots = lessons.map(l => l.time_slot);
       const freeSlots = TIME_SLOTS.filter(slot => !occupiedSlots.includes(slot));
       const pendingTasks = taskData.filter(t => t.status === 'pending');
       
       pendingTasks.forEach((task, tIdx) => {
          if (freeSlots[tIdx]) {
             lessons.push({
                is_task: true,
                id: 'task-' + task.id,
                time_slot: freeSlots[tIdx],
                class_name: 'Задача от директора',
                room_number: task.title,
                description: task.description
             });
          }
       });
       lessons.sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    }

    return { day: dayName, lessons };
  });

  return (
      <div className="bg-card p-6 rounded-2xl shadow-sm border border-card-border mt-2">
        {scheduleData.length === 0 ? (
          <div className="text-muted-foreground text-sm flex items-center justify-center p-10 border-2 border-dashed border-border rounded-xl">
            Похоже, расписание для вас еще не загружено.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {scheduleByDay.map((scheduleBlock, idx) => (
              <div key={idx} className="bg-muted rounded-xl p-4 border border-border flex flex-col">
                <h3 className="font-bold text-foreground bg-card shadow-sm border border-card-border py-2 px-3 rounded-lg mb-4 text-center tracking-wide">
                  {scheduleBlock.day}
                </h3>
                
                <div className="flex flex-col gap-3">
                  {scheduleBlock.lessons.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4 bg-card/50 rounded-lg border border-border border-dashed">
                      Нет активностей
                    </div>
                  ) : (
                    scheduleBlock.lessons.map((lesson) => (
                      <div key={lesson.id} className={`bg-card p-3 rounded-lg border shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${lesson.is_task ? 'border-info/30 hover:border-info' : 'border-card-border hover:border-primary'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 opacity-80 ${lesson.is_task ? 'bg-info' : 'bg-primary'}`}></div>
                        <div className="pl-2 flex flex-col h-full">
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded shadow-sm self-start">
                            {lesson.time_slot}
                          </span>
                          <h4 className="font-bold text-foreground mt-2 text-sm leading-tight">{lesson.class_name}</h4>
                          <p className={`text-xs mt-1 font-medium flex items-center gap-1.5 ${lesson.is_task ? 'text-info' : 'text-muted-foreground'}`}>
                            {lesson.is_task ? (
                               <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                               <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            )}
                            {lesson.is_task ? lesson.room_number : `Каб. ${lesson.room_number}`}
                          </p>
                          {lesson.is_task && (
                             <p className="text-[10px] text-muted-foreground mt-2 italic leading-tight border-t border-border pt-1">
                               "{lesson.description}"
                             </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
