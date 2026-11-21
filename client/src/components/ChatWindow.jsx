import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Lock,
  Shield,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Info,
  Phone,
  Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';
import SecurityVerificationModal from './SecurityVerificationModal';
import MediaViewerModal from './MediaViewerModal';
import Avatar from './Avatar';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🚀', '😂', '🎉', '🔒', '👏', '👀', '💯'];

export default function ChatWindow({ onBack }) {
  const { user } = useAuth();
  const { activeChat, messages, sendMessage, sendTyping, typingUsers } = useChat();
  const { isUserOnline } = useSocket();
  const { startCall } = useCall();

  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const peer = activeChat?.peer;
  const isOnline = peer ? isUserOnline(peer.id) : false;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setText(e.target.value);
    sendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 1500);
  };

  // Send regular text message
  const handleSendText = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    const messageText = text.trim();
    setText('');
    sendTyping(false);

    try {
      await sendMessage({ content: messageText, type: 'text' });
    } catch (err) {
      alert(err.message || 'Failed to send message');
    }
  };

  // Send file or photo
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const isImage = file.type.startsWith('image/');

    try {
      await sendMessage({
        type: isImage ? 'image' : 'file',
        file
      });
    } catch (err) {
      alert(err.message || 'Failed to send file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send voice note
  const handleSendVoice = async (audioBlob) => {
    setIsRecordingVoice(false);
    try {
      await sendMessage({
        type: 'voice',
        audioBlob
      });
    } catch (err) {
      alert(err.message || 'Failed to send voice note');
    }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-xl">
          <Lock size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">SecureGram</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Select a chat or start an End-to-End Encrypted secret session to exchange messages and share data securely.
        </p>
      </div>
    );
  }

  const typingNames = Object.values(typingUsers || {});

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 relative min-w-0">
      {/* Top Header */}
      <div className="px-4 py-3 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>

          <Avatar
            user={peer}
            name={activeChat.name}
            isOnline={activeChat.type !== 'group' && isOnline}
            size="md"
          />

          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              {activeChat.isE2EE ? (
                <span className="text-emerald-400" title="End-to-End Encrypted">
                  <Lock size={14} />
                </span>
              ) : null}
              <span>{activeChat.name || peer?.displayName || 'Chat'}</span>
            </div>

            <div className="text-xs text-slate-400 truncate">
              {typingNames.length > 0 ? (
                <span className="text-cyan-400 animate-pulse font-medium">
                  {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing...
                </span>
              ) : activeChat.type === 'group' ? (
                `${activeChat.members?.length || 0} members`
              ) : isOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : peer?.lastSeen ? (
                `Last seen ${new Date(peer.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              ) : (
                'Offline'
              )}
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-1.5">
          {activeChat.type !== 'group' && peer && (
            <>
              <button
                onClick={() => startCall(peer, 'audio')}
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Start Voice Call"
              >
                <Phone size={18} />
              </button>
              <button
                onClick={() => startCall(peer, 'video')}
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Start Video Call"
              >
                <Video size={18} />
              </button>
            </>
          )}

          {activeChat.isE2EE && (
            <button
              onClick={() => setShowVerificationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors ml-1"
            >
              <Shield size={14} />
              <span className="hidden sm:inline">Verify Security</span>
            </button>
          )}
        </div>
      </div>

      {/* Secret Chat Security Notice Banner */}
      {activeChat.isE2EE && (
        <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Lock size={13} className="text-emerald-400 shrink-0" />
            <span>
              End-to-End Encrypted: Only participants hold the decryption keys. No server logs.
            </span>
          </div>
          <button
            onClick={() => setShowVerificationModal(true)}
            className="text-[11px] font-semibold text-emerald-400 hover:underline shrink-0 ml-2"
          >
            Show Safety Fingerprint
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No messages yet. Say hi to start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenImage={(media) => setSelectedMedia(media)}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Section */}
      <div className="p-3 bg-slate-900/90 backdrop-blur border-t border-slate-800">
        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl mb-2 animate-fade-in overflow-x-auto">
            {QUICK_EMOJIS.map((em, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setText((prev) => prev + em);
                  setShowEmojiPicker(false);
                }}
                className="text-lg hover:scale-125 transition-transform p-1"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {isRecordingVoice ? (
          <VoiceRecorder
            onSendVoice={handleSendVoice}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2 relative">
            {/* Attachment Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu((prev) => !prev)}
                className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
                title="Attach Media or File"
              >
                <Paperclip size={20} />
              </button>

              {/* Attachment Popup Menu */}
              {showAttachMenu && (
                <div className="absolute bottom-12 left-0 bg-slate-900 border border-slate-700/80 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 w-44 z-20 animate-fade-in">
                  <label className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
                    <ImageIcon size={16} className="text-cyan-400" />
                    <span>Send Photo</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <label className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
                    <FileText size={16} className="text-blue-400" />
                    <span>Send Document</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Emoji toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-2.5 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-full transition-colors"
              title="Quick Emojis"
            >
              <Smile size={20} />
            </button>

            {/* Message Input */}
            <input
              type="text"
              value={text}
              onChange={handleInputChange}
              placeholder={
                activeChat.isE2EE
                  ? '🔒 Encrypted message...'
                  : 'Write a message...'
              }
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />

            {/* Voice Record or Send Button */}
            {text.trim().length > 0 ? (
              <button
                type="submit"
                className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-full shadow-lg shadow-cyan-500/20 transition-transform active:scale-95"
                title="Send Message"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors"
                title="Record Voice Note"
              >
                <Mic size={20} />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Security Verification Modal */}
      {showVerificationModal && (
        <SecurityVerificationModal
          chat={activeChat}
          onClose={() => setShowVerificationModal(false)}
        />
      )}

      {/* Media Lightbox Viewer Modal */}
      {selectedMedia && (
        <MediaViewerModal
          mediaUrl={selectedMedia.url}
          fileName={selectedMedia.name}
          isEncrypted={selectedMedia.isEncrypted}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
}
