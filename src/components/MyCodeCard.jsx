// napisen - Kullanıcının kişi kodu: kopyala / paylaş
import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

export default function MyCodeCard({ code, compact = false }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Pano erişimi yoksa metni seçilebilir bırak
      window.prompt('Kodunuz:', code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({
        title: 'napisen',
        text: `napisen'de bana yazmak için kodum: ${code}\n${window.location.origin}`,
      });
    } catch {
      /* kullanıcı vazgeçti */
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        title="Kodu kopyala"
        className="flex items-center gap-1 text-[11px] text-[#00a884] font-mono truncate hover:underline cursor-pointer"
      >
        {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        {copied ? 'Kopyalandı' : `Kodum: ${code}`}
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-[#182229] p-3 border border-[#2a3942]">
      <p className="text-[11px] text-[#8696a0]">Sizin kişi kodunuz — size yazmak isteyene bunu verin:</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xl font-bold tracking-widest text-[#e9edef] select-all">{code}</span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-lg bg-[#202c33] px-2.5 py-1.5 text-xs text-[#e9edef] hover:bg-[#2a3942] cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#00a884]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-1 rounded-lg bg-[#00a884] px-2.5 py-1.5 text-xs font-semibold text-[#111b21] cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" /> Paylaş
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
