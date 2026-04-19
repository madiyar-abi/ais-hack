'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeToggleLanding() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Determine initial theme
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Attempt local storage sync
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore
    }
    
    // Broadcast event so other theme components (like ThemeProvider) can sync if necessary
    window.dispatchEvent(new Event('themechange'));
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Prevent hydration flash
  if (!mounted) {
    return <div className="w-10 h-10"></div>;
  }

  return (
    <button 
      onClick={toggleTheme}
      className="p-2.5 rounded-full border border-slate-200 dark:border-white/20 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-slate-700 dark:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-all flex items-center justify-center shadow-sm"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
