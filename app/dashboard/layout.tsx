import { Suspense } from 'react';
import DashboardSidebar from '../components/DashboardSidebar';
import RealtimeNotifications from '../components/RealtimeNotifications';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex text-foreground relative z-0 overflow-hidden bg-background">
      
      {/* Background Aura Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-2]">
        {/* Aura background effects removed to fix page refresh paint blur/lag */}
      </div>

      {/* Noise Texture */}
      <div className="fixed inset-0 bg-noise pointer-events-none z-[-1]"></div>

      <RealtimeNotifications />
      
      {/* Боковая панель (Glassmorphism) */}
      <Suspense fallback={
        <aside className="w-64 glass-panel flex flex-col p-5 h-screen sticky top-0 z-10 border-r border-border">
          <div className="flex flex-col items-center justify-center py-3 mb-6">
            <div className="h-24 w-24 rounded-full bg-muted/50 animate-pulse" />
          </div>
        </aside>
      }>
        <DashboardSidebar />
      </Suspense>

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-y-auto scrollbar-hide relative z-10 transition-colors duration-500">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
