// napisen - Yeni sohbet: kişi kodu (veya kişi izin verdiyse e-posta) ile sohbet başlatma
import React, { useEffect, useRef, useState } from 'react';
import { X, KeyRound, Loader2, MessageSquarePlus } from 'lucide-react';
import MyCodeCard from './MyCodeCard';

export default function NewChatModal({ myCode, onAdd, onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onAdd(value);
    } catch (err) {
      setError(err.message || 'Kişi eklenemedi.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-3 pt-[15vh] sm:pt-3 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#111b21] border border-[#2a3942] shadow-2xl"
      >
        <div className="flex items-center justify-between bg-[#202c33] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e9edef]">
            <MessageSquarePlus className="h-4 w-4 text-[#00a884]" /> Yeni sohbet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#aebac1] hover:bg-[#374248] cursor-pointer"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-[#8696a0]">
            Yazışmak istediğiniz kişinin <strong className="text-[#e9edef]">kişi kodunu</strong> girin. Kişi
            e-postayla bulunmaya izin verdiyse e-posta adresini de yazabilirsiniz. Kullanıcı listesi kimseye
            gösterilmez.
          </p>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-[#8696a0]" />
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Kod (ör. 7K3Q-9XW2) veya e-posta"
              className="w-full rounded-xl bg-[#202c33] py-2.5 pl-9 pr-3 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-2 focus:ring-[#00a884]"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-950/60 p-2.5 text-xs leading-relaxed text-red-200 border border-red-800/60">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] py-2.5 text-sm font-semibold text-[#111b21] disabled:opacity-50 cursor-pointer"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sohbet başlat
          </button>
          <div className="border-t border-[#222d34] pt-3">
            <MyCodeCard code={myCode} />
          </div>
        </div>
      </form>
    </div>
  );
}
