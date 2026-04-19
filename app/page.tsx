import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggleLanding from './components/ThemeToggleLanding';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  let isLoggedIn = false;
  let dashboardUrl = '/login';

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      isLoggedIn = true;
      if (payload.role === 'director' || payload.role === 'deputy') {
        dashboardUrl = '/dashboard/admin';
      } else {
        dashboardUrl = '/dashboard/teacher';
      }
    } catch (e) {
      // Invalid token, just show login
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto overscroll-none relative bg-slate-50 dark:bg-[#0A0512] font-sans selection:bg-fuchsia-500/30 selection:text-white text-slate-900 dark:text-white transition-colors duration-500">
      {/* 
        ====================================================
        AURA BACKGROUND ENGINE
        Light: Pastel Pinks, Indigo, Pale Purples
        Dark: Deep magentas, purples, emeralds
        ====================================================
      */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-20 transition-all duration-700">
         {/* Top Left Orb */}
         <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-pink-300/40 dark:bg-fuchsia-600/30 rounded-full blur-[120px] dark:blur-[140px] mix-blend-multiply dark:mix-blend-screen opacity-70 dark:opacity-80 transition-all duration-700" />
         
         {/* Center Right Orb */}
         <div className="absolute top-[20%] -right-[15%] w-[700px] h-[700px] bg-indigo-300/40 dark:bg-violet-700/40 rounded-full blur-[120px] dark:blur-[160px] mix-blend-multiply dark:mix-blend-screen opacity-70 dark:opacity-90 transition-all duration-700" />
         
         {/* Bottom Center Orb */}
         <div className="absolute -bottom-[20%] left-[20%] w-[600px] h-[600px] bg-purple-300/30 dark:bg-emerald-600/20 rounded-full blur-[120px] dark:blur-[150px] mix-blend-multiply dark:mix-blend-screen opacity-60 dark:opacity-70 transition-all duration-700" />
      </div>

      {/* SVG Noise generator */}
      <div 
         className="fixed inset-0 z-[-10] pointer-events-none opacity-10 dark:opacity-20 mix-blend-overlay transition-opacity duration-500"
         style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
      
      {/* 
        ====================================================
        GLASSMORPHISM HEADER
        ====================================================
      */}
      <header className="sticky top-0 w-full z-50 border-b border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-black/10 backdrop-blur-md transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo_v2.png" width={200} height={40} alt="Aqbobek IS Logo" className="h-10 w-auto opacity-90 dark:opacity-100 dark:brightness-200 transition-all" />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">Aqbobek IS</span>
          </div>
          
          <nav className="hidden md:flex gap-8 items-center">
            <a href="#features" className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#about" className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors">About</a>
          </nav>
          
          <div className="flex items-center gap-3">
            <ThemeToggleLanding />
            
            {!isLoggedIn ? (
              <div className="hidden sm:flex items-center gap-3">
                 <Link href="/login" className="px-6 py-2.5 rounded-full border border-slate-300 dark:border-white/20 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-slate-800 dark:text-white font-medium hover:bg-white dark:hover:bg-white/10 transition-all text-sm">
                   Log In
                 </Link>
                 <Link href="/login" className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-violet-600 dark:to-fuchsia-500 text-white font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:-translate-y-[1px] transition-all text-sm">
                   Get Started
                 </Link>
              </div>
            ) : (
              <Link href={dashboardUrl} className="hidden sm:flex px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-violet-600 dark:to-fuchsia-500 text-white font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-[1px] transition-all text-sm">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 
        ====================================================
        HERO SECTION (Massive Type)
        ====================================================
      */}
      <main className="max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-20 relative z-10">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-white/5 backdrop-blur-sm border border-indigo-100 dark:border-white/10 text-indigo-700 dark:text-white/80 text-xs font-semibold uppercase tracking-widest mb-6 transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 dark:bg-fuchsia-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 dark:bg-fuchsia-500"></span>
            </span>
            Искусственный Интеллект 2026
          </div>
          
          <h1 className="text-6xl sm:text-8xl font-bold dark:font-medium text-slate-900 dark:text-white mb-6 tracking-tight leading-[1.05] transition-colors">
            Единая образовательная<br/>экосистема.
          </h1>
          <p className="text-lg sm:text-2xl font-medium dark:font-light text-slate-600 dark:text-white/70 mb-10 max-w-2xl leading-relaxed transition-colors">
            Инновационный портал управления школой. Автоматическое составление расписаний, контроль дисциплины через ИИ и моментальное взаимодействие персонала через WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2">
            <Link href={isLoggedIn ? dashboardUrl : "/login"} className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-violet-600 dark:to-fuchsia-500 text-white font-medium text-sm tracking-wide uppercase hover:-translate-y-[2px] transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] dark:shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center gap-2">
              ОТКРЫТЬ ДОСТУП
            </Link>
            <a href="#features" className="px-8 py-4 rounded-full border border-slate-300 dark:border-white/20 bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-800 dark:text-white font-medium text-sm tracking-wide uppercase hover:bg-white dark:hover:bg-white/10 transition-all flex items-center justify-center">
              УЗНАТЬ БОЛЬШЕ
            </a>
          </div>
        </div>

        {/* 
          ====================================================
          PRODUCT PREVIEW / STATS (Glassmorphism)
          ====================================================
        */}
        <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-6 p-8 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-200/60 dark:border-white/10 rounded-[2rem] shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors duration-500">
          <div className="flex flex-col items-center text-center border-r border-slate-200/60 dark:border-white/10 last:border-0 md:last:border-r-0">
            <span className="text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-2">0%</span>
            <span className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/60">Накладок в расписании</span>
          </div>
          <div className="flex flex-col items-center text-center md:border-r border-slate-200/60 dark:border-white/10">
            <span className="text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-2">+40%</span>
            <span className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/60">Экономия времени учителей</span>
          </div>
          <div className="flex flex-col items-center text-center border-r border-slate-200/60 dark:border-white/10">
            <span className="text-5xl font-light tracking-tight text-purple-600 dark:text-fuchsia-400 mb-2">24/7</span>
            <span className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/60">ИИ-Мониторинг школы</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-2">100%</span>
            <span className="text-sm font-medium dark:font-light text-slate-600 dark:text-white/60">WhatsApp интеграция</span>
          </div>
        </div>

        {/* 
          ====================================================
          FEATURES SECTION
          ====================================================
        */}
        <div id="features" className="mt-40">
          <h2 className="text-4xl sm:text-6xl font-bold dark:font-medium tracking-tight text-center mb-20 text-slate-900 dark:text-white transition-colors">Ключевые преимущества.</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/60 dark:hover:bg-white/10 transition-colors duration-300">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-white/10 text-indigo-600 dark:text-white flex items-center justify-center mb-8 border border-indigo-200 dark:border-white/10 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <h3 className="text-2xl font-bold dark:font-medium text-slate-900 dark:text-white mb-4 tracking-tight">AI-Синтез расписания</h3>
              <p className="text-slate-600 dark:text-white/60 font-medium dark:font-light leading-relaxed">
                Интеллектуальная система автоматически предотвращает накладки кабинетов и преподавателей, балансируя нагрузку по всей школе.
              </p>
            </div>

            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/60 dark:hover:bg-white/10 transition-colors duration-300">
              <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-fuchsia-500/20 text-pink-600 dark:text-fuchsia-300 flex items-center justify-center mb-8 border border-pink-200 dark:border-fuchsia-500/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-2xl font-bold dark:font-medium text-slate-900 dark:text-white mb-4 tracking-tight">WhatsApp Бот</h3>
              <p className="text-slate-600 dark:text-white/60 font-medium dark:font-light leading-relaxed">
                Учителя могут фиксировать инциденты, запрашивать канцтовары и узнавать свое расписание прямо через привычный чат WhatsApp.
              </p>
            </div>

            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/60 dark:hover:bg-white/10 transition-colors duration-300">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-violet-500/20 text-purple-600 dark:text-violet-300 flex items-center justify-center mb-8 border border-purple-200 dark:border-violet-500/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-2xl font-bold dark:font-medium text-slate-900 dark:text-white mb-4 tracking-tight">Глубокая Аналитика</h3>
              <p className="text-slate-600 dark:text-white/60 font-medium dark:font-light leading-relaxed">
                Автоматический сбор данных о поведении учеников. Директор видит всю статистику нарушений и динамику успеваемости в реальном времени.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-white/10 mt-32 py-12 bg-slate-100/50 dark:bg-black/20 backdrop-blur-md relative z-10 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <Image src="/logo_v2.png" width={200} height={32} alt="Logo" className="h-8 w-auto mx-auto mb-6 opacity-[0.15] dark:opacity-30 grayscale dark:brightness-200 transition-all" />
          <p className="text-sm font-medium dark:font-light text-slate-400 dark:text-white/40 tracking-wide uppercase">© 2026 Aqbobek International School</p>
        </div>
      </footer>
    </div>
  );
}
