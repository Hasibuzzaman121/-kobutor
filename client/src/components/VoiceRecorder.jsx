import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    startRecording();
    return () => {
      stopAndCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        // Stop all tracks on the stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Microphone access required to record voice notes.');
      onCancel();
    }
  };

  const stopAndCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
    }
  };

  const handleSend = () => {
    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          onSendVoice(blob);
        };
        mediaRecorderRef.current.stop();
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } else if (audioBlob) {
      onSendVoice(audioBlob);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-700/80 px-4 py-2.5 rounded-2xl w-full animate-fade-in shadow-xl">
      {/* Pulsing Red Dot */}
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
        <span className="text-red-400 font-mono text-sm font-semibold tracking-wider">
          {formatTimer(recordingTime)}
        </span>
      </div>

      <div className="flex-1 text-xs text-slate-400 truncate text-center font-medium">
        {recording ? 'Recording voice message...' : 'Audio recorded'}
      </div>

      {/* Discard button */}
      <button
        type="button"
        onClick={() => {
          stopAndCleanup();
          onCancel();
        }}
        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
        title="Discard"
      >
        <Trash2 size={18} />
      </button>

      {/* Stop button (if recording) */}
      {recording && (
        <button
          type="button"
          onClick={handleStop}
          className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
          title="Stop Recording"
        >
          <Square size={16} />
        </button>
      )}

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold rounded-full shadow-lg transition-transform active:scale-95"
        title="Send Voice Note"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
