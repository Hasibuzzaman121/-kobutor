# 🚀 How to Deploy SecureGram to the Internet (Free 24/7 Hosting)

SecureGram is now bundled as a **Single Unified Fullstack Service** (Frontend + Backend + Real-time WebSockets + Database). You can host it for free on **Render.com** or **Railway.app** in under 5 minutes.

---

## 🌟 Method 1: Deploy on Render.com (Recommended & Free)

1. **Push your code to GitHub**:
   In your project folder, run:
   ```bash
   git init
   git add .
   git commit -m "SecureGram initial commit"
   ```
   Create a new repository on [GitHub](https://github.com/new) and push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/securegram.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [Render.com](https://render.com) and sign up with your GitHub account.
   - Click **New +** ➔ **Web Service**.
   - Select your `securegram` repository.
   - Fill in these 3 fields:
     - **Name**: `my-securegram` (or any name you choose)
     - **Build Command**: `npm run build`
     - **Start Command**: `npm start`
   - Scroll down and choose the **Free** plan.
   - Click **Create Web Service**.

3. **Done!**  
   Render will build the app and give you a free, secure **HTTPS URL** (e.g., `https://my-securegram.onrender.com`).  
   Anyone around the world can open this link on their mobile or laptop, create an account, chat, and make P2P video/audio calls!

---

## ⚡ Method 2: Deploy on Railway.app

1. Go to [Railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** ➔ **Deploy from GitHub repo**.
3. Select your repository.
4. Railway will automatically detect Node.js, run `npm run build`, and launch `npm start`.
5. Under Settings ➔ Networking, click **Generate Domain**. You will get a live public HTTPS URL immediately!

---

## 🔒 Why HTTPS is Required
Modern browsers mandate HTTPS for:
- WebRTC camera and microphone streams (Audio/Video calls).
- WebCrypto API hardware-accelerated encryption (`crypto.subtle`).

Both Render and Railway provide **free automatic SSL (HTTPS)** for your domain.
