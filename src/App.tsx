import { useState } from 'react';
import { NexusProvider, useNexus } from './store/NexusContext';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AddPeerModal } from './components/AddPeerModal';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';

function NexusApp() {
  const { myName, setMyName } = useNexus();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempName, setTempName] = useState('');

  if (!myName) {
    return (
      <div className="flex w-full h-full items-center justify-center p-4 bg-[var(--color-nexus-bg)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_50%,rgba(255,255,255,0.035)_0%,transparent_60%),radial-gradient(ellipse_50%_40%_at_90%_20%,rgba(255,255,255,0.03)_0%,transparent_60%)] pointer-events-none z-0" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--color-nexus-surface)] border border-[var(--color-nexus-border)] rounded-3xl p-8 max-w-sm w-full z-10 shadow-2xl flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-[var(--color-nexus-primary-dim)] border border-[var(--color-nexus-border-active)] rounded-2xl flex items-center justify-center text-[var(--color-nexus-primary)] mb-6 shadow-[0_0_30px_var(--color-nexus-primary-glow)]">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-center text-white">Welcome to P2P DIRECT</h1>
          <p className="text-sm text-[var(--color-nexus-text-muted)] text-center mb-8 font-mono leading-relaxed">
            Serverless. Secure. Direct. <br/> Initialize your identity.
          </p>

          <form 
            onSubmit={e => {
              e.preventDefault();
              if (tempName.trim()) setMyName(tempName.trim());
            }}
            className="w-full flex flex-col gap-4"
          >
            <div>
              <label className="block text-[10px] text-[var(--color-nexus-primary)] font-mono uppercase tracking-widest mb-2 ml-1">Your Name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Satoshi"
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                className="w-full p-4 bg-black/50 border border-[var(--color-nexus-border)] rounded-xl text-sm outline-none focus:border-[var(--color-nexus-border-active)] focus:bg-white/5 transition-all text-center placeholder:text-center"
              />
            </div>
            <button
              disabled={!tempName.trim()}
              type="submit"
              className="w-full py-4 bg-white text-black font-bold rounded-xl transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:hover:shadow-none mt-2"
            >
              Continue →
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full max-w-[1600px] mx-auto overflow-hidden relative">
      <Sidebar onAddPeer={() => setIsModalOpen(true)} />
      <ChatArea />
      <AddPeerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <NexusProvider>
      <NexusApp />
    </NexusProvider>
  );
}
