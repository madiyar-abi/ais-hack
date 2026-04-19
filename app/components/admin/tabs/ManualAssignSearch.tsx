'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function ManualAssignSearch({ 
  incidentId, 
  description, 
  allTeachers 
}: { 
  incidentId: string; 
  description: string; 
  allTeachers: any[]; 
}) {
  const [query, setQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const router = useRouter();

  const filtered = query.length > 1 
    ? allTeachers.filter(t => t.full_name?.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleAssign = async (teacher: any) => {
    setIsAssigning(teacher.id);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      await supabase.from('tasks').insert({
        title: 'Вам назначена замена урока',
        description: `Просьба заменить коллегу. Оригинальное сообщение: "${description}"`,
        target_teacher_id: teacher.id,
        status: 'pending'
      });

      await supabase.from('messages').delete().eq('id', incidentId);

      const summaryText = `📢 *Назначена Замена*\n\nВместо отсутствующего учителя замену проведет: *${teacher.full_name}*\n\n_Комментарий к замене: ${description}_`;

      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summaryText })
      });

      setShowSearch(false);
      setQuery('');
      router.refresh();
    } catch (e) {
      console.error('Ошибка назначения:', e);
    } finally {
      setIsAssigning(null);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full py-2.5 px-4 text-sm font-semibold text-muted-foreground bg-muted border border-border rounded-xl hover:bg-muted/80 hover:text-foreground transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Назначить вручную другого учителя
        </button>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Введите фамилию учителя..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-info/50 focus:border-info"
              />
            </div>
            <button
              onClick={() => { setShowSearch(false); setQuery(''); }}
              className="p-2.5 text-muted-foreground hover:text-foreground bg-muted rounded-xl hover:bg-muted/80 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {filtered.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {filtered.slice(0, 8).map((teacher, i) => (
                <div
                  key={teacher.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{teacher.full_name}</p>
                    <p className="text-xs text-muted-foreground">{teacher.specialty || 'Без специальности'}</p>
                  </div>
                  <button
                    onClick={() => handleAssign(teacher)}
                    disabled={isAssigning === teacher.id}
                    className="px-3 py-1.5 text-xs font-bold text-primary-foreground bg-info rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAssigning === teacher.id ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0116 0"/>
                        </svg>
                        Назначаю...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Назначить
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {query.length > 1 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Учитель не найден</p>
          )}
        </div>
      )}
    </div>
  );
}
