import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { generateAttendanceReport } from '../../../utils/attendance';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function AttendanceTab({ user }: { user: any }) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: false });

  const attendanceMessages = (allMessages || []).filter(msg => msg.urgency_level === 1);
  const { totalAbsent, groups } = generateAttendanceReport(attendanceMessages);

  async function forceSendReport() {
    'use server';
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: fetchMsgs } = await supabase.from('messages').select('*').order('timestamp', { ascending: false });
    const attMsgs = (fetchMsgs || []).filter(msg => msg.urgency_level === 1);
    
    // Import generateAttendanceReport inside the server action to avoid closure issues in Next.js Server Actions
    const { generateAttendanceReport } = await import('../../../utils/attendance');
    const { totalAbsent, groups } = generateAttendanceReport(attMsgs);

    const botUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001/send-message';
    const groupId = process.env.WHATSAPP_ATTENDANCE_GROUP_ID || '120363433079394966@g.us';

    let summaryText = `📋 *ПОЛНАЯ СВОДКА ПОСЕЩАЕМОСТИ*\nСгенерировано вручную\n\n`;

    let allSchoolPresent = 0;
    groups.forEach(group => {
       const groupTotalPresent = group.data.reduce((sum: number, r: any) => sum + r.presentCount, 0);
       const groupTotalAbsent = group.data.reduce((sum: number, r: any) => sum + r.absentCount, 0);
       allSchoolPresent += groupTotalPresent;
       
       summaryText += `🟢 *${group.title}*\n`;
       summaryText += `Присутствуют: ${groupTotalPresent} | Отсутствуют: ${groupTotalAbsent}\n`;
       
       const sickClasses = group.data.filter((r: any) => r.absentCount > 0);
       if (sickClasses.length > 0) {
           summaryText += `(Отсутствуют: `;
           summaryText += sickClasses.map((r: any) => `${r.className} - ${r.absentCount}`).join(', ');
           summaryText += `)\n\n`;
       } else {
           summaryText += `(Все в полном составе)\n\n`;
       }
    });

    summaryText = summaryText.trim();
    summaryText += `\n\n*Итог по школе:*\nПрисутствуют: ${allSchoolPresent} | Отсутствуют: ${totalAbsent}`;

    try {
      await fetch(botUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, text: summaryText })
      });
    } catch (err) {
      console.error('Ошибка бота', err);
    }
  }

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border min-h-[500px]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Сводка посещаемости (09:00)</h2>
            <p className="text-sm text-muted-foreground">Система автоматически дополняет недостающие классы (Авто-отчет = 100% явка)</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-right">
           <form action={forceSendReport}>
             <button type="submit" className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-5 py-3 rounded-lg hover:bg-primary/20 hover:-translate-y-[1px] transition-all flex items-center gap-2 shadow-sm border border-primary/20 cursor-pointer">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
               Выгрузить в WhatsApp
             </button>
           </form>
           <div className="border-l border-border pl-8 text-center">
             <div className="text-3xl font-black text-destructive leading-none">{totalAbsent}</div>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Всего болеет по школе</p>
           </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <div key={group.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
             <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-widest uppercase text-foreground">{group.title}</h3>
                <span className="text-xs font-semibold px-2 py-1 bg-background rounded-md text-muted-foreground">{group.data.length} классов</span>
             </div>
             
             {group.data.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground italic">
                   Нет классов в этой категории
                </div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap caption-bottom">
                     <thead className="bg-background text-muted-foreground font-medium border-b border-border text-xs">
                       <tr>
                         <th className="h-10 px-4 align-middle font-semibold">Класс</th>
                         <th className="h-10 px-4 align-middle font-semibold">Отправитель</th>
                         <th className="h-10 px-4 align-middle font-semibold">Оригинал сообщения</th>
                         <th className="h-10 px-4 align-middle text-center font-bold text-destructive">Болеют</th>
                         <th className="h-10 px-4 align-middle text-center font-bold text-success">Явка</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                       {group.data.map((row: any) => (
                         <tr key={row.className} className={`transition-colors hover:bg-muted/30 ${row.isAuto ? 'opacity-80 bg-muted/10' : ''}`}>
                           <td className="p-3 align-middle">
                              <span className={`font-bold px-2.5 py-1 rounded-md text-xs ${row.isAuto ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-primary/10 text-primary'}`}>
                                 {row.className}
                              </span>
                           </td>
                           <td className="p-3 align-middle text-foreground font-medium flex items-center gap-2">
                              {row.isAuto ? (
                                <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" /></svg>
                              ) : null}
                              <div>
                                {row.sender}
                                <span className="block text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">{row.time}</span>
                              </div>
                           </td>
                           <td className="p-3 align-middle text-muted-foreground text-xs truncate max-w-[250px]" title={row.text}>
                              {row.isAuto ? (
                                 <em className="text-success/70 font-semibold">{row.text}</em>
                              ) : (
                                 `"${row.text}"`
                              )}
                           </td>
                           <td className="p-3 align-middle text-center">
                             {row.absentCount > 0 ? (
                               <span className="text-destructive font-bold">{row.absentCount}</span>
                             ) : (
                               <span className="text-muted-foreground font-medium">-</span>
                             )}
                           </td>
                           <td className="p-3 align-middle text-center">
                              <span className="text-success font-bold">{row.presentCount} {row.isAuto ? '' : `/ ${row.totalStudents}`}</span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
