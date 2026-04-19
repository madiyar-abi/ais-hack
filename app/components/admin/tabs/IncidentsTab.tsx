import React from 'react';
import { createClient } from '@supabase/supabase-js';
import IncidentDeleteButton from './IncidentDeleteButton';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const generateStructuredAIAnalysis = (msgText: string, urgency: number) => {
  const lowerText = msgText.toLowerCase();
  let assigned = "Учебная часть (Завуч)";
  
  if (lowerText.includes('стул') || lowerText.includes('парта') || lowerText.includes('кабинет') || lowerText.includes('слома') || lowerText.includes('свет') || lowerText.includes('вода')) {
    assigned = "Завхоз (АХЧ)";
  } else if (lowerText.includes('драка') || lowerText.includes('кури') || lowerText.includes('вейп') || lowerText.includes('поведени')) {
    assigned = "Завуч по Воспитательной Работе";
  } else if (lowerText.includes('опаздывает') || lowerText.includes('расписани')) {
    assigned = "Диспетчер по расписанию";
  } else if (urgency >= 3) {
    assigned = "Директор (Экстренно)";
  }

  // Удаляем мусорные слова для формирования краткой выжимки
  let summary = msgText
    .replace(/срочно/gi, '')
    .replace(/здравствуйте/gi, '')
    .replace(/добрый день/gi, '')
    .replace(/пожалуйста/gi, '')
    .replace(/подскажите/gi, '')
    .trim();
  
  if (summary.length > 50) {
    summary = summary.substring(0, 50) + '...';
  }

  // Делаем первую букву заглавной
  summary = summary.charAt(0).toUpperCase() + summary.slice(1);

  return { summary, assigned };
};

export default async function IncidentsTab({ user }: { user: any }) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Вытаскиваем сообщения (самые важные вначале)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('urgency_level', { ascending: false })
    .order('timestamp', { ascending: false })
    .limit(10);

  const incidents = (messages || []).filter(m => m.urgency_level >= 3 || m.text.toLowerCase().includes('проблема'));

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border min-h-[400px]">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Анализ инцидентов</h2>
          <p className="text-sm text-muted-foreground">Система автоматически сканирует поток сообщений и помечает критические</p>
        </div>
      </div>
      
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-border rounded-xl text-muted-foreground">
           Никаких инцидентов не выявлено. В школе все спокойно!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-semibold text-foreground">Обнаружено инцидентов: <span className="text-destructive">{incidents.length}</span></h3>
             <button className="text-xs font-semibold text-primary bg-primary/10 px-3 py-2 rounded-md hover:bg-primary/20 transition-colors">Сгенерировать сводку за день</button>
          </div>
          
          {incidents.map(inc => (
            <div key={inc.id} className="border border-border rounded-lg overflow-hidden bg-card transition-colors hover:bg-muted/50">
               <div className={`px-4 py-3 border-b flex justify-between items-center ${inc.urgency_level >= 2 ? 'bg-destructive/5' : 'bg-warning/5'}`}>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${inc.urgency_level >= 2 ? 'bg-destructive' : 'bg-warning'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${inc.urgency_level >= 2 ? 'bg-destructive' : 'bg-warning'}`}></span>
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${inc.urgency_level >= 2 ? 'text-destructive' : 'text-warning'}`}>
                      {inc.urgency_level >= 2 ? 'Критический инцидент' : 'Внимание'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">От: {inc.sender_name} ({inc.sender_phone})</span>
               </div>
               
               <div className="p-4 flex flex-col gap-4">
                 <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Оригинальное сообщение (WhatsApp)</p>
                    <p className="text-foreground text-sm opacity-80 italic">
                       "{inc.text}"
                    </p>
                 </div>
                 
                 {(() => {
                    const ai = generateStructuredAIAnalysis(inc.text, inc.urgency_level);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <div className="bg-info/5 p-4 rounded-xl border border-info/20 shadow-sm transition-all hover:bg-info/10">
                            <div className="flex items-center gap-2 mb-2">
                               <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                               <span className="text-info text-xs uppercase font-bold tracking-wider">Суть проблемы</span>
                            </div>
                            <p className="text-base font-bold text-foreground">
                              {ai.summary}
                            </p>
                         </div>

                         <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 shadow-sm transition-all hover:bg-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                               <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                               <span className="text-primary text-xs uppercase font-bold tracking-wider">Назначен ответственным</span>
                            </div>
                            <p className="text-base font-bold text-foreground">
                              {ai.assigned}
                            </p>
                         </div>
                      </div>
                    );
                 })()}
                 
                 <div className="flex justify-end mt-2">
                    <IncidentDeleteButton id={inc.id} />
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
