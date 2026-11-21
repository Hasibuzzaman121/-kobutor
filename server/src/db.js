const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    publicKey TEXT,
    avatar TEXT,
    statusMessage TEXT DEFAULT 'Available',
    lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'direct', 'group', 'secret'
    name TEXT,          -- for group chats
    isE2EE INTEGER DEFAULT 0,
    secretChatInitiator INTEGER,
    secretChatStatus TEXT DEFAULT 'active', -- 'pending', 'active', 'terminated'
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chatId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chatId, userId),
    FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId INTEGER NOT NULL,
    senderId INTEGER NOT NULL,
    type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'voice', 'system'
    content TEXT,
    fileUrl TEXT,
    fileName TEXT,
    fileSize INTEGER,
    fileMimeType TEXT,
    fileEncrypted INTEGER DEFAULT 0,
    fileKey TEXT,
    iv TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
  CREATE INDEX IF NOT EXISTS idx_chat_members_userId ON chat_members(userId);
`);

// User queries
function createUser(username, displayName, passwordHash, publicKey = null, avatar = null) {
  const stmt = db.prepare(`
    INSERT INTO users (username, displayName, passwordHash, publicKey, avatar)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(username, displayName, passwordHash, publicKey, avatar);
  return getUserById(info.lastInsertRowid);
}

function getUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(username);
}

function getUserById(id) {
  return db.prepare(`
    SELECT id, username, displayName, publicKey, avatar, statusMessage, lastSeen, createdAt 
    FROM users WHERE id = ?
  `).get(id);
}

function updateUserPublicKey(userId, publicKey) {
  db.prepare(`UPDATE users SET publicKey = ? WHERE id = ?`).run(publicKey, userId);
  return getUserById(userId);
}

function updateUserProfile(userId, displayName, statusMessage, avatar) {
  db.prepare(`
    UPDATE users 
    SET displayName = COALESCE(?, displayName),
        statusMessage = COALESCE(?, statusMessage),
        avatar = COALESCE(?, avatar)
    WHERE id = ?
  `).run(displayName, statusMessage, avatar, userId);
  return getUserById(userId);
}

function updateUserLastSeen(userId) {
  db.prepare(`UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?`).run(userId);
}

function searchUsers(query, excludeUserId) {
  const term = `%${query}%`;
  return db.prepare(`
    SELECT id, username, displayName, publicKey, avatar, statusMessage, lastSeen
    FROM users 
    WHERE id != ? AND (LOWER(username) LIKE LOWER(?) OR LOWER(displayName) LIKE LOWER(?))
    LIMIT 25
  `).all(excludeUserId, term, term);
}

function getAllUsers(excludeUserId) {
  return db.prepare(`
    SELECT id, username, displayName, publicKey, avatar, statusMessage, lastSeen
    FROM users
    WHERE id != ?
    ORDER BY displayName ASC
    LIMIT 50
  `).all(excludeUserId);
}

// Chat queries
function findDirectChat(userId1, userId2, isE2EE = 0) {
  const row = db.prepare(`
    SELECT c.id, c.type, c.isE2EE, c.secretChatStatus
    FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chatId AND cm1.userId = ?
    JOIN chat_members cm2 ON c.id = cm2.chatId AND cm2.userId = ?
    WHERE c.type = ? AND c.isE2EE = ?
  `).get(userId1, userId2, isE2EE ? 'secret' : 'direct', isE2EE ? 1 : 0);
  return row ? getChatById(row.id, userId1) : null;
}

