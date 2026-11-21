const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password, publicKey, avatar } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const existing = db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = db.createUser(
      cleanUsername,
      displayName?.trim() || cleanUsername,
      passwordHash,
      publicKey || null,
      avatar || null
    );

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.getUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    const safeUser = db.getUserById(user.id);
    res.json({
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Update Public Key (for E2EE)
router.put('/public-key', authMiddleware, (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'Public key required' });
    }
    const updated = db.updateUserPublicKey(req.user.id, publicKey);
    res.json({ user: updated });
  } catch (err) {
    console.error('Update public key error:', err);
    res.status(500).json({ error: 'Failed to update public key' });
  }
});

module.exports = router;
