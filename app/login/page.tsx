'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '../components/ThemeProvider';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-info/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Theme toggle */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2.5 rounded-xl bg-card border border-card-border text-muted-foreground hover:text-foreground transition-colors shadow-sm"
      >
        {theme === 'light' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        )}
      </button>

      <div className="bg-card p-10 rounded-2xl shadow-lg border border-card-border w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo_v2.png" alt="Aqbobek International School" width={400} height={112} priority className="h-28 w-auto object-contain mb-5" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Вход в систему</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1 text-center">Официальный портал<br/>международной школы</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive-light border border-destructive/20 text-destructive rounded-xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-input-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder-muted-foreground"
              placeholder="Введите логин"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-input-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder-muted-foreground"
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Вход...
              </>
            ) : (
              'Войти в систему'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
