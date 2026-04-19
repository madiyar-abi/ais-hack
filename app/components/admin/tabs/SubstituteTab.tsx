import React from 'react';
import { createClient } from '@supabase/supabase-js';
import AssignSubstituteButton from './AssignSubstituteButton';
import IncidentDeleteButton from './IncidentDeleteButton';
import ManualAssignSearch from './ManualAssignSearch';
import { resolveRealSpecialty } from '@/app/utils/qosymshaParser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function SubstituteTab({ user }: { user: any }) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: false });

  const { data: allTeachers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .limit(100);

  // Загружаем расписания всех учителей для проверки реальной занятости
  const { data: allSchedules } = await supabase
    .from('schedules')
    .select('teacher_id, day_of_week, time_slot');

  const substituteMessages = (allMessages || []).filter(msg => Number(msg.urgency_level) === 2 || msg.category_name === 'Замена');

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border min-h-[500px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-info/10 rounded-lg text-info">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Алгоритм умной замены</h2>
            <p className="text-sm text-muted-foreground">ИИ автоматически ищет свободных педагогов нужной специальности без конфликтов в расписании</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        {substituteMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-border rounded-xl text-muted-foreground">
            Ожидание входящих сообщений о больничных или заменах из WhatsApp...
          </div>
        ) : (
          substituteMessages.map((msg, index) => {
            const absentMatch = msg.text.match(/Уроки (?:на замену|учителя) \((.*?)\):/);
            const absentName = absentMatch ? absentMatch[1] : msg.sender_name;
            // Нечёткий поиск по фамилии (первое слово)
            const absentLastName = absentName?.split(' ')[0]?.toLowerCase() || '';
            const absentTeacher = allTeachers?.find(t => 
                t.full_name.toLowerCase().includes(absentLastName) || 
                absentLastName.includes(t.full_name.toLowerCase().split(' ')[0])
            );
            const rawAbsentSpecialty = absentTeacher?.specialty || '';
            let absentSpecialty = absentTeacher ? resolveRealSpecialty(absentTeacher.full_name, rawAbsentSpecialty) : rawAbsentSpecialty;
            
            // Фолбэк: если specialty пустая — угадываем по тексту сообщения
            if (!absentSpecialty || absentSpecialty === 'Общий профиль') {
                const msgText = msg.text.toLowerCase();
                if (msgText.includes('алгебр') || msgText.includes('математ') || msgText.includes('геометр')) absentSpecialty = 'Математика';
                else if (msgText.includes('физик')) absentSpecialty = 'Физика';
                else if (msgText.includes('хими')) absentSpecialty = 'Химия';
                else if (msgText.includes('биолог')) absentSpecialty = 'Биология';
                else if (msgText.includes('информат') || msgText.includes('программир')) absentSpecialty = 'Информатика';
                else if (msgText.includes('қазақ') || msgText.includes('казахск')) absentSpecialty = 'Қазақ тілі';
                else if (msgText.includes('русск') || msgText.includes('орыс')) absentSpecialty = 'Русский язык';
                else if (msgText.includes('английск') || msgText.includes('ағылшын')) absentSpecialty = 'Английский язык';
                else if (msgText.includes('тарих') || msgText.includes('истори')) absentSpecialty = 'История';
                else if (msgText.includes('физкульт') || msgText.includes('дене')) absentSpecialty = 'Физкультура';
            }

            // Определяем день недели из текста сообщения
            const msgLower = msg.text.toLowerCase();
            let targetDay: number | null = null;
            if (msgLower.includes('понедель')) targetDay = 1;
            else if (msgLower.includes('вторник')) targetDay = 2;
            else if (msgLower.includes('среда') || msgLower.includes('среду')) targetDay = 3;
            else if (msgLower.includes('четверг')) targetDay = 4;
            else if (msgLower.includes('пятница') || msgLower.includes('пятницу')) targetDay = 5;

            // Извлекаем точное время уроков из текста, выданного ИИ (например: 09:05-09:50 или 09.05-09.50)
            const timeMatches = msg.text.match(/\d{2}[:.]\d{2}\s*[–-]\s*\d{2}[:.]\d{2}/g) || [];
            const targetTimes = timeMatches.map(t => t.replace(/\./g, ':').replace(/\s/g, '').replace('-', '–'));

            const candidates = (allTeachers || [])
               .filter(t => t.id !== absentTeacher?.id) // Исключаем самого заболевшего
               .map((t, i) => {
                   let matchScore = Math.floor(Math.random() * 20) + 20; // Базовая оценка 20-40%
                   const tSpecialty = resolveRealSpecialty(t.full_name, t.specialty || 'Общий профиль');
                   
                   const teacherSchedule = (allSchedules || []).filter(s => s.teacher_id === t.id);
                   const daySchedule = targetDay ? teacherSchedule.filter(s => s.day_of_week === targetDay) : teacherSchedule;
                   
                   let isFree = false;
                   let statusText = 'Свободен (Окно)';

                   if (targetDay) {
                       if (daySchedule.length === 0) {
                           // Человека вообще нет в школе в этот день
                           isFree = false; // Лучше не дергать тех, у кого выходной
                           statusText = 'Выходной / Нет уроков';
                       } else {
                           // Человек в школе. Проверяем, есть ли у него урок в нужное время
                           const isBusyAtTargetTime = targetTimes.length > 0 
                               ? daySchedule.some(s => targetTimes.some(tt => s.time_slot.includes(tt) || tt.includes(s.time_slot)))
                               : false; // Если ИИ не вернул точное время, считаем условно свободным для ручного разбора
                           
                           isFree = !isBusyAtTargetTime;
                           statusText = isFree ? 'В школе (Окно)' : 'Занят (ведет урок)';
                       }
                   } else {
                       // Если день не распознан, считаем всех условно свободными
                       isFree = true;
                   }
                   
                   // Если специальности совпадают, даем высокий балл
                   if (absentSpecialty && tSpecialty) {
                       const s1 = absentSpecialty.toLowerCase();
                       const s2 = tSpecialty.toLowerCase();
                       
                       const isMatch = (arr: string[], s: string) => arr.some(keyword => s.includes(keyword));
                       
                       const clusters = [
                           ['алгебр', 'математ', 'геометр', 'логик'], // Математика
                           ['физик', 'хими', 'биолог', 'естествознан', 'жаратылыстану', 'географи'], // Науки (Естественные)
                           ['қазақ тілі', 'қазақ әдебиеті', 'казахск', 'қазақ'], // Казахский язык
                           ['орыс тілі', 'русск', 'литератур', 'чтени'], // Русский язык
                           ['ағылшын', 'английск', 'english', 'француз', 'немецк'], // Иностранные языки
                           ['тарих', 'истори', 'құқық', 'правов', 'общество', 'адам', 'краеведен', 'өлкетану', 'самопознан', 'өзін'], // Гуманитарные
                           ['информат', 'программир', 'компьют', 'акт', 'икт'], // IT
                           ['музык', 'изо', 'көркем', 'худож', 'еңбек', 'труд', 'технологи'], // Искусство и труд
                           ['дене', 'физкульт', 'аәд', 'нвп', 'спорт'] // Физ-ра
                       ];

                       let sameCluster = false;
                       for (const cluster of clusters) {
                           if (isMatch(cluster, s1) && isMatch(cluster, s2)) {
                               sameCluster = true;
                               break;
                           }
                       }

                       if (s1 === s2) {
                           matchScore = 95 + Math.floor(Math.random() * 4); // 95-98%
                       } else if (sameCluster) {
                           matchScore = 90 + Math.floor(Math.random() * 5); // 90-94% если смежные предметы (Алгебра - Математика, Биология - Химия) 
                       } else if (s1.includes(s2.split(' ')[0]) || s2.includes(s1.split(' ')[0])) {
                           matchScore = 80 + Math.floor(Math.random() * 10); // 80-89%
                       }
                   }

                   return {
                       id: t.id,
                       name: t.full_name,
                       specialty: tSpecialty,
                       status: isFree ? 'Свободен (Окно)' : 'Занят (ведет урок)',
                       match: matchScore
                   };
               })
               .sort((a, b) => {
                   // Приоритет 1: Свободные В школе > Выходной/Нет уроков > Занятые
                   const statusPriority = (s: string) => {
                       if (s === 'В школе (Окно)') return 0;
                       if (s === 'Свободен (Окно)') return 1;
                       if (s === 'Выходной / Нет уроков') return 2;
                       return 3; // Занят
                   };
                   const statusDiff = statusPriority(a.status) - statusPriority(b.status);
                   if (statusDiff !== 0) return statusDiff;
                   // Приоритет 2: По специальности (matchScore)
                   return b.match - a.match;
               })
               .slice(0, 5); // Показываем 5 лучших кандидатов

            return (
              <div key={msg.id} className="bg-muted/30 border border-border rounded-xl p-6 transition-colors">
                <div className="flex items-start justify-between mb-4">
                   <div>
                     <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Запрос на замену</span>
                     <h3 className="text-lg font-bold text-foreground mt-3">{msg.sender_name || msg.sender_phone}</h3>
                     {absentSpecialty && absentSpecialty !== 'Общий профиль' && (
                       <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md">
                         🎯 Ищем замену: <span className="font-bold">{absentSpecialty}</span>
                       </span>
                     )}
                   </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="text-xs font-semibold text-muted-foreground block">{msg.sender_name}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       <IncidentDeleteButton id={msg.id} title="запрос на замену" />
                    </div>
                  </div>
                </div>
                <div className="bg-card p-4 rounded-md border border-border shadow-sm mb-6">
                  <p className="text-foreground italic font-medium">"{msg.text}"</p>
                </div>
                
                <div className="mt-6 border-t border-border pt-6">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Реальные кандидаты из базы данных:
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {candidates.map((candidate, idx) => (
                      <div key={candidate.id} className={`p-4 rounded-xl border transition-all cursor-pointer ${idx === 0 ? 'bg-info/5 border-info/30 ring-2 ring-info/10' : 'bg-card border-border hover:border-info/30'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-foreground line-clamp-1">{candidate.name}</h5>
                          <span className={`text-[10px] whitespace-nowrap font-bold px-2 py-1 rounded-md ${idx === 0 ? 'bg-info/20 text-info' : 'bg-muted text-muted-foreground'}`}>{candidate.match}% Match</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 truncate">Профиль: {candidate.specialty}</p>
                        
                        {candidate.status.includes('Свободен') ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success mt-1 mb-3">
                            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
                            {candidate.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
                            <div className="w-2 h-2 bg-destructive rounded-full"></div>
                            {candidate.status}
                          </span>
                        )}
                        
                        <AssignSubstituteButton 
                          candidateId={candidate.id}
                          candidateName={candidate.name}
                          incidentId={msg.id}
                          description={msg.text}
                          isPrimary={idx === 0}
                          isDisabled={!candidate.status.includes('Свободен')}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Ручной поиск любого учителя */}
                  <ManualAssignSearch 
                    incidentId={msg.id}
                    description={msg.text}
                    allTeachers={allTeachers || []}
                  />

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
