'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function AssignSubstituteButton({ 
  candidateId,
  candidateName, 
  incidentId, 
  description, 
  isPrimary, 
  isDisabled 
}: { 
  candidateId: string;
  candidateName: string;
  incidentId: string;
  description: string;
  isPrimary: boolean;
  isDisabled: boolean;
}) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string}>({ isOpen: false, message: '' });
  const router = useRouter();

  const handleAssign = async () => {
     setIsAssigning(true);
     try {
       const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
       
       // Вытаскиваем класс и кабинет из оригинального описания инцидента
       const classMatch = description.match(/(?:^|[\s,."'])(\d{1,2})\s*([A-ZА-ЯҒҚҢӨҰҮІa-zа-яғқңөұүі]{1})(?=[\s,."']|$)/ui);
       const targetClass = classMatch ? `${classMatch[1]}${classMatch[2].toUpperCase()}` : '[Не указан]';

       const cabMatch = description.match(/(?:кабинет[е]?|каб\.?)\s*(\d{2,3})/i);
       const cabNumber = cabMatch ? cabMatch[1] : '[Не указан]';

       const [originalMsg, schedulePart] = description.split('📌');
       const scheduleText = schedulePart ? `\n\n📌 ${schedulePart.trim()}` : '';

       const exactPushText = `Срочная замена: вам назначен урок в ${targetClass} классе, кабинет ${cabNumber}.${scheduleText}`;
       
       await supabase.from('tasks').insert({
          title: "🚨 Срочная замена: Урок через 15 минут",
          description: exactPushText,
          target_teacher_id: candidateId,
          status: 'pending'
       });

       await supabase.from('messages').delete().eq('id', incidentId);
       
       const summaryText = `📢 *АВТОМАТИЗАЦИЯ ИИ*\nУчителю ${candidateName} назначена замена:\n_${exactPushText}_`;
       
       await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: summaryText })
       });

       setShowModal(false);
       router.refresh();

     } catch (e) {
       console.error('Ошибка назначения замены:', e);
       setAlertModal({ isOpen: true, message: "Ошибка при назначении замены" });
     } finally {
       setIsAssigning(false);
     }
  };

  return (
    <>
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-xs rounded-xl shadow-lg border border-border p-4 animate-in zoom-in-95 flex flex-col gap-2">
             <h3 className="font-bold text-base text-rose-500">Ошибка</h3>
             <p className="text-xs text-muted-foreground">{alertModal.message}</p>
             <button onClick={() => setAlertModal({ isOpen: false, message: '' })} className="mt-2 w-full py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded font-medium transition-colors text-xs">Закрыть</button>
          </div>
        </div>
      )}

      <button 
        onClick={() => setShowModal(true)}
        disabled={isDisabled || isAssigning}
        className={`w-full mt-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          isPrimary && !isDisabled 
            ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90' 
            : 'bg-muted text-muted-foreground hover:opacity-80'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Назначить замену
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 shadow-xl w-full max-w-sm border border-card-border transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4 mx-auto">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-center text-foreground mb-2">Назначить замену?</h3>
            <p className="text-sm text-center text-muted-foreground mb-6">
               Учитель <strong className="text-foreground">{candidateName}</strong> получит задачу в свой личный кабинет, а первоначальный запрос будет закрыт.
            </p>
            <div className="flex gap-3 w-full">
               <button 
                  onClick={() => setShowModal(false)}
                  disabled={isAssigning}
                  className="flex-1 py-2.5 font-bold text-sm text-muted-foreground bg-muted rounded-xl hover:opacity-80 transition-colors disabled:opacity-50"
               >
                  Отмена
               </button>
               <button 
                  onClick={handleAssign}
                  disabled={isAssigning}
                  className="flex-1 py-2.5 font-bold text-sm text-primary-foreground bg-primary rounded-xl hover:opacity-90 shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
               >
                  {isAssigning ? (
                     <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                        <span>Отправка...</span>
                     </>
                  ) : (
                     "Подтвердить"
                  )}
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
