// napisen - Mesajı başka bir kişiye iletme
import React, { useState } from 'react';
import { X, Forward, Loader2 } from 'lucide-react';
import { canMessage } from '../hooks/useMessenger';

export default function ForwardModal({ message, contacts, onForward, onClose }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const targets = contacts.filter((c) => canMessage(c.keyStatus) && !c.blocked);

  const preview =
    message.type === 'image' ? '📷 Fotoğraf' : message.type === 'audio' ? '🎤 Sesli mesaj' : message.text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#2a3942] bg-[#111b21] shadow-2xl">
        <div className="flex items-center justify-between bg-[#202c33] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e9edef]">
            <Forward className="h-4 w-4 text-[#00a884]" /> Mesajı ilet
          </h2>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full p-1.5 text-[#aebac1] hover:bg-[#374248] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="line-clamp-3 rounded-lg bg-[#182229] p-2.5 text-xs text-[#c5cdd2]">{preview}</p>
          {error && <p className="rounded-lg bg-red-950/60 p-2 text-xs text-red-200">{error}</p>}
          <div className="max-h-72 divide-y divide-[#222d34] overflow-y-auto rounded-xl border border-[#2a3942] bg-[#182229]">
            {targets.length === 0 && <p className="p-3 text-xs text-[#8696a0]">İletilebilecek kişi yok.</p>}
            {targets.map((c) => (
              <button
                key={c.email}
                disabled={Boolean(busy)}
                onClick={async () => {
                  setBusy(c.email);
                  setError('');
                  try {
                    await onForward(c.email);
                    onClose();
                  } catch (err) {
                    setError(err.message || 'İletilemedi.');
                    setBusy(null);
                  }
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#202c33] disabled:opacity-60 cursor-pointer"
              >
                <span className="truncate">{c.name}</span>
                {busy === c.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4 text-[#8696a0]" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
