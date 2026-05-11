import React, { useState, useRef, useEffect } from 'react';
import { useNexus } from '../store/NexusContext';
import { cn, formatTime, getFileIcon, escapeHtml } from '../lib/utils';
import { ChevronLeft, Trash2, Paperclip, Send, Mic, Image as ImageIcon, File, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ChatArea() {
  const { contacts, activeContactId, setActiveContactId, sendMessage, clearHistory } = useNexus();
  const [inputText, setInputText] = useState('');
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const contact = activeContactId ? contacts[activeContactId] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contact?.messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black/40 p-5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/60 z-0 pointer-events-none" />
        <div className="z-10 flex flex-col items-center">
          <Zap className="w-16 h-16 text-[var(--color-nexus-primary)] opacity-40 mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          <h2 className="text-2xl font-bold mb-2 tracking-tight">No Active Session</h2>
          <p className="font-mono text-xs text-[var(--color-nexus-text-muted)] text-center max-w-[280px] leading-relaxed">
            // SELECT A CONTACT OR CREATE A NEW P2P ENCRYPTED CONNECTION
          </p>
        </div>
      </div>
    );
  }

  const handleSendText = () => {
    if (!inputText.trim()) return;
    sendMessage(contact.id, 'text', inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const startRecord = async () => {
    if (mediaRecorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            sendMessage(contact.id, 'audio', ev.target.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordTime(t => {
          if (t >= 59) { stopRecord(); return 60; }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Microphone access denied.');
    }
  };

  const stopRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancelRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        sendMessage(contact.id, type, ev.target.result, file.name, file.size);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setIsAttachOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-black/40 min-w-0 relative">
      {/* Header */}
      <div className="p-3.5 md:p-4 border-b border-[var(--color-nexus-border)] flex items-center gap-3 bg-[#0a0a0a]/85 backdrop-blur-xl shrink-0 z-10 pt-[calc(14px+env(safe-area-inset-top))]">
        <button onClick={() => setActiveContactId(null)} className="md:hidden p-1.5 -ml-1.5 text-white/80 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="w-11 h-11 rounded-2xl bg-[var(--color-nexus-surface-2)] border border-[var(--color-nexus-border)] flex items-center justify-center text-lg font-bold text-[var(--color-nexus-primary)] uppercase relative shrink-0">
          {contact.name.charAt(0)}
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-nexus-bg)] transition-colors",
            contact.isOnline ? "bg-[var(--color-nexus-primary)] shadow-[0_0_8px_var(--color-nexus-primary)]" : "bg-[var(--color-nexus-text-muted)]"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate">{contact.name}</div>
          <div className={cn("font-mono text-[10px] mt-0.5", contact.isOnline ? "text-[var(--color-nexus-primary)]" : "text-[var(--color-nexus-text-muted)]")}>
            {contact.isOnline ? '🟢 Connected · E2E Encrypted' : '🔒 E2E Encrypted · P2P Direct'}
          </div>
        </div>

        <button 
          onClick={() => { if(confirm('Clear history?')) clearHistory(contact.id); }}
          className="w-9 h-9 rounded-xl bg-white/5 border border-[var(--color-nexus-border)] flex items-center justify-center hover:bg-[var(--color-nexus-danger-dim)] hover:border-[rgba(234,0,0,0.35)] hover:text-[var(--color-nexus-danger)] transition-colors shrink-0"
          title="Clear Chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 md:p-5 overflow-y-auto flex flex-col gap-3 overscroll-contain">
        <AnimatePresence initial={false}>
          {contact.messages.map((msg, i) => {
            const prevMsgDate = i > 0 ? new Date(contact.messages[i-1].time).toDateString() : null;
            const msgDate = new Date(msg.time).toDateString();
            const showDate = prevMsgDate !== msgDate;

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-[var(--color-nexus-border)]" />
                    <span className="font-mono text-[10px] text-[var(--color-nexus-text-muted)]">{msgDate}</span>
                    <div className="flex-1 h-px bg-[var(--color-nexus-border)]" />
                  </div>
                )}
                
                {msg.type === 'sys' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="self-center font-mono text-[10px] text-[var(--color-nexus-text-muted)] bg-black/35 px-4 py-1.5 rounded-full border border-[var(--color-nexus-border)] uppercase tracking-widest max-w-[90%] truncate my-1.5"
                  >
                    {msg.text}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "flex flex-col max-w-[85%] md:max-w-[72%]",
                      msg.sender === 'me' ? "self-end items-end" : "self-start items-start"
                    )}
                  >
                    <div className={cn(
                      "px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm break-words relative overflow-hidden",
                      msg.sender === 'me'
                        ? "bg-white text-black font-medium rounded-br-sm"
                        : "bg-[var(--color-nexus-surface-2)] text-white border border-[var(--color-nexus-border)] rounded-bl-sm"
                    )}>
                      {msg.type === 'text' && (
                        <div dangerouslySetInnerHTML={{ __html: escapeHtml(msg.text!).replace(/\n/g, '<br>') }} />
                      )}
                      {msg.type === 'image' && (
                        <img src={msg.data} alt="Attachment" className="max-w-full max-h-[280px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.data, '_blank')} />
                      )}
                      {msg.type === 'audio' && (
                        <audio controls src={msg.data} className="w-[200px] md:w-[240px] h-10 outline-none rounded-lg" />
                      )}
                      {msg.type === 'file' && (
                        <a href={msg.data} download={msg.fileName} className="flex items-center gap-3 p-2 bg-black/25 rounded-xl border border-black/10 hover:bg-black/40 transition-colors">
                          <span className="text-2xl">{getFileIcon(msg.fileName?.split('.').pop() || '')}</span>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold truncate max-w-[140px]">{msg.fileName}</div>
                            <div className="font-mono text-[9px] opacity-70">Tap to download</div>
                          </div>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 px-1 font-mono text-[9px] text-[var(--color-nexus-text-muted)]">
                      <span>{formatTime(msg.time)}</span>
                      {msg.sender === 'me' && <span className="text-[11px] leading-none">✓</span>}
                    </div>
                  </motion.div>
                )}
              </React.Fragment>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-nexus-danger-dim)] border-t border-[rgba(234,0,0,0.2)] font-mono text-[11px] text-[var(--color-nexus-danger)] shrink-0">
          <div className="w-2 h-2 rounded-full bg-[var(--color-nexus-danger)] animate-pulse" />
          <span>Recording</span>
          <span className="font-bold">
            {Math.floor(recordTime/60)}:{String(recordTime%60).padStart(2,'0')}
          </span>
          <span className="ml-auto text-[10px] text-[var(--color-nexus-text-muted)]">Release to send</span>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 md:p-3.5 border-t border-[var(--color-nexus-border)] bg-[#0a0a0a]/90 backdrop-blur-xl flex items-end gap-2 z-10 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="relative">
          <button 
            onClick={() => setIsAttachOpen(!isAttachOpen)} 
            className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--color-nexus-border)] text-[var(--color-nexus-text-sub)] flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {isAttachOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-[calc(100%+8px)] left-0 bg-[var(--color-nexus-surface)] border border-[var(--color-nexus-border)] rounded-2xl shadow-2xl overflow-hidden min-w-[180px] z-50 p-1"
              >
                <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium">
                  <ImageIcon className="w-4 h-4 text-white" /> Photo / Image
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium">
                  <File className="w-4 h-4 text-white" /> File / Document
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input type="file" ref={fileInputRef} onChange={e => handleFileUpload(e, 'file')} className="hidden" />
        <input type="file" accept="image/*" ref={imageInputRef} onChange={e => handleFileUpload(e, 'image')} className="hidden" />

        <div className="flex-1 bg-white/5 border border-[var(--color-nexus-border)] rounded-2xl px-3.5 py-1 flex items-center focus-within:border-[var(--color-nexus-border-active)] focus-within:bg-white/5 focus-within:ring-2 ring-white/10 transition-all">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contact.isOnline ? "Message..." : "Peer offline..."}
            rows={1}
            disabled={!contact.isOnline}
            className="w-full bg-transparent text-sm py-2.5 outline-none resize-none max-h-[110px] min-h-[40px] leading-relaxed disabled:opacity-50"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {inputText.trim() ? (
          <button
            onClick={handleSendText}
            disabled={!contact.isOnline}
            className="w-10 h-10 rounded-xl bg-white text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center transition-all shrink-0 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onMouseDown={startRecord}
            onMouseUp={stopRecord}
            onMouseLeave={stopRecord}
            onTouchStart={startRecord}
            onTouchEnd={stopRecord}
            onTouchCancel={cancelRecord}
            disabled={!contact.isOnline}
            className={cn(
              "w-10 h-10 rounded-xl border flex items-center justify-center transition-all shrink-0 select-none disabled:opacity-50",
              isRecording
                ? "bg-[var(--color-nexus-danger-dim)] border-[var(--color-nexus-danger)] text-[var(--color-nexus-danger)] shadow-[0_0_15px_rgba(234,0,0,0.3)]"
                : "bg-white/5 border-[var(--color-nexus-border)] text-[var(--color-nexus-text-sub)] hover:bg-white/10 hover:text-white"
            )}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
