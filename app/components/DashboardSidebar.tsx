'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

export default function DashboardSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const activeTab = searchParams.get('tab') || 'main';
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Ошибка выхода', e);
    }
  };

  const getTabClass = (tabId: string) => {
    const isActive = activeTab === tabId;
    return isActive
      ? "flex items-center gap-3 text-left px-4 py-3 rounded-2xl transition-all duration-300 shadow-md text-sm font-bold bg-primary text-primary-foreground transform scale-[1.02]"
      : "flex items-center gap-3 text-left px-4 py-3 rounded-2xl transition-all duration-300 ease-out text-sm font-medium text-slate-500 dark:text-white/60 hover:bg-white dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-0.5";
  };

  return (
    <aside className="w-64 glass-panel border-r border-border border-y-0 border-l-0 flex flex-col p-5 h-screen sticky top-0 z-10 transition-colors">
      {/* Logo */}
      <div className="flex items-center justify-center mt-[-10px] mb-4">
        <Link href="/">
          <Image src="/logo_v2.png" width={400} height={96} priority alt="Aqbobek International School" className="h-20 w-auto object-contain cursor-pointer transition-transform hover:scale-105" />
        </Link>
      </div>
      
      {/* Nav section */}
      <nav className="flex flex-col gap-2 flex-1 mt-4">
        <h3 className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-3 px-4">
          {pathname.includes('/admin') ? 'Панель управления ИИ' : 'Меню навигации'}
        </h3>
        
        {pathname.includes('/admin') ? (
          <>
            <Link href={`${pathname}?tab=incidents`} prefetch={true} className={getTabClass('incidents') || getTabClass('main')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Инциденты
            </Link>
            <Link href={`${pathname}?tab=voice`} prefetch={true} className={getTabClass('voice')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              Голосовой ввод
            </Link>
            <Link href={`${pathname}?tab=substitutes`} prefetch={true} className={getTabClass('substitutes')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              Замены (AI)
            </Link>
            <Link href={`${pathname}?tab=attendance`} prefetch={true} className={getTabClass('attendance')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Явка учеников
            </Link>
            <Link href={`${pathname}?tab=schedule`} prefetch={true} className={getTabClass('schedule')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              ERP Расписание
            </Link>
            <Link href={`${pathname}?tab=generator`} prefetch={true} className={getTabClass('generator')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              ERP Генератор
            </Link>
            <Link href={`${pathname}?tab=rag`} prefetch={true} className={getTabClass('rag')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Документооборот (RAG)
            </Link>
          </>
        ) : (
          <>
            <Link href={`${pathname}?tab=main`} prefetch={true} className={getTabClass('main')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Дашборд
            </Link>
            <Link href={`${pathname}?tab=messages`} prefetch={true} className={getTabClass('messages')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Сообщения
            </Link>
            <Link href={`${pathname}?tab=schedule`} prefetch={true} className={getTabClass('schedule')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Журнал
            </Link>
          </>
        )}
        
        {/* Общедоступная ссылка для профиля */}
        <Link href={`${pathname}?tab=profile`} prefetch={true} className={activeTab === 'profile' ? getTabClass('profile').replace('text-sidebar-foreground', 'bg-primary text-primary-foreground') : getTabClass('profile')}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          Настройки
        </Link>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2">
        {/* Theme toggle */}
        <button 
          onClick={toggleTheme}
          className="w-full text-left px-3 py-2 rounded-md transition-all text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground flex items-center gap-3"
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          )}
          {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
        </button>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-md transition-all text-sm font-medium text-destructive hover:bg-destructive-light flex items-center gap-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Выход
        </button>
      </div>
    </aside>
  );
}
