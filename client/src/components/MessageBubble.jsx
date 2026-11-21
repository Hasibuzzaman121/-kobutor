import React, { useState, useEffect } from 'react';
import { FileText, Download, Check, CheckCheck, Lock, Shield, Image as ImageIcon } from 'lucide-react';
import VoicePlayer from './VoicePlayer';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { decryptFile, decryptMessage } from '../crypto/e2ee';

export default function MessageBubble({ message, onOpenImage }) {
  const { user } = useAuth();
  const { activeChat, getSharedKeyForChat } = useChat();
  const isSender = message.senderId === user?.id;

  const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);
  const [decryptedText, setDecryptedText] = useState(message.decryptedContent || null);
  const [downloading, setDownloading] = useState(false);
  const [decryptingMedia, setDecryptingMedia] = useState(false);

  // Auto decrypt text content if encrypted and decryptedContent is missing
  useEffect(() => {
    if (message.decryptedContent) {
      setDecryptedText(message.decryptedContent);
      return;
    }

    if (activeChat?.isE2EE && message.iv && message.content && message.type === 'text') {
      let isMounted = true;
      const decrypt = async () => {
        try {
          const sharedKey = await getSharedKeyForChat(activeChat);
          if (sharedKey && isMounted) {
            const plain = await decryptMessage(message.content, message.iv, sharedKey);
            if (isMounted) setDecryptedText(plain);
          }
        } catch (err) {
          console.error('Failed to decrypt text message:', err);
        }
      };
      decrypt();
      return () => {
        isMounted = false;
      };
    }
  }, [message, activeChat, getSharedKeyForChat]);

  // Auto decrypt image preview if encrypted
  useEffect(() => {
    let objectUrl = null;
    let isMounted = true;

    const decryptImagePreview = async () => {
      if (message.type === 'image' && message.fileEncrypted && message.fileUrl && message.iv) {
        setDecryptingMedia(true);
        try {
          const res = await fetch(message.fileUrl);
          const encBuf = await res.arrayBuffer();
          const sharedKey = await getSharedKeyForChat(activeChat);
          if (sharedKey && isMounted) {
            const decBuf = await decryptFile(encBuf, message.iv, sharedKey);
            const blob = new Blob([decBuf], { type: message.fileMimeType || 'image/jpeg' });
            objectUrl = URL.createObjectURL(blob);
            if (isMounted) setDecryptedFileUrl(objectUrl);
          }
        } catch (err) {
          console.error('Failed to decrypt image preview:', err);
        } finally {
          if (isMounted) setDecryptingMedia(false);
        }
      }
    };

    decryptImagePreview();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message, activeChat, getSharedKeyForChat]);

  // Handle encrypted file download
  const handleDownloadFile = async () => {
    if (!message.fileUrl) return;

    if (message.fileEncrypted && message.iv) {
      setDownloading(true);
      try {
        const res = await fetch(message.fileUrl);
        const encBuf = await res.arrayBuffer();
        const sharedKey = await getSharedKeyForChat(activeChat);
        if (sharedKey) {
          const decBuf = await decryptFile(encBuf, message.iv, sharedKey);
          const blob = new Blob([decBuf], { type: message.fileMimeType || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = message.fileName ? message.fileName.replace('.enc', '') : 'decrypted-file';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        alert('Failed to decrypt and download file: ' + err.message);
      } finally {
        setDownloading(false);
      }
    } else {
      const a = document.createElement('a');
      a.href = message.fileUrl;
      a.download = message.fileName || 'download';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col mb-2.5 ${isSender ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl p-3 shadow-md transition-all ${
          isSender
            ? 'bg-blue-600 text-white rounded-tr-xs'
            : 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700/60'
        }`}
      >
        {/* Group Sender Name */}
        {!isSender && activeChat?.type === 'group' && (
          <div className="text-[11px] font-bold text-cyan-400 mb-1">
            {message.senderName || 'Member'}
          </div>
        )}

        {/* Voice Note */}
        {message.type === 'voice' && (
          <VoicePlayer message={message} isSender={isSender} />
        )}

        {/* Image Attachment */}
        {message.type === 'image' && (
          <div className="mb-2 rounded-xl overflow-hidden cursor-pointer group relative min-h-[140px] bg-black/20 flex items-center justify-center">
            {message.fileEncrypted && !decryptedFileUrl ? (
              <div className="flex flex-col items-center justify-center p-6 text-xs text-slate-400 gap-2 select-none">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <Shield size={12} /> Decrypting photo...
                </span>
              </div>
            ) : (
              <>
                <img
                  src={decryptedFileUrl || message.fileUrl}
                  alt={message.fileName || 'Image'}
                  onClick={() =>
                    onOpenImage({
                      url: decryptedFileUrl || message.fileUrl,
                      name: message.fileName,
                      isEncrypted: !!message.fileEncrypted
                    })
                  }
                  className="max-h-60 sm:max-h-72 w-full object-cover rounded-xl transition-transform group-hover:scale-[1.02]"
                />
                {message.fileEncrypted ? (
                  <span className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield size={10} /> Encrypted
                  </span>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Generic File Attachment */}
        {message.type === 'file' && (
          <div className="flex items-center gap-3 p-2.5 bg-black/20 rounded-xl mb-1.5 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-cyan-300 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <div className="text-xs font-medium truncate text-white">
                {message.fileName || 'Document'}
              </div>
              <div className="text-[10px] opacity-75">
                {formatFileSize(message.fileSize)}
                {message.fileEncrypted ? ' • Encrypted' : ''}
              </div>
            </div>
            <button
              onClick={handleDownloadFile}
              disabled={downloading}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download file"
            >
              {downloading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </button>
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {decryptedText !== null ? decryptedText : message.content}
          </p>
        )}

        {/* Footer: Time + E2EE Lock + Read ticks */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
            isSender ? 'text-blue-200' : 'text-slate-400'
          }`}
        >
          {message.fileEncrypted || message.iv ? (
            <span title="End-to-End Encrypted" className="text-emerald-400 flex items-center">
              <Lock size={10} />
            </span>
          ) : null}

          <span>{formatTime(message.createdAt)}</span>

          {isSender && (
            <span>
              {message.status === 'read' ? (
                <CheckCheck size={13} className="text-cyan-300 stroke-[2.5]" />
              ) : (
                <Check size={13} className="opacity-80" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
