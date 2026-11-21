import React, { useState, useEffect } from 'react';
import { Shield, Check, Copy, X, Lock } from 'lucide-react';
import { computeSafetyFingerprint } from '../crypto/e2ee';
import { useAuth } from '../context/AuthContext';

export default function SecurityVerificationModal({ chat, onClose }) {
  const { user, keyPair } = useAuth();
  const [fingerprint, setFingerprint] = useState(null);
  const [copied, setCopied] = useState(false);

  const peer = chat.peer || chat.members?.find((m) => m.id !== user.id);

  useEffect(() => {
    const calculate = async () => {
      if (keyPair?.pubJwkStr && peer?.publicKey) {
        const fp = await computeSafetyFingerprint(keyPair.pubJwkStr, peer.publicKey);
        setFingerprint(fp);
      }
    };
    calculate();
  }, [keyPair, peer]);

  const copyCode = () => {
    if (fingerprint?.code) {
      navigator.clipboard.writeText(fingerprint.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 relative shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Encryption Verification</h3>
            <p className="text-xs text-slate-400">End-to-End Cryptographic Handshake</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          This secret chat with <span className="font-semibold text-cyan-400">{peer?.displayName || 'user'}</span> is secured with end-to-end encryption. Compare this safety code with your partner&apos;s device to verify no third party is intercepting your connection.
        </p>

        {fingerprint ? (
          <div className="space-y-4">
            {/* Visual Emojis */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-2">
                Visual Fingerprint
              </span>
              <div className="text-3xl tracking-widest py-1 select-none">
                {fingerprint.emojis}
              </div>
            </div>

            {/* Numeric Safety Number */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-2">
                Safety Code
              </span>
              <div className="font-mono text-xl tracking-widest text-cyan-300 font-bold select-all">
                {fingerprint.code}
              </div>
            </div>

            <button
              onClick={copyCode}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors border border-slate-700"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              {copied ? 'Safety Code Copied' : 'Copy Safety Code'}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-slate-400">
            Waiting for peer to publish their encryption key...
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Shield size={12} /> ECDH P-256 / AES-256-GCM
          </span>
          <span>Zero Knowledge</span>
        </div>
      </div>
    </div>
  );
}
