import React from 'react';

import Image from 'next/image';

type SidebarProps = {
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  categories: { id: string; name: string }[];
};

export default function Sidebar({ activeCategory, onSelectCategory, categories }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen p-6 flex flex-col gap-6 shadow-sm">
      <div className="flex flex-col items-center justify-center py-2">
        <Image src="/logo_v2.png" width={400} height={96} priority alt="Aqbobek Lyceum" className="h-24 w-auto object-contain cursor-pointer transition-transform hover:scale-105" />
      </div>
      
      <div className="flex flex-col gap-1 mt-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Фильтры (AI)</h3>
        
        <button 
          onClick={() => onSelectCategory(null)}
          className={`text-left px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
            activeCategory === null 
              ? 'bg-[#0F172A] text-white shadow-sm' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          Все сообщения
        </button>
        
        {categories.map((cat) => (
          <button 
            key={cat.id || cat.name} 
            onClick={() => onSelectCategory(cat.name)}
            className={`text-left px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
              activeCategory === cat.name 
                ? 'bg-[#0F172A] text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
