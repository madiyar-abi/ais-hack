import React from 'react';

type Message = {
  id: string;
  is_read: boolean;
  urgency_level: number;
  category: { name: string } | null;
};

export default function DashboardStats({ messages }: { messages: Message[] }) {
  const unreadCount = messages.filter(m => !m.is_read).length;
  const urgentCount = messages.filter(m => m.urgency_level === 2).length;
  const complaintsCount = messages.filter(m => m.category?.name === 'Жалобы').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Непрочитанные</span>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-800">{unreadCount}</span>
          <span className="text-sm font-medium text-slate-400">сообщений</span>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <span className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-2">Требуют внимания</span>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-red-600">{urgentCount}</span>
          <span className="text-sm font-medium text-red-400">срочных дел</span>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <span className="text-sm font-semibold text-orange-500 uppercase tracking-wide mb-2">Новые жалобы</span>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-orange-600">{complaintsCount}</span>
          <span className="text-sm font-medium text-orange-400">запросов</span>
        </div>
      </div>
    </div>
  );
}
