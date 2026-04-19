'use client';
import React, { useState, useEffect } from 'react';

const RAG_CHAT_KEY = 'bureaucratic_rag_chat_history';

export default function BureaucraticRagTab({ user }: { user: any }) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  // Для режима чата-генератора
  const [mode, setMode] = useState<'tools' | 'generator'>('tools');
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);

  // Restore latest chat session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RAG_CHAT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setChatHistory(parsed);
        }
      }
    } catch {}
  }, []);

  // Save latest chat session on change
  useEffect(() => {
    try {
      localStorage.setItem(RAG_CHAT_KEY, JSON.stringify(chatHistory));
    } catch {}
  }, [chatHistory]);

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type: 'error' | 'warning' | 'success' }>({ isOpen: false, message: '', type: 'error' });
  const showAlert = (message: string, type: 'error' | 'warning' | 'success' = 'error') => setAlertModal({ isOpen: true, message, type });

  const handleExportToWord = (contentMarkdown: string, filename = 'Документ.doc') => {
    // Специальный парсер для формирования красивых "ГОСТ" документов для директора
    let wordHtml = contentMarkdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .map(line => {
         const trimmed = line.trim();
         if (!trimmed) return '<br>';
         
         // Заголовок документа (ПРИКАЗ, РАСПОРЯЖЕНИЕ, УВЕДОМЛЕНИЕ)
         if (/^#*\s*(ПРИКАЗ|АКТ|ВЫПИСКА|СПРАВКА|ЗАЯВЛЕНИЕ|УВЕДОМЛЕНИЕ)/i.test(trimmed)) {
            return `<div class="title">${trimmed.replace(/^#+\s*/, '')}</div>`;
         }
         // Командное слово (ПРИКАЗЫВАЮ)
         if (/^#*\s*(ПРИКАЗЫВАЮ|ПОСТАНОВЛЯЮ|РЕШИЛ|УВЕДОМЛЯЮ|ОБЯЗЫВАЮ):/i.test(trimmed)) {
            return `<div class="commandWord">${trimmed.replace(/^#+\s*/, '')}</div>`;
         }
         // Любой другой заголовок
         if (/^#+\s/.test(trimmed)) {
            return `<div class="subtitle">${trimmed.replace(/^#+\s*/, '')}</div>`;
         }
         // Дата / Город
         if (/^(от |г\.|город |№ )/i.test(trimmed) && trimmed.length < 50) {
            return `<div class="right-align">${trimmed}</div>`;
         }
         // Подпись директора/руководителя
         if (/^(Директор|Завуч|Руководитель|И\.о\.|Учитель|Классный)/i.test(trimmed)) {
            // Вычленяем должность и ФИО, если оно есть
            const parts = trimmed.split(/_| {4,}|\t/);
            const position = parts[0] ? parts[0].trim() : 'Директор';
            // Если ИИ само ФИО сгенерировало, пытаемся оставить его, иначе просто плейсхолдер
            const name = parts[parts.length - 1].length > 3 ? parts[parts.length - 1].trim() : 'Ф.И.О.';
            
            return `<div class="signature">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                         <tr>
                           <td align="left" width="40%"><strong>${position}</strong></td>
                           <td align="center" width="20%">_________________</td>
                           <td align="right" width="40%">${name}</td>
                         </tr>
                      </table>
                    </div>`;
         }
         // Нумерованные списки
         if (/^\d+\./.test(trimmed)) {
            return `<div class="list-item">${trimmed}</div>`;
         }
         if (/^- /.test(trimmed)) {
             return `<div class="list-item">• ${trimmed.substring(2)}</div>`;
         }
         
         // Preamble / Обычный абзац
         return `<p>${trimmed}</p>`;
      })
      .join('\n');

    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Doc</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; padding: 2cm 1.5cm; }
          p { text-indent: 1.25cm; margin: 0 0 6pt 0; text-align: justify; }
          .title { text-align: center; font-weight: bold; font-size: 16pt; margin-top: 10pt; margin-bottom: 20pt; text-transform: uppercase; }
          .subtitle { text-align: center; font-weight: bold; font-size: 14pt; margin-top: 10pt; margin-bottom: 10pt; }
          .commandWord { text-align: left; font-weight: bold; font-size: 14pt; margin-top: 15pt; margin-bottom: 10pt; }
          .right-align { text-align: right; margin-bottom: 5pt; font-style: italic; }
          .signature { margin-top: 40pt; page-break-inside: avoid; }
          .list-item { margin-left: 1.25cm; text-indent: -1.25cm; text-align: justify; margin-bottom: 4pt; }
        </style>
      </head><body>`;
    const postHtml = `</body></html>`;
    const html = preHtml + wordHtml + postHtml;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Документ успешно сгенерирован по официальным стандартам!', 'success');
  };

  const handleAction = async (actionType: 'check' | 'translate' | 'generate') => {
    if (!inputText.trim()) return showAlert('Пожалуйста, введите текст', 'warning');
    
    setIsProcessing(true);
    setResult(null);

    if (actionType === 'generate') {
      setChatHistory(prev => [...prev, { role: 'user', content: inputText }]);
    }

    try {
      const res = await fetch('/api/bureaucratic-rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           action: actionType, 
           text: inputText,
           history: actionType === 'generate' ? chatHistory : undefined
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (actionType === 'generate') {
         setChatHistory(prev => [...prev, { role: 'model', content: data.result }]);
         setInputText('');
      } else {
         setResult(data.result);
      }
    } catch (e: any) {
      console.error(e);
      showAlert('Ошибка: ' + e.message, 'error');
      
      if (actionType === 'generate') {
          setChatHistory(prev => prev.slice(0, -1));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-3xl min-h-[600px] flex flex-col gap-6 relative">
      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border p-5 animate-in zoom-in-95 flex flex-col gap-3">
             <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-full ${alertModal.type === 'error' ? 'bg-rose-500/10 text-rose-500' : alertModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {alertModal.type === 'success' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    )}
                 </div>
                 <h3 className="font-bold text-lg text-foreground">{alertModal.type === 'error' ? 'Ошибка' : alertModal.type === 'success' ? 'Успех' : 'Внимание'}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{alertModal.message}</p>
              <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="mt-2 w-full py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors">Понятно</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
           <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 transition-colors duration-500">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              ИИ-Секретарь (RAG Ассистент)
           </h2>
           {/* Переключатель режимов */}
           <div className="flex bg-muted/50 p-1 rounded-full border border-border">
              <button 
                 onClick={() => setMode('tools')} 
                 className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'tools' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                 Инструменты
              </button>
              <button 
                 onClick={() => setMode('generator')} 
                 className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'generator' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                 Генератор приказов
              </button>
           </div>
           {mode === 'generator' && chatHistory.length > 0 && (
             <button
               onClick={() => {
                 if (confirm('Очистить историю генератора?')) {
                   setChatHistory([]);
                   localStorage.removeItem(RAG_CHAT_KEY);
                 }
               }}
               className="ml-3 text-xs text-rose-500 hover:text-rose-600 font-bold transition-colors"
             >
               Очистить чат
             </button>
           )}
        </div>
        <p className="text-slate-500 dark:text-white/50 text-base">
          {mode === 'tools' 
            ? 'Переводчик с чиновничьего языка на человеческий и проверка на нарушения.' 
            : 'Умный генератор документов. Попросите ИИ задизайнить приказ, он задаст уточняющие вопросы и создаст драфт.'}
        </p>
      </div>

      {/* Connected DB Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-500 dark:text-white/40 mr-2 uppercase tracking-wider">Знания:</span>
        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-full flex items-center gap-1 tabular-nums transition-colors duration-500">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Приказ №76
        </span>
        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-full flex items-center gap-1 tabular-nums transition-colors duration-500">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Приказ №110
        </span>
        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-full flex items-center gap-1 tabular-nums transition-colors duration-500">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Приказ №130
        </span>
      </div>

      {mode === 'generator' && chatHistory.length > 0 && (
         <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin">
            {chatHistory.map((msg, idx) => (
               <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1 ml-2 mr-2">
                     {msg.role === 'user' ? 'Вы' : 'ИИ-Секретарь'}
                  </span>
                  <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/40 border border-border rounded-tl-sm text-foreground'}`}>
                     <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                     {msg.role === 'model' && (
                        <button 
                           onClick={() => handleExportToWord(msg.content, `Приказ_${new Date().getTime()}.doc`)}
                           className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-colors"
                        >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           Скачать в Word (.doc)
                        </button>
                     )}
                  </div>
               </div>
            ))}
            {isProcessing && (
               <div className="self-start flex items-center gap-2 text-muted-foreground text-sm font-medium animate-pulse ml-2">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                  Печатает...
               </div>
            )}
         </div>
      )}

      {/* Input */}
      <div className="flex flex-col gap-3 mt-auto">
        <label className="text-sm font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">
           {mode === 'tools' ? 'Текст для анализа:' : 'Опишите задачу или ответьте на вопросы ИИ:'}
        </label>
        <div className="relative">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
               if (e.key === 'Enter' && !e.shiftKey && mode === 'generator') {
                  e.preventDefault();
                  handleAction('generate');
               }
            }}
            placeholder={mode === 'tools' ? "Вставьте текст приказа или проект расписания..." : "Например: Создай строгий приказ об увольнении Иванова за опоздания..."}
            className="w-full bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground transition-all min-h-[100px]"
          ></textarea>
          
          {mode === 'generator' && (
             <button
               onClick={() => handleAction('generate')}
               disabled={isProcessing || !inputText.trim()}
               className="absolute bottom-4 right-4 bg-primary hover:bg-primary-hover text-primary-foreground p-2 rounded-full shadow-md transition-all disabled:opacity-50"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
             </button>
          )}
        </div>
      </div>

      {/* Actions (Only in tools mode) */}
      {mode === 'tools' && (
         <div className="flex gap-4">
           <button
             onClick={() => handleAction('check')}
             disabled={isProcessing}
             className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-3 px-4 rounded-full shadow-md hover:-translate-y-0.5 transition-all focus:outline-none disabled:opacity-50"
           >
             {isProcessing ? 'Анализирую...' : 'Проверить на нарушения'}
           </button>
           <button
             onClick={() => handleAction('translate')}
             disabled={isProcessing}
             className="flex-1 bg-white/10 dark:bg-white/5 backdrop-blur-md hover:bg-white/20 dark:hover:bg-white/10 text-foreground font-semibold py-3 px-4 rounded-full border border-border hover:-translate-y-0.5 transition-all disabled:opacity-50"
           >
             {isProcessing ? 'Перевожу...' : 'Упростить в чек-лист'}
           </button>
         </div>
      )}

      {/* Result (Only in tools mode) */}
      {mode === 'tools' && result && (
        <div className="mt-2 p-6 bg-muted/30 border border-border rounded-2xl glass-panel animate-slide-up-fade">
          <h3 className="text-lg font-bold text-foreground mb-4">Результат обработки:</h3>
          <div 
            className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed mb-4"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(result) }}
          />
          <button 
             onClick={() => handleExportToWord(result, `Документ_${new Date().getTime()}.doc`)}
             className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             Скачать результат в Word (.doc)
          </button>
        </div>
      )}
    </div>
  );
}

// Простой парсер маркдауна для отображения результата
function formatMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n# (.*?)\n/g, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\n## (.*?)\n/g, '<h2 class="text-lg font-bold mt-3 mb-1">$1</h2>')
    .replace(/\n### (.*?)\n/g, '<h3 class="text-md font-bold mt-2 mb-1">$1</h3>');
}
