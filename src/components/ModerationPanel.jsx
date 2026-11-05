// napisen - Moderatör paneli: şikâyetler ve askıya alınan hesaplar
import React, { useEffect, useState } from 'react';
import { Ban, Check, Flag, UserX } from 'lucide-react';
import {
  subscribeOpenReports,
  subscribeBans,
  banUser,
  unbanUser,
  resolveReport,
} from '../services/firebase';
import { REPORT_REASONS } from './ReportModal';
import { normalizeEmail } from '../services/crypto';

const fmt = (ts) => {
  const ms = typeof ts === 'number' ? ts : ts?.toMillis?.();
  return ms ? new Date(ms).toLocaleString('tr-TR') : '';
};

export default function ModerationPanel({ me }) {
  const [reports, setReports] = useState(null);
  const [bans, setBans] = useState([]);
  const [msg, setMsg] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  useEffect(() => {
    const onErr = (err) => setMsg(err?.code === 'permission-denied' ? 'Moderatör yetkiniz yok.' : 'Yüklenemedi.');
    const u1 = subscribeOpenReports(setReports, onErr);
    const u2 = subscribeBans(setBans, onErr);
    return () => {
      u1();
      u2();
    };
  }, []);

  const run = async (fn, ok) => {
    setMsg('');
    try {
      await fn();
      setMsg(ok);
    } catch (err) {
      setMsg('İşlem başarısız: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
    }
  };

  const banFromReport = (r) => {
    const reason = window.prompt(`${r.reported} askıya alınsın. Gerekçe:`, REPORT_REASONS[r.reason] || 'Kural ihlali');
    if (reason === null) return;
    run(async () => {
      await banUser(r.reported, reason, me.email);
      await resolveReport(r.id, 'resolved', `Askıya alındı: ${reason}`, me.email);
    }, `${r.reported} askıya alındı.`);
  };

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-[#00a884]">{msg}</p>}

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8696a0]">
          <Flag className="h-3.5 w-3.5" /> Açık şikâyetler {reports ? `(${reports.length})` : ''}
        </h4>
        {reports === null && <p className="text-xs text-[#8696a0]">Yükleniyor...</p>}
        {reports?.length === 0 && <p className="text-xs text-[#8696a0]">Bekleyen şikâyet yok.</p>}
        <div className="space-y-2">
          {reports?.map((r) => (
            <div key={r.id} className="space-y-2 rounded-xl border border-[#2a3942] bg-[#182229] p-3 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-red-300">{REPORT_REASONS[r.reason] || r.reason}</span>
                <span className="text-[#8696a0]">{fmt(r.createdAt)}</span>
              </div>
              <p>
                <span className="text-[#8696a0]">Şikâyet edilen:</span> {r.reported}
                <br />
                <span className="text-[#8696a0]">Şikâyet eden:</span> {r.reporter}
              </p>
              {r.details && <p className="rounded bg-[#111b21] p-2 text-[#c5cdd2]">{r.details}</p>}
              {r.evidence?.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-[#8696a0]">Delil mesajlar ({r.evidence.length})</summary>
                  <p className="mt-1 rounded bg-amber-950/40 p-2 text-[10px] leading-relaxed text-amber-200">
                    Bu mesajlar şikâyet eden kişinin cihazından iletilmiştir. Mesajlar uçtan uca şifreli olduğundan
                    sunucu bunların gerçekten gönderildiğini doğrulayamaz. Karar verirken diğer şikâyetleri ve
                    bağlamı da dikkate alın.
                  </p>
                  <ul className="mt-1 space-y-1">
                    {r.evidence.map((e, i) => (
                      <li key={i} className="rounded bg-[#111b21] p-2 text-[#c5cdd2]">
                        <span className="block text-[10px] text-[#8696a0]">{fmt(e.at)}</span>
                        {e.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex gap-2">
                <button onClick={() => banFromReport(r)} className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 font-semibold text-white cursor-pointer">
                  <Ban className="h-3.5 w-3.5" /> Askıya al
                </button>
                <button
                  onClick={() => run(() => resolveReport(r.id, 'dismissed', 'Geçersiz', me.email), 'Şikâyet kapatıldı.')}
                  className="flex items-center gap-1 rounded-lg bg-[#202c33] px-2.5 py-1.5 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> Geçersiz say
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8696a0]">
          <UserX className="h-3.5 w-3.5" /> Askıdaki hesaplar
        </h4>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const email = normalizeEmail(manualEmail);
            if (!email.includes('@')) return;
            const reason = window.prompt(`${email} askıya alınsın. Gerekçe:`, 'Kural ihlali');
            if (reason === null) return;
            run(() => banUser(email, reason, me.email), `${email} askıya alındı.`).then(() => setManualEmail(''));
          }}
          className="mb-2 flex gap-2"
        >
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="e-posta ile askıya al"
            className="min-w-0 flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
          <button type="submit" className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white cursor-pointer">
            Askıya al
          </button>
        </form>
        <div className="divide-y divide-[#222d34] rounded-xl border border-[#2a3942] bg-[#182229]">
          {bans.length === 0 && <p className="p-3 text-xs text-[#8696a0]">Askıda hesap yok.</p>}
          {bans.map((b) => (
            <div key={b.email} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
              <span className="min-w-0">
                <span className="block truncate">{b.email}</span>
                <span className="block truncate text-[#8696a0]">{b.reason}</span>
              </span>
              <button
                onClick={() => window.confirm(`${b.email} için askı kaldırılsın mı?`) && run(() => unbanUser(b.email), 'Askı kaldırıldı.')}
                className="shrink-0 rounded-lg bg-[#202c33] px-2.5 py-1.5 cursor-pointer"
              >
                Askıyı kaldır
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
