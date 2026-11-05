// napisen - Kullanıcı şikâyet etme
import React, { useState } from 'react';
import { X, Flag, Loader2 } from 'lucide-react';

export const REPORT_REASONS = {
  spam: 'Spam / istenmeyen mesaj',
  harassment: 'Taciz veya tehdit',
  illegal: 'Yasa dışı içerik',
  impersonation: 'Başkasını taklit etme / dolandırıcılık',
  other: 'Diğer',
};

export default function ReportModal({ contact, onSubmit, onClose }) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState(true);
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit({ reason, details, evidence, alsoBlock });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Şikâyet gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#2a3942] bg-[#111b21] shadow-2xl">
        <div className="flex items-center justify-between bg-[#202c33] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e9edef]">
            <Flag className="h-4 w-4 text-red-400" /> {contact.name} kişisini şikâyet et
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-1.5 text-[#aebac1] hover:bg-[#374248] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="space-y-3 p-4 text-sm text-[#e9edef]">
            <p>Şikâyetiniz moderatörlere iletildi. Teşekkürler.</p>
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-[#00a884] py-2.5 font-semibold text-[#111b21] cursor-pointer">
              Tamam
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4 text-xs text-[#e9edef]">
            <label className="block">
              <span className="mb-1 block text-[#8696a0]">Neden</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg bg-[#202c33] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                {Object.entries(REPORT_REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[#8696a0]">Açıklama (isteğe bağlı)</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full rounded-lg bg-[#202c33] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </label>
            <label className="flex items-start gap-2 leading-relaxed">
              <input type="checkbox" checked={evidence} onChange={(e) => setEvidence(e.target.checked)} className="mt-0.5 accent-[#00a884]" />
              <span>
                Bu kişiden gelen <strong>son 10 mesajı</strong> delil olarak moderatörlere gönder. (Mesajlar şifreli
                olduğundan moderatörler ancak bu şekilde görebilir.)
              </span>
            </label>
            <label className="flex items-start gap-2 leading-relaxed">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="mt-0.5 accent-[#00a884]" />
              <span>Bu kişiyi ayrıca engelle</span>
            </label>
            {error && <p className="rounded-lg bg-red-950/60 p-2 text-red-200">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Şikâyet et
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
