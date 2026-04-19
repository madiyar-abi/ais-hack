'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import MessageCard from './components/MessageCard';
import DashboardStats from './components/DashboardStats';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type Category = {
  id: string;
  name: string;
  color_badge: string;
};

// Тип для юзера из JWT
type AuthUser = {
  id: string;
  login: string;
  role: string;
  full_name: string;
  category_id: string | null;
};

export default function DashboardClient({ user }: { user: AuthUser }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Директор (admin) может видеть все категории (null = все), учитель - только свою (зафиксированную)
  const isTeacher = user.role === 'teacher';
  const initialCategory = isTeacher && user.category_id ? user.category_id : null;
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(initialCategory);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);

    const { data: msgData, error } = await supabase
      .from('messages')
      .select('*, category:categories(*)')
      .order('timestamp', { ascending: false });

    if (!error && msgData) {
      setMessages(msgData);
    }
    setLoading(false);
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Фильтрация
  // Учитель видит только свою категорию. Если у учителя category_id = null (не назначена), 
  // ему может выводиться пустой список или все (зависит от бизнес-логики). Сделаем строго: только категория.
  const allowedMessages = isTeacher && user.category_id
      ? messages.filter(m => m.category_id === user.category_id)
      : messages;

  const filteredMessages = activeCategoryId && !isTeacher
    ? allowedMessages.filter(m => m.category_id === activeCategoryId) 
    : allowedMessages;

  // Имя активной категории для UI
  const activeCatName = categories.find(c => c.id === activeCategoryId)?.name;

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      {!isTeacher && (
        <Sidebar 
          activeCategory={activeCatName || null} 
          onSelectCategory={(name) => {
            const c = categories.find(cat => cat.name === name);
            setActiveCategoryId(c ? c.id : null);
          }} 
          categories={categories} 
        />
      )}
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              {isTeacher ? `Кабинет сотрудника: ${user.full_name}` : 'Дашборд директора'}
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Мониторинг обращений и инцидентов
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchData} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all focus:ring-2 focus:ring-slate-200 outline-none">
              Обновить
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 shadow-sm transition-all focus:ring-2 focus:ring-red-200 outline-none">
              Выход
            </button>
          </div>
        </header>

        {/* Скрываем общую статистику от учителей, либо показываем только их стату */}
        {!isTeacher && <DashboardStats messages={messages} />}
        
        <div className="flex items-center justify-between mb-6 mt-6">
          <h2 className="text-xl font-bold text-slate-800">
            {isTeacher 
              ? 'Ваши задачи' 
              : (activeCatName ? `Лента: ${activeCatName}` : 'Вся лента сообщений')}
          </h2>
          <span className="bg-slate-200 text-slate-700 py-1.5 px-3 rounded-full text-xs font-bold tracking-wide">
            {filteredMessages.length} СООБЩЕНИЙ
          </span>
        </div>

        <div className="max-w-4xl">
          {loading ? (
            <div className="animate-pulse flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-slate-200 rounded-2xl w-full"></div>
              ))}
            </div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map(msg => (
              <MessageCard key={msg.id} message={msg} />
            ))
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-slate-500 font-medium">В этой категории пока нет сообщений.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