function createDirectChat(userId1, userId2, isE2EE = 0) {
  const existing = findDirectChat(userId1, userId2, isE2EE);
  if (existing) return existing;

  const chatType = isE2EE ? 'secret' : 'direct';
  const insertChat = db.prepare(`
    INSERT INTO chats (type, isE2EE, secretChatInitiator)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const info = insertChat.run(chatType, isE2EE ? 1 : 0, isE2EE ? userId1 : null);
    const chatId = info.lastInsertRowid;
    const insertMember = db.prepare(`INSERT INTO chat_members (chatId, userId) VALUES (?, ?)`);
    insertMember.run(chatId, userId1);
    insertMember.run(chatId, userId2);
    return chatId;
  });

  const chatId = transaction();
  return getChatById(chatId, userId1);
}

function createGroupChat(name, creatorId, memberIds) {
  const allMembers = Array.from(new Set([creatorId, ...memberIds]));
  const insertChat = db.prepare(`
    INSERT INTO chats (type, name, isE2EE)
    VALUES ('group', ?, 0)
  `);

  const transaction = db.transaction(() => {
    const info = insertChat.run(name);
    const chatId = info.lastInsertRowid;
    const insertMember = db.prepare(`INSERT INTO chat_members (chatId, userId, role) VALUES (?, ?, ?)`);
    for (const uid of allMembers) {
      insertMember.run(chatId, uid, uid === creatorId ? 'admin' : 'member');
    }
    return chatId;
  });

  const chatId = transaction();
  return getChatById(chatId, creatorId);
}

function getChatById(chatId, currentUserId) {
  const chat = db.prepare(`SELECT * FROM chats WHERE id = ?`).get(chatId);
  if (!chat) return null;

  const members = db.prepare(`
    SELECT u.id, u.username, u.displayName, u.publicKey, u.avatar, u.statusMessage, u.lastSeen, cm.role
    FROM chat_members cm
    JOIN users u ON cm.userId = u.id
    WHERE cm.chatId = ?
  `).all(chatId);

  // If direct or secret chat, determine peer info
  let peer = null;
  if (chat.type === 'direct' || chat.type === 'secret') {
    peer = members.find(m => m.id !== currentUserId) || members[0] || null;
  }

  const lastMessage = db.prepare(`
    SELECT m.*, u.displayName as senderName
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.chatId = ?
    ORDER BY m.id DESC
    LIMIT 1
  `).get(chatId);

  return {
    ...chat,
    members,
    peer,
    lastMessage: lastMessage || null
  };
}

function getUserChats(userId) {
  const chatRows = db.prepare(`
    SELECT c.*
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chatId
    WHERE cm.userId = ?
    ORDER BY c.id DESC
  `).all(userId);

  return chatRows.map(chat => {
    const members = db.prepare(`
      SELECT u.id, u.username, u.displayName, u.publicKey, u.avatar, u.statusMessage, u.lastSeen, cm.role
      FROM chat_members cm
      JOIN users u ON cm.userId = u.id
      WHERE cm.chatId = ?
    `).all(chat.id);

    let peer = null;
    if (chat.type === 'direct' || chat.type === 'secret') {
      peer = members.find(m => m.id !== userId) || members[0] || null;
    }

    const lastMessage = db.prepare(`
      SELECT m.*, u.displayName as senderName
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.chatId = ?
      ORDER BY m.id DESC
      LIMIT 1
    `).get(chat.id);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE chatId = ? AND senderId != ? AND status != 'read'
    `).get(chat.id, userId).count;

    return {
      ...chat,
      members,
      peer,
      lastMessage: lastMessage || null,
      unreadCount
    };
  });
}

function isUserInChat(chatId, userId) {
  const member = db.prepare(`
    SELECT 1 FROM chat_members WHERE chatId = ? AND userId = ?
  `).get(chatId, userId);
  return !!member;
}

function saveMessage({ chatId, senderId, type = 'text', content = '', fileUrl = null, fileName = null, fileSize = null, fileMimeType = null, fileEncrypted = 0, fileKey = null, iv = null }) {
  const stmt = db.prepare(`
    INSERT INTO messages (chatId, senderId, type, content, fileUrl, fileName, fileSize, fileMimeType, fileEncrypted, fileKey, iv, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
  `);
  const info = stmt.run(chatId, senderId, type, content, fileUrl, fileName, fileSize, fileMimeType, fileEncrypted, fileKey, iv);
  
  return db.prepare(`
    SELECT m.*, u.displayName as senderName, u.avatar as senderAvatar
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.id = ?
  `).get(info.lastInsertRowid);
}

function getChatMessages(chatId, limit = 50, beforeId = null) {
  if (beforeId) {
    return db.prepare(`
      SELECT m.*, u.displayName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.chatId = ? AND m.id < ?
      ORDER BY m.id DESC
      LIMIT ?
    `).all(chatId, beforeId, limit).reverse();
  } else {
    return db.prepare(`
      SELECT m.*, u.displayName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.chatId = ?
      ORDER BY m.id DESC
      LIMIT ?
    `).all(chatId, limit).reverse();
  }
}

function markMessagesAsRead(chatId, userId) {
  const result = db.prepare(`
    UPDATE messages
    SET status = 'read'
    WHERE chatId = ? AND senderId != ? AND status != 'read'
  `).run(chatId, userId);
  return result.changes;
}

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getUserById,
  updateUserPublicKey,
  updateUserProfile,
  updateUserLastSeen,
  searchUsers,
  getAllUsers,
  findDirectChat,
  createDirectChat,
  createGroupChat,
  getChatById,
  getUserChats,
  isUserInChat,
  saveMessage,
  getChatMessages,
  markMessagesAsRead
};
