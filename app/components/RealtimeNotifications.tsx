'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Toast = {
  id: string;
  sender_name: string;
  text: string;
  urgency_level: number;
};

export default function RealtimeNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Подписываемся на новые сообщения
    const channel = supabase
      .channel('messages-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new as any;
          
          const newToast: Toast = {
            id: newMessage.id,
            sender_name: newMessage.sender_name || 'Неизвестный',
            text: newMessage.text || '',
            urgency_level: Number(newMessage.urgency_level) || 0
          };

          setToasts((prev) => [...prev, newToast]);

          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
          }, 8000); // Сделаем 8 секунд, чтобы успели прочитать и кликнуть
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getUrgencyStyles = (level: number) => {
    if (level === 3) return 'border-destructive bg-destructive-light/95 text-destructive-foreground hover:bg-destructive-light';
    if (level === 2) return 'border-warning bg-warning-light/95 text-warning-foreground hover:bg-warning-light';
    if (level === 1) return 'border-info bg-info-light/95 text-info-foreground hover:bg-info-light';
    return 'border-primary bg-primary-light/95 text-primary hover:bg-primary-light';
  };

  const getUrgencyTitle = (level: number) => {
    if (level === 3) return '🚨 КРИТИЧЕСКИЙ ИНЦИДЕНТ';
    if (level === 2) return '⚠️ Требуется Замена';
    if (level === 1) return '📋 Данные Посещаемости';
    return '💬 Новое Сообщение';
  };

  const handleToastClick = (toast: Toast) => {
    // Закрываем уведомление при клике
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));

    // Маршрутизируем в зависимости от текущей роли и уровня срочности
    if (pathname.includes('/admin')) {
      if (toast.urgency_level === 3) router.push('/dashboard/admin?tab=incidents');
      else if (toast.urgency_level === 2) router.push('/dashboard/admin?tab=substitutes');
      else if (toast.urgency_level === 1) router.push('/dashboard/admin?tab=attendance');
      else router.push('/dashboard/admin?tab=incidents');
    } else {
      router.push(`${pathname}?tab=messages`);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none outline-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          className={`cursor-pointer pointer-events-auto p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md transform transition-all duration-300 animate-in slide-in-from-right-10 fade-in w-80 ${getUrgencyStyles(toast.urgency_level)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 opacity-90">
              {getUrgencyTitle(toast.urgency_level)}
            </h4>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
              className="opacity-50 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="font-bold text-sm mb-1">{toast.sender_name}</p>
          <p className="text-xs opacity-90 line-clamp-2 italic">"{toast.text}"</p>
        </div>
      ))}
    </div>
  );
}
