'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

type ToastType = 'success' | 'error' | 'info';

  // Single session task retention inside localStorage
const VOICE_SESSION_KEY = 'voice_latest_session';

export default function VoiceAITab({ user }: { user: any }) {
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [aiTasks, setAiTasks] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [tasksAssigned, setTasksAssigned] = useState(false);

  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Restore latest session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VOICE_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.tasks && parsed.tasks.length > 0) {
          setAiTasks(parsed.tasks);
          setTasksAssigned(parsed.assigned || false);
        }
      }
    } catch {}
  }, []);

  // Save latest session on change
  useEffect(() => {
    try {
      localStorage.setItem(VOICE_SESSION_KEY, JSON.stringify({ tasks: aiTasks, assigned: tasksAssigned }));
    } catch {}
  }, [aiTasks, tasksAssigned]);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      setAiTasks([]);
      audioChunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            processAiAudio(reader.result as string, mediaRecorder.mimeType);
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setTasksAssigned(false);
        setAiTasks([]);
      } catch (err) {
        console.error('Microphone error:', err);
        showToast('Нет доступа к микрофону. Проверьте разрешения браузера.', 'error');
      }
    }
  };

  const processAiAudio = async (base64Audio: string, mimeType: string) => {
    setProcessing(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, role');

      const res = await fetch('/api/voice-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64Audio, mimeType, profiles: profiles || [] }),
      });

      const data = await res.json();
      if (data.status === 'success' && data.tasks && data.tasks.length > 0) {
        setAiTasks(data.tasks);
      } else if (data.status === 'error') {
        showToast(`Ошибка ИИ: ${data.error}`, 'error');
      } else {
        showToast('ИИ не смог выявить поручений. Говорите чётче и ближе к микрофону.', 'info');
      }
    } catch (e) {
      console.error(e);
      showToast('Ошибка сети при обращении к ИИ.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (aiTasks.length === 0) return;
    setIsSending(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1. Insert tasks to DB
      const validTasks = aiTasks.filter((t) => t.targetTeacherId);
      for (const task of validTasks) {
        const { error } = await supabase.from('tasks').insert({
          title: task.taskName,
          description: task.description,
          target_teacher_id: task.targetTeacherId,
          status: 'pending',
        });
        if (error) console.error('DB insert error:', error);
      }

      // 2. Send to WhatsApp group (non-blocking, bot may be offline)
      try {
        const groupId = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_ID || '120363433079394966@g.us';
        const lines = validTasks.map((t, i) => `${i + 1}. ${t.assignedTo}: ${t.taskName}`).join('\n');
        const text = `📢 Голосовые поручения (ИИ-Диспетчер)\n\n${lines}\n\nЗадачи записаны в систему.`;

        await fetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, groupId }),
        });
      } catch (botErr) {
        console.warn('WhatsApp bot unavailable (non-critical):', botErr);
      }

      showToast(`✓ ${validTasks.length} поручение(я) записаны и отправлены в WhatsApp.`, 'success');

      // Mark as assigned but do NOT clear aiTasks so they remain on screen
      setTasksAssigned(true);
    } catch (err) {
      console.error(err);
      showToast('Ошибка при сохранении задач в базу данных.', 'error');
    } finally {
      setShowConfirmModal(false);
      setIsSending(false);
    }
  };

  const hasValidTasks = aiTasks.some((t) => t.targetTeacherId);

  const toastColors: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-2xl animate-in slide-in-from-bottom-4 ${toastColors[toast.type]}`}>
          {toast.type === 'success' && (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="glass-panel p-8 rounded-3xl min-h-[500px]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-2xl text-info shadow-inner border border-info/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-foreground">Голосовой помощник (Voice AI)</h2>
              <p className="text-base text-slate-500 dark:text-white/50 mt-1">Система понимает ваш голос, разделяет поручения и автоматически распределяет их сотрудникам</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Mic panel */}
          <div className="w-full md:w-1/3 flex flex-col items-center justify-center p-8 bg-white/5 dark:bg-white/5 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-3xl relative overflow-hidden">
            {isRecording && <div className="absolute inset-0 bg-destructive/10 animate-pulse blur-3xl rounded-full" />}

            <button
              onClick={toggleRecording}
              className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-300 ease-out hover:scale-105 active:scale-95 z-10 ${
                isRecording
                  ? 'bg-destructive hover:bg-destructive/90 shadow-[0_0_60px_rgba(239,68,68,0.6)]'
                  : 'bg-primary hover:bg-primary/90 shadow-[0_20px_40px_-10px_rgba(14,165,233,0.3)]'
              }`}
            >
              {isRecording && <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-75" />}
              {isRecording ? (
                <div className="flex items-center gap-1.5 h-10">
                  <span className="w-1.5 h-6 bg-white rounded-full animate-pulse" />
                  <span className="w-1.5 h-10 bg-white rounded-full animate-bounce" />
                  <span className="w-1.5 h-4 bg-white rounded-full animate-pulse delay-75" />
                  <span className="w-1.5 h-8 bg-white rounded-full animate-bounce delay-100" />
                  <span className="w-1.5 h-5 bg-white rounded-full animate-pulse delay-150" />
                </div>
              ) : (
                <svg className="w-12 h-12 text-primary-foreground drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-white/50 relative z-10 text-center">
              {isRecording ? 'Запись аудио...' : 'Нажмите чтобы говорить'}
              <br />
              {!isRecording && <span className="opacity-60 text-[9px]">Звук анализируется напрямую (Gemini STT)</span>}
            </p>
          </div>

          {/* Output panel */}
          <div className="w-full md:w-2/3 flex flex-col gap-4">
            <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col relative transition-all z-10 justify-center items-center h-[180px]">
              {isRecording ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-8 h-8 text-destructive animate-pulse">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </div>
                  <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">Идет запись голоса...</h3>
                  <span className="text-xs text-muted-foreground max-w-sm">Завершите запись, нажав на кнопку микрофона.</span>
                </div>
              ) : processing ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Анализ аудио датасета...</h3>
                  <span className="text-xs text-muted-foreground text-center">Gemini 2.5 Flash слушает ваш голос и формирует задачи...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" /></svg>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Готово к работе</h3>
                  <span className="text-xs text-muted-foreground max-w-xs text-center">Продвинутый аудиальный парсер Gemini готов. Просто продиктуйте поручения.</span>
                </div>
              )}
            </div>

            {aiTasks.length > 0 && (
              <div className={`border rounded-xl p-6 transition-colors ${hasValidTasks ? 'border-primary/30 bg-primary/5' : 'border-orange-300/30 bg-orange-500/5'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${hasValidTasks ? 'text-primary' : 'text-orange-500'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Разбор задач ИИ
                </h3>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-3">
                    {aiTasks.map((task, idx) => (
                      <div key={idx} className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Задача {idx + 1}</span>
                            <p className="font-bold text-foreground mt-0.5">{task.taskName}</p>
                          </div>
                          {task.targetTeacherId ? (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-bold leading-none flex items-center gap-1.5 whitespace-nowrap">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Найден
                            </span>
                          ) : (
                            <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-bold leading-none">Не найден</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">"{task.description}"</p>
                        <div className="bg-muted px-3 py-2 rounded-lg mt-1 flex gap-2 items-center">
                          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span className="text-xs font-semibold text-foreground">Исполнитель: {task.assignedTo}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={!hasValidTasks || tasksAssigned}
                    className={`mt-3 w-full py-3.5 text-primary-foreground text-sm font-bold rounded-xl shadow-sm transition-all ${tasksAssigned ? 'bg-emerald-500 hover:bg-emerald-600' : hasValidTasks ? 'bg-primary hover:opacity-90 hover:scale-[1.01]' : 'bg-muted pointer-events-none opacity-40'}`}
                  >
                    {tasksAssigned ? '✅ Распределено' : 'Назначить в Систему'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 shadow-xl w-full max-w-sm border border-border transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4 mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </div>
            <h3 className="text-lg font-bold text-center text-foreground mb-2">Запустить в работу?</h3>
            <p className="text-sm text-center text-muted-foreground mb-6">
              Исполнители получат задачи в личный кабинет, а в директорскую WhatsApp-группу будет отправлен список поручений.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSending}
                className="flex-1 py-2.5 font-bold text-sm text-muted-foreground bg-muted rounded-xl hover:opacity-80 transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isSending}
                className="flex-1 py-2.5 font-bold text-sm text-primary-foreground bg-primary rounded-xl hover:opacity-90 shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Отправка...</span>
                  </>
                ) : (
                  'Подтвердить'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
