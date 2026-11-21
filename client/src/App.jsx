import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider } from './context/CallContext';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import AuthModal from './components/AuthModal';
import CallModal from './components/CallModal';
import { Lock } from 'lucide-react';

function AppLayout() {
  const { user, loading } = useAuth();
  const { activeChatId, setActiveChatId } = useChat();

  // On mobile screens, mobileView controls whether Sidebar or ChatWindow is visible
  const [mobileView, setMobileView] = useState('sidebar'); // 'sidebar' | 'chat'

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/20 animate-pulse mb-4">
          <Lock size={28} className="stroke-[2.5]" />
        </div>
        <div className="text-lg font-bold tracking-tight text-white">SecureGram</div>
        <div className="text-xs text-slate-400 mt-1 font-mono">Initializing crypto engine...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  const handleSelectChat = () => {
    setMobileView('chat');
  };

  const handleBackToSidebar = () => {
    setActiveChatId(null);
    setMobileView('sidebar');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Sidebar: always visible on md+, conditionally on mobile */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Sidebar onSelectChat={handleSelectChat} />
      </div>

      {/* Chat Window: always visible on md+, conditionally on mobile */}
      <div
        className={`flex-1 h-full min-w-0 ${
          mobileView === 'sidebar' && !activeChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatWindow onBack={handleBackToSidebar} />
      </div>

      {/* Fullscreen WebRTC Audio/Video Call Screen & Modal */}
      <CallModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <CallProvider>
            <AppLayout />
          </CallProvider>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
