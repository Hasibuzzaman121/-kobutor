import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Shield } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { decryptFile } from '../crypto/e2ee';

export default function VoicePlayer({ message, isSender }) {
  const { activeChat, getSharedKeyForChat } = useChat();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  // Load and decrypt audio if needed
  useEffect(() => {
    let objectUrl = null;
    let isMounted = true;

    const prepareAudio = async () => {
      if (!message.fileUrl) return;

      if (message.fileEncrypted && message.iv) {
        setLoading(true);
        try {
          const res = await fetch(message.fileUrl);
          const encryptedBuf = await res.arrayBuffer();
          const sharedKey = await getSharedKeyForChat(activeChat);

          if (sharedKey && isMounted) {
            const decryptedBuf = await decryptFile(encryptedBuf, message.iv, sharedKey);
            const blob = new Blob([decryptedBuf], { type: message.fileMimeType || 'audio/webm' });
            objectUrl = URL.createObjectURL(blob);
            if (isMounted) setAudioUrl(objectUrl);
          }
        } catch (err) {
          console.error('Failed to decrypt voice note:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        setAudioUrl(message.fileUrl);
      }
    };

    prepareAudio();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message, activeChat, getSharedKeyForChat]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && isFinite(d)) {
        setDuration(d);
      }
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const c = audioRef.current.currentTime;
      setCurrentTime(c);
      if ((!duration || !isFinite(duration)) && audioRef.current.duration && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const seekTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 px-2 min-w-[210px] sm:min-w-[250px]">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
        />
      )}

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={loading || !audioUrl}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
          isSender
            ? 'bg-blue-400 text-slate-900 hover:bg-blue-300'
            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
        }`}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause size={18} className="fill-current" />
        ) : (
          <Play size={18} className="fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform / Scrubber */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration && isFinite(duration) ? duration : 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl}
            className="w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="flex justify-between items-center text-[11px] opacity-75 select-none font-mono">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1">
            {message.fileEncrypted ? (
              <span className="flex items-center text-emerald-400 gap-0.5 text-[10px]">
                <Shield size={10} /> E2EE
              </span>
            ) : null}
            <span>{formatTime(duration)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
