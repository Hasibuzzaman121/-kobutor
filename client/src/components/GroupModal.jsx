import React, { useState, useEffect } from 'react';
import { Users, X, Check, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';

export default function GroupModal({ onClose }) {
  const { token } = useAuth();
  const { createGroupChat } = useChat();
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter a group name');
    if (selectedUserIds.size === 0) return alert('Please select at least one member');

    setCreating(true);
    try {
      await createGroupChat(name.trim(), Array.from(selectedUserIds));
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
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

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create Group</h3>
            <p className="text-xs text-slate-400">Group messaging with multiple members</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 flex flex-col flex-1 min-h-0">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Developers, Family, Study Club"
              required
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Members ({selectedUserIds.size} selected)
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* User selector list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[140px]">
            {loading ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">No users found</div>
            ) : (
              users.map((u) => {
                const isSelected = selectedUserIds.has(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-colors ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar user={u} size="sm" />
                      <div>
                        <div className="text-xs font-medium text-slate-100">{u.displayName}</div>
                        <div className="text-[10px] text-slate-400">@{u.username}</div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-blue-500 border-blue-400 text-white'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={creating || selectedUserIds.size === 0 || !name.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-slate-950 font-semibold rounded-xl text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating Group...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
