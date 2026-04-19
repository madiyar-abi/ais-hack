'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function IncidentDeleteButton({ id, title = 'инцидент' }: { id: string, title?: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string}>({ isOpen: false, message: '' });
  const router = useRouter();

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Ошибка удаления');
      setShowModal(false);
      router.refresh();
    } catch (error) {
      console.error(`Ошибка при удалении ${title}:`, error);
      setAlertModal({ isOpen: true, message: `Произошла ошибка при удалении ${title}.` });
    } finally {
      setIsDeleting(false);
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
        disabled={isDeleting}
        className={`px-4 py-2 text-sm font-bold text-muted-foreground bg-muted rounded-xl transition-colors ${isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-destructive-light hover:text-destructive'}`}
      >
        Игнорировать (Удалить)
      </button>

      {/* Модальное окно */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 shadow-xl w-full max-w-sm border border-card-border transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive-light text-destructive mb-4 mx-auto">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-center text-foreground mb-2">Удалить {title}?</h3>
            <p className="text-sm border text-center text-muted-foreground mb-6 px-2 py-4 rounded-xl bg-muted border-border">
               Вы уверены, что хотите навсегда удалить эту запись? Действие нельзя отменить.
            </p>
            <div className="flex gap-3 w-full">
               <button 
                  onClick={() => setShowModal(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 font-bold text-sm text-muted-foreground bg-muted rounded-xl hover:opacity-80 transition-colors disabled:opacity-50"
               >
                  Отмена
               </button>
               <button 
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 font-bold text-sm text-primary-foreground bg-destructive rounded-xl hover:opacity-90 shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
               >
                  {isDeleting ? (
                     <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                        <span>Удаление...</span>
                     </>
                  ) : (
                     "Удалить"
                  )}
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
