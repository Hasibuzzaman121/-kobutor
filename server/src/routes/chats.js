const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all chats for current user
router.get('/', authMiddleware, (req, res) => {
  try {
    const chats = db.getUserChats(req.user.id);
    res.json({ chats });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ error: 'Failed to load chats' });
  }
});

// Get single chat by ID
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const chatId = Number(req.params.id);
    if (!db.isUserInChat(chatId, req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }
    const chat = db.getChatById(chatId, req.user.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json({ chat });
  } catch (err) {
    console.error('Get single chat error:', err);
    res.status(500).json({ error: 'Failed to retrieve chat' });
  }
});

// Create or get 1-on-1 direct chat
router.post('/direct', authMiddleware, (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    const targetUser = db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    const chat = db.createDirectChat(req.user.id, targetUserId, 0);
    res.status(201).json({ chat });
  } catch (err) {
    console.error('Create direct chat error:', err);
    res.status(500).json({ error: 'Failed to start direct chat' });
  }
});

// Create E2EE Secret Chat
router.post('/secret', authMiddleware, (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    const targetUser = db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    const chat = db.createDirectChat(req.user.id, targetUserId, 1);
    res.status(201).json({ chat });
  } catch (err) {
    console.error('Create secret chat error:', err);
    res.status(500).json({ error: 'Failed to start secret chat' });
  }
});

// Create group chat
router.post('/group', authMiddleware, (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one member' });
    }

    const chat = db.createGroupChat(name.trim(), req.user.id, memberIds);
    res.status(201).json({ chat });
  } catch (err) {
    console.error('Create group chat error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get messages for a chat
router.get('/:id/messages', authMiddleware, (req, res) => {
  try {
    const chatId = Number(req.params.id);
    if (!db.isUserInChat(chatId, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
    const messages = db.getChatMessages(chatId, limit, beforeId);

    // Auto mark unread messages as read
    db.markMessagesAsRead(chatId, req.user.id);

    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Mark messages as read
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    const chatId = Number(req.params.id);
    if (!db.isUserInChat(chatId, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const count = db.markMessagesAsRead(chatId, req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
