import React, { useState, useMemo } from 'react';
import {
  Search,
  Lock,
  Users,
  UserPlus,
  LogOut,
  Shield,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  Check,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import SecretChatModal from './SecretChatModal';
import GroupModal from './GroupModal';
import Avatar from './Avatar';

export default function Sidebar({ onSelectChat }) {
  const { user, logout, token } = useAuth();
  const { chats, activeChatId, setActiveChatId, startDirectChat } = useChat();
  const { isUserOnline } = useSocket();

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'direct', 'group', 'secret'
  const [search, setSearch] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  // Search existing chats or search global contacts
  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      // Tab filter
      if (activeTab === 'secret' && !chat.isE2EE) return false;
      if (activeTab === 'group' && chat.type !== 'group') return false;
      if (activeTab === 'direct' && (chat.type !== 'direct' || chat.isE2EE)) return false;

      // Search filter
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const chatTitle = (chat.name || chat.peer?.displayName || chat.peer?.username || '').toLowerCase();
      const lastMsgText = (chat.lastMessage?.content || '').toLowerCase();
      return chatTitle.includes(query) || lastMsgText.includes(query);
    });
  }, [chats, activeTab, search]);

  // Handle live global search when query doesn't match existing
  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearch(val);

    if (val.trim().length >= 2) {
      setSearchingGlobal(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out users already in active direct chats
          setGlobalSearchResults(data.users || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingGlobal(false);
      }
    } else {
      setGlobalSearchResults([]);
    }
  };

  const handleStartChatWithUser = async (targetUserId) => {
    try {
      await startDirectChat(targetUserId);
      setSearch('');
      setGlobalSearchResults([]);
    } catch (err) {
      alert(err.message || 'Failed to start chat');
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none">
      {/* Top Profile Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar user={user} isOnline={true} size="md" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{user?.displayName}</span>
              <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                Online
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate">@{user?.username}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setShowSecretModal(true)}
            className="p-2 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors"
            title="Start Secret Chat (E2EE)"
          >
            <Shield size={18} />
          </button>
          <button
            onClick={() => setShowGroupModal(true)}
            className="p-2 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors"
            title="Create Group"
          >
            <Users size={18} />
          </button>
          <button
            onClick={logout}
            className="p-2 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search chats or find users..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center px-3 pb-2 gap-1 overflow-x-auto text-xs font-medium border-b border-slate-800/60">
        {[
          { id: 'all', label: 'All' },
          { id: 'direct', label: 'Direct' },
          { id: 'group', label: 'Groups' },
          { id: 'secret', label: 'Secret 🔒' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-800 text-cyan-400 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Search Results (if searching new users) */}
      {search.trim().length >= 2 && globalSearchResults.length > 0 && (
        <div className="p-3 bg-slate-950/90 border-b border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Global Users ({globalSearchResults.length})
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {globalSearchResults.map((u) => (
              <div
                key={u.id}
                onClick={() => handleStartChatWithUser(u.id)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 cursor-pointer border border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Avatar user={u} size="sm" />
                  <div>
                    <div className="text-xs font-medium text-white">{u.displayName}</div>
                    <div className="text-[10px] text-slate-400">@{u.username}</div>
                  </div>
                </div>
                <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                  <UserPlus size={13} /> Chat
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30">
        {filteredChats.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={24} />
            </div>
            <div className="text-sm font-medium text-slate-300">No conversations yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
              Start a direct conversation, secret chat, or create a group to begin.
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = activeChatId === chat.id;
            const isOnline = chat.peer ? isUserOnline(chat.peer.id) : false;
            const chatName = chat.name || chat.peer?.displayName || 'Chat';

            // Last message display text
            let lastSnippet = 'No messages yet';
            if (chat.lastMessage) {
              if (chat.lastMessage.type === 'voice') lastSnippet = '🎙️ Voice message';
              else if (chat.lastMessage.type === 'image') lastSnippet = '📷 Photo';
              else if (chat.lastMessage.type === 'file') lastSnippet = '📎 Document';
              else if (chat.isE2EE) lastSnippet = '🔒 Encrypted message';
              else lastSnippet = chat.lastMessage.content;
            }

            return (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  if (onSelectChat) onSelectChat();
                }}
                className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-slate-800/90 text-white'
                    : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                {/* Avatar with Online Badge */}
                <Avatar
                  user={chat.peer}
                  name={chat.name}
                  isOnline={chat.type !== 'group' && isOnline}
                  size="lg"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5 text-white">
                      {chat.isE2EE ? (
                        <span className="text-emerald-400" title="End-to-End Encrypted">
                          <Lock size={13} />
                        </span>
                      ) : null}
                      <span className="truncate">{chatName}</span>
                    </div>

                    {chat.lastMessage && (
                      <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                        {formatTime(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-[190px]">{lastSnippet}</span>

                    {/* Unread Badge */}
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 bg-cyan-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0 shadow">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showSecretModal && <SecretChatModal onClose={() => setShowSecretModal(false)} />}
      {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} />}
    </div>
  );
}
