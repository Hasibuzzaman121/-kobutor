import React, { useRef, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Shield,
  Volume2
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';

export default function CallModal() {
  const {
    callStatus,
    callType,
    peerUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Attach local media stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote media stream
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, callType]);

  if (callStatus === 'idle') return null;

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. INCOMING CALL MODAL
  if (callStatus === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative">
          {/* Glowing Animated Avatar */}
          <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping" />
            <Avatar user={peerUser} size="xl" className="relative z-10" />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{peerUser?.displayName || 'User'}</h3>
          <p className="text-xs text-slate-400 mb-2">@{peerUser?.username}</p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold mb-8 border border-cyan-500/20">
            {callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
            <span>Incoming {callType === 'video' ? 'Video' : 'Audio'} Call...</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={rejectCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95"
              title="Decline"
            >
              <PhoneOff size={24} />
            </button>
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform active:scale-95"
              title="Accept"
            >
              <Phone size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. OUTGOING CALLING MODAL
  if (callStatus === 'calling') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative">
          <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse" />
            <Avatar user={peerUser} size="xl" className="relative z-10" />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{peerUser?.displayName || 'User'}</h3>
          <p className="text-xs text-slate-400 mb-2">@{peerUser?.username}</p>

          <p className="text-xs text-cyan-400 animate-pulse font-medium mb-8">
            Ringing {callType === 'video' ? 'video' : 'audio'} call...
          </p>

          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95 mx-auto"
            title="Cancel Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    );
  }

  // 3. CONNECTED CALL SCREEN (Full Screen Overlay)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-fade-in select-none">
      {/* Top Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between p-3 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800">
        <div className="flex items-center gap-3">
          <Avatar user={peerUser} size="md" />
          <div>
            <div className="text-sm font-bold text-white">{peerUser?.displayName}</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
          <Shield size={14} />
          <span className="hidden sm:inline">P2P Encrypted (DTLS/SRTP)</span>
        </div>
      </div>

      {/* Main Video / Audio Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950">
        {callType === 'video' ? (
          <>
            {/* Remote Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Video Stream (Picture in Picture) */}
            <div className="absolute bottom-24 right-5 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-slate-900 z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <VideoOff size={24} className="mb-1" />
                  <span>Camera Off</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Audio-only Call View */
          <div className="text-center p-8">
            <audio ref={remoteAudioRef} autoPlay />
            <div className="relative mx-auto w-32 h-32 mb-6 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
              <Avatar user={peerUser} size="2xl" className="relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{peerUser?.displayName}</h2>
            <div className="text-cyan-400 text-sm flex items-center justify-center gap-2">
              <Volume2 size={16} className="animate-pulse" /> Audio Call Connected
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 px-6 py-3 rounded-full shadow-2xl">
        {/* Toggle Mute */}
        <button
          onClick={toggleMute}
          className={`p-3.5 rounded-full transition-colors ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Video (if video call) */}
        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-full transition-colors ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        {/* Screen Share (if video call) */}
        {callType === 'video' && (
          <button
            onClick={toggleScreenShare}
            className={`p-3.5 rounded-full transition-colors ${
              isScreenSharing
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor size={20} />
          </button>
        )}

        {/* Hang Up */}
        <button
          onClick={endCall}
          className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-transform active:scale-95"
          title="End Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
