import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Html5Qrcode } from 'html5-qrcode';
import { useNexus } from '../store/NexusContext';
import { STUN_SERVERS, encodeSdp, decodeSdp } from '../lib/webrtc';
import { cn } from '../lib/utils';
import { X, Upload, Copy, Check, Download, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddPeerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPeerModal({ isOpen, onClose }: AddPeerModalProps) {
  const { addContact, myName } = useNexus();
  const [mode, setMode] = useState<'host' | 'guest'>('host');
  const [contactName, setContactName] = useState('');
  
  // Host state
  const [offerToken, setOfferToken] = useState('');
  const [hostAnswerInput, setHostAnswerInput] = useState('');
  
  // Guest state
  const [guestOfferInput, setGuestOfferInput] = useState('');
  const [answerToken, setAnswerToken] = useState('');

  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const tempPCRef = useRef<RTCPeerConnection | null>(null);
  const tempChannelRef = useRef<RTCDataChannel | null>(null);

  // Reset state when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setMode('host');
      setContactName('');
      setOfferToken('');
      setHostAnswerInput('');
      setGuestOfferInput('');
      setAnswerToken('');
      setIsGenerating(false);
      tempPCRef.current = null;
      tempChannelRef.current = null;
    }
  }, [isOpen]);

  const generateOffer = async () => {
    setIsGenerating(true);
    const pc = new RTCPeerConnection(STUN_SERVERS);
    tempPCRef.current = pc;
    const channel = pc.createDataChannel('nexus-data', { ordered: true });
    tempChannelRef.current = channel;

    pc.onicecandidate = async (e) => {
      if (e.candidate === null) {
        const token = encodeSdp(pc.localDescription);
        setOfferToken(token);
        setIsGenerating(false);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  };

  const connectHost = async () => {
    if (!hostAnswerInput.trim()) return;
    try {
      const pc = tempPCRef.current;
      const channel = tempChannelRef.current;
      if (!pc || !channel) return;
      
      await pc.setRemoteDescription(new RTCSessionDescription(decodeSdp(hostAnswerInput)));
      addContact('contact-' + Date.now(), contactName || 'Unknown Peer', pc, channel);
      onClose();
    } catch (err) {
      alert('Invalid Answer token.');
    }
  };

  const generateAnswer = async () => {
    if (!guestOfferInput.trim()) return;
    setIsGenerating(true);
    
    const pc = new RTCPeerConnection(STUN_SERVERS);
    tempPCRef.current = pc;

    pc.ondatachannel = (e) => {
      addContact('contact-' + Date.now(), contactName || 'Unknown Peer', pc, e.channel);
      onClose();
    };

    pc.onicecandidate = async (e) => {
      if (e.candidate === null) {
        const token = encodeSdp(pc.localDescription);
        setAnswerToken(token);
        setIsGenerating(false);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(decodeSdp(guestOfferInput)));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } catch (err) {
      alert('Invalid Host token.');
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportQRAsPNG = async (tokenId: string, label: string): Promise<Blob | null> => {
    const wrapper = document.getElementById(tokenId);
    if (!wrapper) return null;
    const svg = wrapper.querySelector('svg');
    if (!svg) return null;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = new Image();
    
    return new Promise((resolve) => {
        img.onload = () => {
            const SIZE = 320;
            canvas.width = SIZE; 
            canvas.height = SIZE + 80;
            
            // Background
            ctx.fillStyle = '#0a0a0a';
            ctx.roundRect(0, 0, SIZE, SIZE + 80, 16);
            ctx.fill();

            // Header text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`P2P DIRECT · ${label.toUpperCase()}`, SIZE / 2, 28);
            ctx.fillStyle = '#6b7a8d';
            ctx.font = '13px "JetBrains Mono", monospace';
            ctx.fillText(myName.substring(0, 28), SIZE / 2, 50);

            // Draw QR Background (white)
            ctx.fillStyle = '#ffffff';
            ctx.roundRect(40, 70, 240, 240, 12);
            ctx.fill();
            
            // Draw QR Image
            ctx.drawImage(img, 45, 75, 230, 230);
            
            canvas.toBlob(resolve, 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const handleDownloadQR = async (tokenId: string, label: string) => {
    const blob = await exportQRAsPNG(tokenId, label);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `P2P_DIRECT_${label}_QR.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareQR = async (tokenId: string, label: string) => {
    const blob = await exportQRAsPNG(tokenId, label);
    if (!blob) return;
    if (navigator.share) {
        try {
            const file = new File([blob], `P2P_DIRECT_${label}_QR.png`, { type: 'image/png' });
            await navigator.share({
                title: `P2P DIRECT ${label}`,
                text: `Connect with ${myName} on P2P DIRECT!`,
                files: [file]
            });
        } catch(e) {
            console.log("Sharing failed", e);
        }
    } else {
        alert("Sharing not supported on this browser/device. Please download instead.");
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new Html5Qrcode('qr-reader-hidden');
      const text = await reader.scanFile(file, true);
      setter(text);
      if (mode === 'host') {
        setTimeout(() => document.getElementById('btn-connect-host')?.click(), 200);
      } else {
        setTimeout(() => document.getElementById('btn-gen-answer')?.click(), 200);
      }
    } catch (err) {
      alert('QR scan failed. Try manual token.');
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xl flex items-end md:items-center justify-center z-[100] p-0 md:p-4">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="w-full max-w-[520px] bg-[var(--color-nexus-surface)] border border-[var(--color-nexus-border)] rounded-t-3xl md:rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="w-10 h-1 bg-[var(--color-nexus-border)] rounded-full mx-auto mb-6 md:hidden" />
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Add Peer</h2>
              <p className="text-xs text-[var(--color-nexus-text-muted)] font-mono mt-1 uppercase tracking-widest">// Establish P2P Connection</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5 text-[var(--color-nexus-text-sub)]" />
            </button>
          </div>

          <div className="h-px bg-[var(--color-nexus-border)] mb-6" />

          <div className="mb-5">
            <label className="block font-mono text-[10px] text-[var(--color-nexus-primary)] mb-2 uppercase tracking-wider">Contact Name</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="e.g. Satoshi"
              className="w-full p-3.5 bg-black/50 border border-[var(--color-nexus-border)] rounded-xl text-sm outline-none focus:border-[var(--color-nexus-border-active)] transition-colors"
            />
          </div>

          <div className="flex gap-2 mb-6 bg-black/30 p-1 rounded-xl border border-[var(--color-nexus-border)]">
            {(['host', 'guest'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  mode === m ? "bg-[var(--color-nexus-primary)] text-black" : "text-[var(--color-nexus-text-muted)] hover:text-white hover:bg-white/5"
                )}
              >
                {m === 'host' ? '🔵 Host Session' : '🟢 Join Session'}
              </button>
            ))}
          </div>

          {mode === 'host' && (
            <div className="space-y-4">
              <button
                onClick={generateOffer}
                disabled={isGenerating}
                className="w-full py-3.5 bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] text-black font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : offerToken ? '↺ Regenerate Invite' : '1. Generate Invite Token'}
              </button>

              {offerToken && (
                <div className="bg-black/30 p-4 rounded-xl border border-dashed border-[var(--color-nexus-border-active)]/50 flex flex-col items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-bold text-[var(--color-nexus-primary)] mb-1">{myName}</div>
                    <div className="text-[10px] text-[var(--color-nexus-text-muted)] font-mono uppercase tracking-widest">Host Token</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl" id="host-qr-wrapper">
                    <QRCode value={offerToken} size={160} bgColor="#ffffff" fgColor="#000000" level="L" />
                  </div>
                  <div className="flex gap-2 w-full">
                     <button onClick={() => handleDownloadQR('host-qr-wrapper', 'Invite')} className="flex-1 py-3 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"><Download className="w-4 h-4"/> Download</button>
                     <button onClick={() => handleShareQR('host-qr-wrapper', 'Invite')} className="flex-1 py-3 bg-[var(--color-nexus-primary-dim)] text-[var(--color-nexus-primary)] border border-[var(--color-nexus-border-active)] hover:bg-[var(--color-nexus-primary)] hover:text-black rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"><Share2 className="w-4 h-4"/> Share</button>
                  </div>
                  <div className="w-full relative">
                    <textarea value={offerToken} readOnly className="w-full h-16 p-3 bg-black/50 text-xs font-mono text-[var(--color-nexus-text-sub)] border border-[var(--color-nexus-border)] rounded-lg resize-none outline-none pr-10" />
                    <button onClick={() => handleCopy(offerToken)} className="absolute right-2 top-2 p-1.5 bg-white/10 rounded border border-white/10 hover:bg-white/20">
                      {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <label className="block font-mono text-[10px] text-[var(--color-nexus-primary)] mb-2 uppercase tracking-wider">2. Receive Guest's Reply</label>
                <div className="relative mb-3">
                  <input type="file" accept="image/*" onChange={e => handleQRUpload(e, setHostAnswerInput)} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full" />
                  <button className="w-full py-3 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4" /> Upload Guest's QR
                  </button>
                </div>
                <textarea
                  value={hostAnswerInput}
                  onChange={e => setHostAnswerInput(e.target.value)}
                  placeholder="Or paste Guest token manually..."
                  className="w-full h-16 p-3 bg-black/40 border border-[var(--color-nexus-border)] rounded-xl text-xs font-mono outline-none focus:border-[var(--color-nexus-border-active)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3.5 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl font-semibold transition-colors">
                  Cancel
                </button>
                <button onClick={connectHost} id="btn-connect-host" disabled={!hostAnswerInput} className="flex-1 py-3.5 bg-white text-black font-bold rounded-xl transition-all disabled:opacity-30 disabled:hover:shadow-none hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  3. Connect →
                </button>
              </div>
            </div>
          )}

          {mode === 'guest' && (
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-nexus-primary)] mb-2 uppercase tracking-wider">1. Get Host's Invite</label>
                <div className="relative mb-3">
                  <input type="file" accept="image/*" onChange={e => handleQRUpload(e, setGuestOfferInput)} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full" />
                  <button className="w-full py-3 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4" /> Upload Host's QR
                  </button>
                </div>
                <textarea
                  value={guestOfferInput}
                  onChange={e => setGuestOfferInput(e.target.value)}
                  placeholder="Or paste Host token manually..."
                  className="w-full h-16 p-3 bg-black/40 border border-[var(--color-nexus-border)] rounded-xl text-xs font-mono outline-none focus:border-[var(--color-nexus-border-active)] resize-none mb-4"
                />
              </div>

              <button
                id="btn-gen-answer"
                onClick={generateAnswer}
                disabled={isGenerating || !guestOfferInput}
                className="w-full py-3.5 bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] text-black font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : answerToken ? '↺ Regenerate Reply' : '2. Generate Reply'}
              </button>

              {answerToken && (
                <div className="bg-black/30 p-4 rounded-xl border border-dashed border-[var(--color-nexus-border-active)]/50 flex flex-col items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-bold text-[var(--color-nexus-primary)] mb-1">{myName}</div>
                    <div className="text-[10px] text-[var(--color-nexus-text-muted)] font-mono uppercase tracking-widest">Guest Token</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl" id="guest-qr-wrapper">
                    <QRCode value={answerToken} size={160} bgColor="#ffffff" fgColor="#000000" level="L" />
                  </div>
                  <div className="flex gap-2 w-full">
                     <button onClick={() => handleDownloadQR('guest-qr-wrapper', 'Reply')} className="flex-1 py-3 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"><Download className="w-4 h-4"/> Download</button>
                     <button onClick={() => handleShareQR('guest-qr-wrapper', 'Reply')} className="flex-1 py-3 bg-[var(--color-nexus-primary-dim)] text-[var(--color-nexus-primary)] border border-[var(--color-nexus-border-active)] hover:bg-[var(--color-nexus-primary)] hover:text-black rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"><Share2 className="w-4 h-4"/> Share</button>
                  </div>
                  <div className="w-full relative">
                    <textarea value={answerToken} readOnly className="w-full h-16 p-3 bg-black/50 text-xs font-mono text-[var(--color-nexus-text-sub)] border border-[var(--color-nexus-border)] rounded-lg resize-none outline-none pr-10" />
                    <button onClick={() => handleCopy(answerToken)} className="absolute right-2 top-2 p-1.5 bg-white/10 rounded border border-white/10 hover:bg-white/20">
                      {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button onClick={onClose} className="w-full py-3.5 border border-[var(--color-nexus-border)] hover:bg-white/5 rounded-xl font-semibold transition-colors">
                  Close & Wait for Connection
                </button>
              </div>
            </div>
          )}

          <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
