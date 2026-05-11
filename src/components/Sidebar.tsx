import React, { useState, useMemo } from 'react';
import { useNexus } from '../store/NexusContext';
import { cn, formatTime } from '../lib/utils';
import { Zap, Plus, Search } from 'lucide-react';

interface SidebarProps {
  onAddPeer: () => void;
}

export function Sidebar({ onAddPeer }: SidebarProps) {
  const { contacts, activeContactId, setActiveContactId } = useNexus();
  const [search, setSearch] = useState('');

  const filteredContacts = useMemo(() => {
    return (Object.values(contacts) as import('../types').Contact[])
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aLast = a.messages.length ? a.messages[a.messages.length - 1].time : 0;
        const bLast = b.messages.length ? b.messages[b.messages.length - 1].time : 0;
        return bLast - aLast;
      });
  }, [contacts, search]);

  return (
    <div className={cn(
      "w-full md:w-80 border-r border-[var(--color-nexus-border)] flex flex-col bg-[#050505]/98 z-20 shrink-0",
      activeContactId ? "hidden md:flex" : "flex"
    )}>
      <div className="p-5 pb-4 border-b border-[var(--color-nexus-border)] flex justify-between items-center z-10 pt-[calc(20px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[var(--color-nexus-primary-dim)] border border-[var(--color-nexus-border-active)] rounded-xl flex items-center justify-center text-[var(--color-nexus-primary)]">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            P2P DIRECT
          </h1>
        </div>
        <button
          onClick={onAddPeer}
          className="bg-[var(--color-nexus-primary-dim)] text-[var(--color-nexus-primary)] border border-[var(--color-nexus-border-active)] w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--color-nexus-primary)] hover:text-black hover:shadow-[0_0_20px_var(--color-nexus-primary-glow)] hover:scale-105 transition-all outline-none"
          title="Add Peer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3.5 pb-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-nexus-text-muted)]" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 rounded-xl bg-white/5 border border-[var(--color-nexus-border)] text-sm outline-none transition-colors focus:border-[var(--color-nexus-border-active)] focus:bg-white/5"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-2.5 overscroll-contain">
        {filteredContacts.length === 0 ? (
          <div className="p-10 text-center font-mono text-xs text-[var(--color-nexus-text-muted)] leading-relaxed">
            <div className="text-3xl mb-3 opacity-50 flex justify-center"><Search className="w-8 h-8" /></div>
            No contacts found.<br />Tap <Plus className="inline w-3 h-3" /> to add a peer.
          </div>
        ) : (
          filteredContacts.map(contact => {
            const lastMsg = contact.messages[contact.messages.length - 1];
            let lastMsgText = 'No messages yet';
            if (lastMsg) {
              if (lastMsg.type === 'image') lastMsgText = '🖼 Photo';
              else if (lastMsg.type === 'audio') lastMsgText = '🎤 Voice message';
              else if (lastMsg.type === 'file') lastMsgText = `📎 ${lastMsg.fileName || 'File'}`;
              else if (lastMsg.type === 'sys') lastMsgText = lastMsg.text || 'System msg';
              else lastMsgText = lastMsg.text || '';
            }

            return (
              <div
                key={contact.id}
                onClick={() => setActiveContactId(contact.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors mb-1 border border-transparent select-none",
                  activeContactId === contact.id
                    ? "bg-white/10 border-white/20"
                    : "hover:bg-[rgba(255,255,255,0.04)] active:bg-[rgba(255,255,255,0.06)]"
                )}
              >
                <div className="w-11 h-11 rounded-2xl bg-[var(--color-nexus-surface-2)] border border-[var(--color-nexus-border)] flex items-center justify-center text-lg font-bold text-[var(--color-nexus-primary)] uppercase relative shrink-0">
                  {contact.name.charAt(0)}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-nexus-bg)] transition-colors",
                    contact.isOnline ? "bg-[var(--color-nexus-primary)] shadow-[0_0_8px_var(--color-nexus-primary)]" : "bg-[var(--color-nexus-text-muted)]"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-0.5 truncate">{contact.name}</div>
                  <div className="text-xs text-[var(--color-nexus-text-muted)] font-mono truncate">{lastMsgText}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {lastMsg && <span className="text-[10px] text-[var(--color-nexus-text-muted)] font-mono">{formatTime(lastMsg.time)}</span>}
                  {contact.unread > 0 && activeContactId !== contact.id && (
                    <span className="bg-[var(--color-nexus-primary)] text-black font-bold text-[10px] min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 font-mono">
                      {contact.unread}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
