// napisen - Tam Ekran Görsel İnceleyici (Lightbox)
import React, { useEffect } from 'react';
import { X, Download, Shield } from 'lucide-react';

const EXT = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export default function ImageLightbox({ imageUrl, mimeType, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-sm select-none">
      {/* Üst Çubuk */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white/80">
        <div className="flex items-center gap-2 text-xs text-[#00a884]">
          <Shield className="h-4 w-4" />
          <span>Uçtan uca şifreli medya</span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={imageUrl}
            download={`napisen_${Date.now()}.${EXT[mimeType] || 'jpg'}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            title="İndir"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-white cursor-pointer"
            title="Kapat"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Görsel */}
      <img
        src={imageUrl}
        alt="Büyük Görünüm"
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}

