# SecureGram — Secure Real-Time Messenger & Data Sharing

SecureGram is a modern, high-performance web messaging application inspired by **Telegram** and **Messenger**. It provides instant real-time internet communication, group discussions, voice notes, and **End-to-End Encrypted (E2EE) Secret Chats** where messages and files are encrypted directly in the browser before ever touching the server.

---

## 🔒 Security & Cryptographic Highlights

1. **Hardware-Accelerated WebCrypto API**:
   - Uses browser-native `crypto.subtle` with Elliptic Curve Diffie-Hellman (**ECDH P-256**) for zero-knowledge key agreement.
   - Messages are encrypted with **AES-256-GCM** (Galois/Counter Mode) with a unique 96-bit Initialization Vector (IV) per message for authenticated confidentiality and integrity.
   - User private keys never leave the client's local browser memory (`localStorage`).

2. **Zero-Knowledge File & Media Transfer**:
   - Images, documents, and voice messages sent in Secret Chats are converted to `ArrayBuffer`, encrypted with AES-256-GCM on the client, and only stored as `.enc` ciphertext on the server.
   - Even if the database or server storage is compromised, files cannot be decrypted without the peer's private key.

3. **Visual Safety Fingerprints (MITM Protection)**:
   - Deterministic SHA-256 hash comparison represented as 4 visual emojis and 16-digit safety codes (identical on both devices) to guarantee no Man-in-the-Middle eavesdropping.

4. **Dual Chat Modes (Telegram-style)**:
   - **Cloud Chats**: Fast, synchronized 1-on-1 and Group chats with TLS transport security.
   - **Secret Chats**: Peer-to-peer end-to-end encrypted sessions with padlock badge and safety verification.

---

## 🚀 Features

- **⚡ Real-Time Instant Messaging**: Socket.IO powered messaging with zero polling delay.
- **🎙️ Voice Notes**: Built-in voice message recorder with audio waveforms, duration timer, and inline player.
- **📎 Secure File & Photo Sharing**: Attach photos and documents with instant lightbox previews and progress.
- **👥 Group Chats**: Create custom multi-member groups with admin roles.
- **🟢 Live Presence**: Real-time online/offline badges and animated "Typing..." indicators.
- **✓✓ Read Receipts**: Single tick (✓ sent) and double tick (✓✓ read) delivery tracking.
- **🔍 Global Contact Search**: Instant search across conversations and registered users to start chats.
- **🎨 Telegram / Messenger Dark Theme**: Modern glassmorphism dark palette built with Tailwind CSS.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Web Crypto API
- **Backend**: Node.js, Express, Socket.IO, Multer, JWT, Bcrypt
- **Database**: SQLite (via `better-sqlite3` with WAL mode for fast concurrency)

---

## 📦 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ or v24+ recommended)
- **npm**

### 2. Run Both Server & Client Concurrently
From the project root directory, run:
```bash
npm run dev
```

This starts:
- **Backend API & Socket server**: `http://localhost:5000`
- **Vite React Frontend**: `http://localhost:5173`

### 3. Or Run Individually

**Start Backend Server:**
```bash
npm run dev:server
```

**Start Frontend Client:**
```bash
npm run dev:client
```

Open your browser at **`http://localhost:5173`**.

---

## 🧪 Automated Integration Tests

To run the end-to-end cryptographic and API test suite:
```bash
node test-e2e.js
```

All 7 test suites verify:
- Server health & database connections
- User authentication & password hashing
- WebCrypto ECDH key exchange & AES-GCM encryption/decryption
- Secret Chat handshakes
- Encrypted multipart file uploads
- Group chat coordination

---

## 📁 Project Structure

```
messege project/
├── client/                      # Vite + React Frontend
│   ├── src/
│   │   ├── components/          # UI Components
│   │   │   ├── Sidebar.jsx      # Chats list, tabs, user search
│   │   │   ├── ChatWindow.jsx   # Message list, input area, media preview
│   │   │   ├── MessageBubble.jsx# Bubble styling, decryptor, ticks
│   │   │   ├── VoiceRecorder.jsx# In-browser audio recording
│   │   │   ├── VoicePlayer.jsx  # Audio player with decrypted playback
│   │   │   ├── SecretChatModal.jsx
│   │   │   ├── GroupModal.jsx
│   │   │   ├── SecurityVerificationModal.jsx
│   │   │   ├── MediaViewerModal.jsx
│   │   │   └── AuthModal.jsx    # Login / Register
│   │   ├── crypto/
│   │   │   └── e2ee.js          # WebCrypto ECDH & AES-256-GCM engine
│   │   ├── context/
│   │   │   ├── AuthContext.jsx  # User session & keypair storage
│   │   │   ├── SocketContext.jsx# Socket.io connection & presence
│   │   │   └── ChatContext.jsx  # Messaging, typing, decryption cache
│   │   ├── App.jsx
│   │   └── index.css
│   └── vite.config.js
├── server/                      # Express + Socket.IO Backend
│   ├── src/
│   │   ├── config.js
│   │   ├── db.js                # SQLite tables & query helpers
│   │   ├── middleware/auth.js   # JWT verification
│   │   ├── routes/              # Auth, Users, Chats, Uploads
│   │   ├── socket/index.js      # Realtime events, presence, rooms
│   │   └── index.js             # HTTP server entry point
│   └── uploads/                 # Static encrypted/unencrypted files
├── test-e2e.js                  # Automated E2E verification test
└── package.json                 # Unified monorepo run scripts
```
