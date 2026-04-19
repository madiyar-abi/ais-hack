import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Импортируем вкладки-компоненты
import IncidentsTab from '../../components/admin/tabs/IncidentsTab';
import VoiceAITab from '../../components/admin/tabs/VoiceAITab';
import SubstituteTab from '../../components/admin/tabs/SubstituteTab';
import BureaucraticRagTab from '../../components/admin/tabs/BureaucraticRagTab';
import AttendanceTab from '../../components/admin/tabs/AttendanceTab';
import ProfileTab from '../../components/profile/ProfileTab';
import SmartScheduleTab from '../../components/admin/tabs/SmartScheduleTab';
import GeneratorTab from '../../components/admin/tabs/GeneratorTab';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

// Мгновенный ответ Server Component
export default async function AdminDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  // По умолчанию 'schedule' для демо
  const currentTab = params?.tab || 'schedule';

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  let user: any = { role: 'director', full_name: 'Пользователь ИИ', id: null };
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      user = payload;
    } catch(e) {}
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-heading">Панель управления (ИИ)</h1>
          <p className="text-muted-foreground mt-2 text-lg">
             Модуль аналитики и автоматизации. Пользователь: <span className="font-semibold text-foreground">{user.full_name}</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Suspense key={currentTab} fallback={
          <div className="bg-card border border-border p-8 rounded-3xl mt-2 min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
              <p className="text-muted-foreground font-semibold tracking-wide animate-pulse">ИИ анализирует данные...</p>
            </div>
          </div>
        }>
          <AdminContentRouter currentTab={currentTab} user={user} />
        </Suspense>
      </div>
    </div>
  );
}

// Отдельный Server-роутер для изоляции Suspense
function AdminContentRouter({ currentTab, user }: { currentTab: string, user: any }) {
  if (currentTab === 'schedule') {
    return <SmartScheduleTab user={user} />;
  }
  if (currentTab === 'generator') {
    return <GeneratorTab />;
  }
  if (currentTab === 'profile') {
    return <ProfileTab currentUser={user} />;
  }
  if (currentTab === 'voice') {
    return <VoiceAITab user={user} />;
  }
  if (currentTab === 'substitutes') {
    return <SubstituteTab user={user} />;
  }
  if (currentTab === 'rag') {
    return <BureaucraticRagTab user={user} />;
  }
  if (currentTab === 'attendance') {
    return <AttendanceTab user={user} />;
  }
  if (currentTab === 'incidents') {
    return <IncidentsTab user={user} />;
  }
  
  // По умолчанию 'schedule'
  return <SmartScheduleTab user={user} />;
}
