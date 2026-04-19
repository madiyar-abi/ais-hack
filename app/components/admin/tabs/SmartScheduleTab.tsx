import React from 'react';
import { createClient } from '@supabase/supabase-js';
import SmartScheduleClient from './schedule/SmartScheduleClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function SmartScheduleTab({ user }: { user: any }) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Получаем профили сотрудников
  const { data: dbTeachers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('full_name');
    
  const teachers = dbTeachers ? [...dbTeachers] : [];
  
  // ДОБАВЛЯЕМ СЛЕСАРЯ И ЗАВУЧА ДЛЯ ДЕМОНСТРАЦИИ ТЗ
  teachers.unshift({
     id: 'deputy-1',
     full_name: 'Иванова М.И.',
     specialty: 'Завуч (Общий контроль)',
     role: 'admin'
  });
  teachers.unshift({
     id: 'worker-1',
     full_name: 'Петров В.В.',
     specialty: 'Слесарь-техник',
     role: 'staff'
  });

  // Fetch the current schedules map map
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*');

  return (
    <div className="bg-white/60 dark:bg-black/20 border border-slate-200/60 dark:border-white/10 p-8 rounded-3xl min-h-[600px] flex flex-col gap-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Управление Расписанием</h2>
            <p className="text-base text-slate-500 dark:text-white/50 mt-1">
              Движок распределения ресурсов. Перетаскивайте карточки для ручной корректировки. Инклюзивный алгоритм подсветит перегруз учителей и заблокирует накладки кабинетов.
            </p>
          </div>
        </div>
      </div>

      <SmartScheduleClient initialTeachers={teachers || []} initialSchedules={schedules || []} />
    </div>
  );
}
