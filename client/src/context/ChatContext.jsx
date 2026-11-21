import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import {
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  encryptFile
} from '../crypto/e2ee';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token, keyPair } = useAuth();
  const { socket } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState({}); // { [chatId]: Message[] }
  const [typingUsers, setTypingUsers] = useState({}); // { [chatId]: { [userId]: userName } }
  const [loadingChats, setLoadingChats] = useState(false);

  // Keep a ref to chats to avoid stale closures in socket events & async callbacks
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Cache for derived AES keys for Secret Chats: Map<chatId, CryptoKey>
  const sharedKeysCache = useRef(new Map());

  // Derive or get cached shared AES-GCM key for an E2EE Secret Chat
  const getSharedKeyForChat = useCallback(
    async (chat) => {
      if (!chat || !chat.isE2EE) return null;
      if (!keyPair?.privateKey) return null;

      if (sharedKeysCache.current.has(chat.id)) {
        return sharedKeysCache.current.get(chat.id);
      }

      let peer = chat.peer || chat.members?.find((m) => m.id !== user?.id);

      // If peer info or public key is missing from chat object, fetch fresh details
      if (!peer || !peer.publicKey) {
        try {
          const res = await fetch(`/api/chats/${chat.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            peer = data.chat?.peer || data.chat?.members?.find((m) => m.id !== user?.id);
          }
        } catch (e) {
          console.warn('Failed to fetch full chat info for key derivation:', e);
        }
      }

      if (!peer || !peer.publicKey) {
        console.warn('Cannot derive E2EE key: Peer has no public key yet');
        return null;
      }

      try {
        const peerCryptoPubKey = await importPublicKey(peer.publicKey);
        const derived = await deriveSharedKey(keyPair.privateKey, peerCryptoPubKey);
        sharedKeysCache.current.set(chat.id, derived);
        return derived;
      } catch (err) {
        console.error('Key derivation failed for chat', chat.id, err);
        return null;
      }
    },
    [keyPair, user?.id, token]
  );

  // Decrypt a message if it's an E2EE secret message
  const decryptSingleMessage = useCallback(
    async (msg, chat) => {
      if (!chat?.isE2EE || !msg.iv || msg.type === 'system') {
        return msg;
      }

      const sharedKey = await getSharedKeyForChat(chat);
      if (!sharedKey) {
        return {
          ...msg,
          decryptedContent: msg.content // fallback to content until key resolves
        };
      }

      if (msg.content) {
        const plain = await decryptMessage(msg.content, msg.iv, sharedKey);
        return {
          ...msg,
          decryptedContent: plain
        };
      }

      return msg;
    },
    [getSharedKeyForChat]
  );

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    if (!token) return;
    setLoadingChats(true);
    try {
      const res = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
        chatsRef.current = data.chats;
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [token]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Load message history for a chat
  const loadMessages = useCallback(
    async (chatId) => {
      if (!token || !chatId) return;
      try {
        const res = await fetch(`/api/chats/${chatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          let targetChat = chatsRef.current.find((c) => c.id === chatId);

          if (!targetChat) {
            try {
              const chatRes = await fetch(`/api/chats/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (chatRes.ok) {
                const cData = await chatRes.json();
                targetChat = cData.chat;
              }
            } catch (e) {}
          }

          // Decrypt secret messages if E2EE chat
          if (targetChat?.isE2EE) {
            const decryptedList = await Promise.all(
              data.messages.map((m) => decryptSingleMessage(m, targetChat))
            );
            setMessages((prev) => ({ ...prev, [chatId]: decryptedList }));
          } else {
            setMessages((prev) => ({ ...prev, [chatId]: data.messages }));
          }

          // Clear unread count locally
          setChats((prev) =>
            prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (err) {
        console.error('Failed to load messages for chat', chatId, err);
      }
    },
    [token, decryptSingleMessage]
  );

  // When active chat changes, join socket room and load messages
  useEffect(() => {
    if (!activeChatId || !socket) return;

    socket.emit('chat:join', activeChatId);
    loadMessages(activeChatId);

    return () => {
      socket.emit('chat:leave', activeChatId);
    };
  }, [activeChatId, socket, loadMessages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // New message event
    const handleNewMessage = async ({ chatId, message }) => {
      let targetChat = chatsRef.current.find((c) => c.id === chatId);
      if (!targetChat) {
        try {
          const cRes = await fetch(`/api/chats/${chatId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (cRes.ok) {
            const cd = await cRes.json();
            targetChat = cd.chat;
          }
        } catch (e) {}
      }

      let processedMsg = message;
      if (targetChat?.isE2EE) {
        processedMsg = await decryptSingleMessage(message, targetChat);
      }

      setMessages((prev) => {
        const existing = prev[chatId] || [];
        if (existing.some((m) => m.id === message.id)) {
          return {
            ...prev,
            [chatId]: existing.map((m) =>
              m.id === message.id ? { ...m, ...processedMsg } : m
            )
          };
        }
        return {
          ...prev,
          [chatId]: [...existing, processedMsg]
        };
      });

      // Update sidebar chat lastMessage & unread count
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            const isCurrentlyActive = activeChatId === chatId;
            return {
              ...c,
              lastMessage: message,
              unreadCount: isCurrentlyActive ? 0 : (c.unreadCount || 0) + 1
            };
          }
          return c;
        })
      );

      // If active chat, emit read confirmation
      if (activeChatId === chatId && message.senderId !== user?.id) {
        socket.emit('messages:read', { chatId });
      }
    };

    // Chat activity for chats not currently active
    const handleChatActivity = ({ chatId, lastMessage }) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            const isCurrentlyActive = activeChatId === chatId;
            return {
              ...c,
              lastMessage,
              unreadCount: isCurrentlyActive ? 0 : (c.unreadCount || 0) + 1
            };
          }
          return c;
        })
      );
    };

    // Typing status
    const handleTypingStatus = ({ chatId, userId, userName, isTyping }) => {
      setTypingUsers((prev) => {
        const current = { ...(prev[chatId] || {}) };
        if (isTyping) {
          current[userId] = userName;
        } else {
          delete current[userId];
        }
        return { ...prev, [chatId]: current };
      });
    };

    // Messages read status
    const handleMessagesRead = ({ chatId, readerId }) => {
      setMessages((prev) => {
        const list = prev[chatId];
        if (!list) return prev;
        return {
          ...prev,
          [chatId]: list.map((m) =>
            m.senderId !== readerId ? { ...m, status: 'read' } : m
          )
        };
      });
    };

    socket.on('message:new', handleNewMessage);
    socket.on('chat:activity', handleChatActivity);
    socket.on('typing:status', handleTypingStatus);
    socket.on('messages:read', handleMessagesRead);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('chat:activity', handleChatActivity);
      socket.off('typing:status', handleTypingStatus);
      socket.off('messages:read', handleMessagesRead);
    };
  }, [socket, activeChatId, user?.id, token, decryptSingleMessage]);

  // Send message function (handles plain text, files, voice notes, and E2EE secret encryption)
  const sendMessage = async ({
    content = '',
    type = 'text',
    file = null,
    audioBlob = null
  }) => {
    if (!activeChatId || !socket) return;
    const currentChat =
      chatsRef.current.find((c) => c.id === activeChatId) ||
      chats.find((c) => c.id === activeChatId);
    if (!currentChat) return;

    let finalContent = content;
    let iv = null;
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileMimeType = null;
    let fileEncrypted = 0;

    // Handle Secret Chat E2EE Encryption
    if (currentChat.isE2EE) {
      const sharedKey = await getSharedKeyForChat(currentChat);
      if (!sharedKey) {
        throw new Error(
          'Cannot send secret message: Peer public key not available for encryption.'
        );
      }

      // Encrypt text content
      if (type === 'text') {
        const encResult = await encryptMessage(content, sharedKey);
        finalContent = encResult.ciphertext;
        iv = encResult.iv;
      }

      // Encrypt file or voice note
      if (file || audioBlob) {
        const sourceData = file || audioBlob;
        const arrayBuf = await sourceData.arrayBuffer();
        const encFileResult = await encryptFile(arrayBuf, sharedKey);

        const formData = new FormData();
        const uploadName = file ? file.name + '.enc' : 'voice-note.webm.enc';
        formData.append('file', encFileResult.encryptedBlob, uploadName);
        formData.append('isEncrypted', 'true');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Failed to upload encrypted file');
        const uploadData = await uploadRes.json();

        fileUrl = uploadData.fileUrl;
        fileName = file ? file.name : 'Voice Message';
        fileSize = sourceData.size;
        fileMimeType = sourceData.type;
        fileEncrypted = 1;
        iv = encFileResult.iv;
      }
    } else {
      // Regular Chat Upload (TLS/HTTPS transport encryption)
      if (file || audioBlob) {
        const sourceData = file || audioBlob;
        const formData = new FormData();
        formData.append('file', sourceData, file ? file.name : 'voice-message.webm');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Failed to upload file');
        const uploadData = await uploadRes.json();

        fileUrl = uploadData.fileUrl;
        fileName = file ? file.name : 'Voice Message';
        fileSize = sourceData.size;
        fileMimeType = sourceData.type;
      }
    }

    const payload = {
      chatId: activeChatId,
      type,
      content: finalContent,
      fileUrl,
      fileName,
      fileSize,
      fileMimeType,
      fileEncrypted,
      iv
    };

    return new Promise((resolve, reject) => {
      socket.emit('message:send', payload, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          // Immediately populate sender's local message with plaintext
          const sentMsg = {
            ...response.message,
            decryptedContent: content
          };
          setMessages((prev) => {
            const list = prev[activeChatId] || [];
            if (list.some((m) => m.id === sentMsg.id)) return prev;
            return {
              ...prev,
              [activeChatId]: [...list, sentMsg]
            };
          });
          resolve(sentMsg);
        }
      });
    });
  };

  // Start direct 1-on-1 chat
  const startDirectChat = async (targetUserId) => {
    const res = await fetch('/api/chats/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start chat');

    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== data.chat.id);
      const updated = [data.chat, ...filtered];
      chatsRef.current = updated;
      return updated;
    });
    setActiveChatId(data.chat.id);
    return data.chat;
  };

  // Start E2EE Secret Chat
  const startSecretChat = async (targetUserId) => {
    const res = await fetch('/api/chats/secret', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start secret chat');

    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== data.chat.id);
      const updated = [data.chat, ...filtered];
      chatsRef.current = updated;
      return updated;
    });
    setActiveChatId(data.chat.id);
    return data.chat;
  };

  // Create group chat
  const createGroupChat = async (name, memberIds) => {
    const res = await fetch('/api/chats/group', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, memberIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create group');

    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== data.chat.id);
      const updated = [data.chat, ...filtered];
      chatsRef.current = updated;
      return updated;
    });
    setActiveChatId(data.chat.id);
    return data.chat;
  };

  // Send typing status
  const sendTyping = (isTyping) => {
    if (!activeChatId || !socket) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId: activeChatId });
  };

  const activeChat =
    chats.find((c) => c.id === activeChatId) ||
    chatsRef.current.find((c) => c.id === activeChatId) ||
    null;

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        messages: messages[activeChatId] || [],
        typingUsers: typingUsers[activeChatId] || {},
        loadingChats,
        setActiveChatId,
        sendMessage,
        startDirectChat,
        startSecretChat,
        createGroupChat,
        sendTyping,
        fetchChats,
        getSharedKeyForChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
