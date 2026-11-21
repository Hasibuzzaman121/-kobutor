import React, { useState, useRef } from 'react';
import { Lock, User, KeyRound, Sparkles, AlertCircle, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function AuthModal() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        let finalAvatarUrl = null;

        // If user selected a real photo, upload it to the server
        if (avatarFile) {
          const formData = new FormData();
          formData.append('file', avatarFile);
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            finalAvatarUrl = uploadData.fileUrl;
          }
        }

        await register({
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          password,
          avatar: finalAvatarUrl
        });
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-7 shadow-2xl relative text-slate-100 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 mb-3">
            <Lock size={28} className="text-slate-950 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            SecureGram
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-to-End Encrypted Cloud Messaging & Secure Data Sharing
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-950 p-1 rounded-xl mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !isRegister
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isRegister
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Real Photo Upload for Registration */}
          {isRegister && (
            <div className="flex flex-col items-center justify-center mb-2">
              <div className="relative group">
                {avatarPreview ? (
                  <div className="relative">
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-lg"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow"
                      title="Remove Photo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <Avatar
                    name={displayName || username || 'User'}
                    size="xl"
                    className="cursor-pointer"
                  />
                )}

                <label className="absolute bottom-0 right-0 p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-full shadow cursor-pointer transition-transform group-hover:scale-110">
                  <Camera size={14} />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              </div>
              <span className="text-[11px] text-slate-400 mt-2">
                {avatarPreview ? 'Photo selected' : 'Upload your photo (optional)'}
              </span>
            </div>
          )}

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Your Full Name / Display Name
              </label>
              <div className="relative">
                <Sparkles size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Hasib"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. hasib"
                required
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mx-auto" />
            ) : isRegister ? (
              'Create Real Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400">
            🔒 Hardware-accelerated WebCrypto ECDH + AES-256-GCM. Your private keys never leave this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
