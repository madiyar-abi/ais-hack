'use client';
import React, { useState, useEffect } from 'react';

export default function ProfileTab({ currentUser }: { currentUser: any }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  
  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Fetch latest avatar from the backend on load
    fetch('/api/profile').then(res => res.json()).then(data => {
      if (data.user?.avatar_url) {
        setPreviewAvatar(data.user.avatar_url);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Apply overscroll-none strictly to the parent main scroll container so the Aura background doesn't gap!
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('overscroll-none');
      // Adding position relative to ensure the fixed background creates no context bleed
      mainEl.classList.add('relative');
      return () => {
        mainEl.classList.remove('overscroll-none');
        mainEl.classList.remove('relative');
      }
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPreviewAvatar(event.target.result as string);
        setError('');
        setSuccess('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setError('Пароли не совпадают!');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {};
      if (previewAvatar) payload.avatar_url = previewAvatar;
      if (newPassword) payload.password = newPassword;

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при сохранении');
      
      setSuccess('Профиль успешно обновлен!');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>

      <div className="animate-slide-up-fade w-full max-w-4xl mx-auto pt-4 relative z-10">
        
        <div className="mb-8 p-1">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Личный Профиль</h2>
          <p className="text-base text-slate-600 dark:text-white/60 mt-2 font-medium dark:font-light">Управляйте настройками доступа и личными данными</p>
        </div>

        {error && (
          <div className="mb-6 px-6 py-4 bg-red-500/10 dark:bg-red-500/20 backdrop-blur-md border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold shadow-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 px-6 py-4 bg-indigo-500/10 dark:bg-fuchsia-500/20 backdrop-blur-md border border-indigo-500/20 dark:border-fuchsia-500/30 text-indigo-700 dark:text-fuchsia-300 rounded-2xl text-sm font-semibold shadow-sm">
            {success}
          </div>
        )}

        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md p-8 md:p-10 rounded-[2rem] shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/50 dark:border-white/10 transition-colors duration-500">
          
          <div className="flex flex-col md:flex-row gap-12 items-start">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-6 w-full md:w-1/3 p-6 rounded-3xl bg-white/40 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
              <div className="relative group w-40 h-40 rounded-full overflow-hidden border border-slate-200/60 dark:border-white/10 bg-slate-100 dark:bg-black/40 flex items-center justify-center shadow-md">
                {previewAvatar ? (
                  <img src={previewAvatar} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-16 h-16 text-slate-400 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}
                
                <label className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer">
                  <svg className="w-7 h-7 text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-white text-xs font-semibold tracking-wider uppercase">Изменить</span>
                  <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} />
                </label>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-slate-900 dark:text-white text-xl tracking-tight">{currentUser.full_name}</h3>
                <div className="inline-flex items-center px-3 py-1 mt-2 rounded-full bg-indigo-500/10 dark:bg-fuchsia-500/20 text-indigo-700 dark:text-fuchsia-300 text-xs font-bold uppercase tracking-widest border border-indigo-500/20 dark:border-fuchsia-500/20">
                  {currentUser.role === 'director' ? 'Директор' : currentUser.role === 'teacher' ? 'Учитель' : currentUser.role}
                </div>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="flex-1 flex flex-col gap-8 w-full">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-white/50 mb-6 border-b border-slate-200/50 dark:border-white/10 pb-3">Настройки Безопасности</h3>
                
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-white/60 uppercase tracking-widest mb-2 ml-1">Новый пароль</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ввести секретный ключ"
                      className="w-full px-5 py-3.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-fuchsia-500 outline-none transition-all placeholder-slate-400 dark:placeholder-white/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-white/60 uppercase tracking-widest mb-2 ml-1">Повторите пароль</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Подтвердить секретный ключ"
                      className="w-full px-5 py-3.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-fuchsia-500 outline-none transition-all placeholder-slate-400 dark:placeholder-white/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/50 dark:border-white/10 pt-8 flex justify-end mt-auto">
                <button
                  onClick={handleSave}
                  disabled={saving || (!newPassword && newPassword !== confirmPassword && !previewAvatar)}
                  className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-violet-600 dark:to-fuchsia-500 text-white font-bold tracking-wide uppercase text-sm rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:-translate-y-[1px] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  {saving ? 'Сохранение базы...' : 'Обновить Синхронизацию'}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
