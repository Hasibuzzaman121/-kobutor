import React from 'react';
import { X, Download, Shield } from 'lucide-react';

export default function MediaViewerModal({ mediaUrl, fileName, isEncrypted, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors z-10"
      >
        <X size={24} />
      </button>

      <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center">
        <img
          src={mediaUrl}
          alt={fileName || 'Shared Media'}
          className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
        />

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-300">
          <span className="font-medium">{fileName || 'Image'}</span>
          {isEncrypted ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Shield size={13} /> E2EE Encrypted File
            </span>
          ) : null}
          <a
            href={mediaUrl}
            download={fileName || 'image.jpg'}
            className="flex items-center gap-1 text-cyan-400 hover:underline cursor-pointer"
          >
            <Download size={14} /> Download
          </a>
        </div>
      </div>
    </div>
  );
}
