const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Search users
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      const allUsers = db.getAllUsers(req.user.id);
      return res.json({ users: allUsers });
    }
    const users = db.searchUsers(q.trim(), req.user.id);
    res.json({ users });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile by ID (includes public key for E2EE)
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const user = db.getUserById(Number(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// Update own profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { displayName, statusMessage, avatar } = req.body;
    const updated = db.updateUserProfile(req.user.id, displayName, statusMessage, avatar);
    res.json({ user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
