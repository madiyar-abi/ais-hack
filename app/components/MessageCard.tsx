import React from 'react';

type Category = {
  id: string;
  name: string;
  color_badge: string;
};

type Message = {
  id: string;
  text: string;
  sender_name: string;
  sender_phone: string;
  timestamp: string;
  is_read: boolean;
  urgency_level: number;
  category: Category | null;
};

export default function MessageCard({ message }: { message: Message }) {
  const isUrgent = message.urgency_level === 2;
  const date = new Date(message.timestamp);
  
  // Форматирование времени
  const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dateString = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <div className={`p-5 mb-4 bg-white rounded-2xl shadow-sm border transition-shadow hover:shadow-md ${
      isUrgent ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
    }`}>
      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 text-sm">{message.sender_name}</span>
          <span className="text-xs text-slate-500 mt-0.5">{message.sender_phone}</span>
        </div>
        <div className="flex items-center gap-2">
           {!message.is_read && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" title="Новое сообщение"></span>
          )}
          <span className="text-xs font-medium text-slate-500 bg-slate-100/80 px-2 py-1 rounded-md">
            {timeString}, {dateString}
          </span>
        </div>
      </div>
      
      <p className="text-slate-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{message.text}</p>
      
      <div className="flex items-center gap-2 mt-4 pt-1">
        {message.category ? (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${message.category.color_badge}`}>
            {message.category.name}
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Без категории
          </span>
        )}
        
        {isUrgent && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            🔥 Срочно!
          </span>
        )}
      </div>
    </div>
  );
}
