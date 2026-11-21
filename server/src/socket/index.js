const { verifySocketToken } = require('../middleware/auth');
const db = require('../db');

// Map of userId -> Set of socketIds
const onlineUsers = new Map();

function initSocket(io) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;

    // Track online user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join user's personal notification room
    socket.join(`user:${userId}`);

    // Broadcast online status to everyone
    io.emit('user:status', {
      userId,
      status: 'online'
    });

    // Provide the caller with the current list of online user IDs
    const onlineUserIds = Array.from(onlineUsers.keys());
    socket.emit('users:online_list', onlineUserIds);

    // Join specific chat room
    socket.on('chat:join', (chatId) => {
      if (db.isUserInChat(Number(chatId), userId)) {
        socket.join(`chat:${chatId}`);
      }
    });

    // Leave chat room
    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // Typing indicators
    socket.on('typing:start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:status', {
        chatId: Number(chatId),
        userId,
        userName: socket.user.displayName,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:status', {
        chatId: Number(chatId),
        userId,
        userName: socket.user.displayName,
        isTyping: false
      });
    });

    // Send message (Normal or E2EE)
    socket.on('message:send', async (data, callback) => {
      try {
        const {
          chatId,
          type = 'text',
          content = '',
          fileUrl = null,
          fileName = null,
          fileSize = null,
          fileMimeType = null,
          fileEncrypted = 0,
          fileKey = null,
          iv = null
        } = data;

        const numChatId = Number(chatId);
        if (!db.isUserInChat(numChatId, userId)) {
          if (typeof callback === 'function') {
            callback({ error: 'You are not a member of this chat' });
          }
          return;
        }

        const savedMsg = db.saveMessage({
          chatId: numChatId,
          senderId: userId,
          type,
          content,
          fileUrl,
          fileName,
          fileSize,
          fileMimeType,
          fileEncrypted: fileEncrypted ? 1 : 0,
          fileKey,
          iv
        });

        // Broadcast to chat room
        io.to(`chat:${numChatId}`).emit('message:new', {
          chatId: numChatId,
          message: savedMsg
        });

        // Also notify each member's personal room for sidebar preview/unread updates
        const chat = db.getChatById(numChatId, userId);
        if (chat && chat.members) {
          for (const member of chat.members) {
            io.to(`user:${member.id}`).emit('chat:activity', {
              chatId: numChatId,
              lastMessage: savedMsg,
              senderId: userId
            });
          }
        }

        if (typeof callback === 'function') {
          callback({ success: true, message: savedMsg });
        }
      } catch (err) {
        console.error('Socket message:send error:', err);
        if (typeof callback === 'function') {
          callback({ error: 'Failed to send message' });
        }
      }
    });

    // Mark messages as read
    socket.on('messages:read', ({ chatId }) => {
      const numChatId = Number(chatId);
      if (db.isUserInChat(numChatId, userId)) {
        db.markMessagesAsRead(numChatId, userId);
        io.to(`chat:${numChatId}`).emit('messages:read', {
          chatId: numChatId,
          readerId: userId
        });
      }
    });

    // ==========================================
    // WebRTC P2P Audio / Video Calling Signaling
    // ==========================================

    // Initiate Call
    socket.on('call:initiate', ({ targetUserId, callType, offer }) => {
      const targetId = Number(targetUserId);
      if (!onlineUsers.has(targetId) || onlineUsers.get(targetId).size === 0) {
        socket.emit('call:rejected', {
          reason: 'offline',
          targetUserId: targetId
        });
        return;
      }

      io.to(`user:${targetId}`).emit('call:incoming', {
        caller: {
          id: socket.user.id,
          displayName: socket.user.displayName,
          username: socket.user.username,
          avatar: socket.user.avatar
        },
        callType: callType || 'video',
        offer
      });
    });

    // Accept Call
    socket.on('call:accept', ({ callerId, answer }) => {
      io.to(`user:${Number(callerId)}`).emit('call:accepted', {
        answer,
        answerer: {
          id: socket.user.id,
          displayName: socket.user.displayName,
          username: socket.user.username,
          avatar: socket.user.avatar
        }
      });
    });

    // Reject / Decline Call
    socket.on('call:reject', ({ callerId, reason }) => {
      io.to(`user:${Number(callerId)}`).emit('call:rejected', {
        reason: reason || 'declined',
        targetUserId: socket.user.id
      });
    });

    // End / Hang Up Call
    socket.on('call:end', ({ targetUserId }) => {
      io.to(`user:${Number(targetUserId)}`).emit('call:ended', {
        fromUserId: socket.user.id
      });
    });

    // Exchange ICE Candidates
    socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
      io.to(`user:${Number(targetUserId)}`).emit('call:ice-candidate', {
        candidate,
        fromUserId: socket.user.id
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          db.updateUserLastSeen(userId);
          const nowIso = new Date().toISOString();
          io.emit('user:status', {
            userId,
            status: 'offline',
            lastSeen: nowIso
          });
        }
      }
    });
  });
}

module.exports = {
  initSocket
};
