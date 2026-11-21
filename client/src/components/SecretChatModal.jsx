import React, { useState, useEffect } from 'react';
import { Lock, X, ShieldAlert, Search, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';

export default function SecretChatModal({ onClose }) {
  const { token } = useAuth();
  const { startSecretChat } = useChat();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [initiating, setInitiating] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(fetchUsers, 250);
    return () => clearTimeout(delay);
  }, [search, token]);

  const handleSelectUser = async (targetUserId) => {
    setInitiating(true);
    try {
      await startSecretChat(targetUserId);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to start Secret Chat');
    } finally {
      setInitiating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 relative shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Lock size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">New Secret Chat</h3>
            <p className="text-xs text-slate-400">End-to-End Encrypted Session</p>
          </div>
        </div>

        {/* Security Highlights */}
        <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-3 mb-4 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <ShieldAlert size={14} /> Telegram-style Secret Chat features:
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-400">
            <li>End-to-End Encryption with AES-256-GCM & ECDH</li>
            <li>Zero server traces: Server only routes encrypted ciphertext</li>
            <li>Files, photos, and voice notes are encrypted before upload</li>
            <li>Cryptographic safety fingerprint verification</li>
          </ul>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Users list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">Searching contacts...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No contacts found</div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u.id)}
                disabled={initiating}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-emerald-500/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar user={u} size="md" />
                  <div>
                    <div className="text-sm font-medium text-slate-100">{u.displayName}</div>
                    <div className="text-xs text-slate-400">@{u.username}</div>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <UserCheck size={14} /> Start
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
