// napisen - Kişi doğrulama: QR okutma veya güvenlik numarası karşılaştırma
import React, { useEffect, useState } from 'react';
import { X, QrCode as QrIcon, ScanLine, Hash, ShieldCheck, ShieldAlert, CheckCircle2, UserMinus } from 'lucide-react';
import QrCode from './QrCode';
import QrScanner from './QrScanner';
import { computeSafetyNumber, encodeVerifyCode } from '../services/crypto';

export default function VerifyContactModal({
  me,
  identity,
  myCode,
  contact,
  trusted,
  onVerifyByCode,
  onVerifyBySafetyNumber,
  onUnverify,
  onAcceptKey,
  onRemoveContact,
  onClose,
}) {
  const [tab, setTab] = useState('show');
  const [safety, setSafety] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const myVerifyCode = encodeVerifyCode(me.email, identity.publicKey, myCode);

  useEffect(() => {
    if (!contact?.publicKey) {
      setSafety(null);
      return;
    }
    computeSafetyNumber(me.email, identity.publicKey, contact.email, contact.publicKey).then(setSafety);
  }, [me.email, identity.publicKey, contact?.email, contact?.publicKey]);

  if (!contact) return null;
  const status = contact.keyStatus;

  const handleScan = async (text) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const email = await onVerifyByCode(text);
      if (email !== contact.email) {
        setSuccess(`${email} doğrulandı. (Bu pencere ${contact.email} içindi.)`);
      } else {
        setSuccess(`${contact.name} doğrulandı. Artık güvenle mesajlaşabilirsiniz.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (id, Icon, label) => (
    <button
      onClick={() => {
        setTab(id);
        setError('');
      }}
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition cursor-pointer ${
        tab === id ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#111b21] border border-[#2a3942] shadow-2xl">
        <div className="flex items-center justify-between bg-[#202c33] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#e9edef]">{contact.name} ile doğrulama</h2>
            {contact.code && <p className="text-[11px] font-mono text-[#8696a0]">{contact.code}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#aebac1] hover:bg-[#374248] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          {status === 'verified' && (
            <div className="flex items-center gap-2 rounded-lg bg-[#00a884]/10 p-2.5 text-xs text-[#00a884] border border-[#00a884]/30">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Doğrulanmış ({trusted?.method === 'qr' ? 'QR ile' : 'güvenlik numarasıyla'})
            </div>
          )}
          {status === 'changed' && (
            <div className="flex gap-2 rounded-lg bg-red-950/60 p-2.5 text-xs text-red-200 border border-red-800/60">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span className="space-y-2">
                <span className="block">
                  Bu kişinin anahtarı değişti. Yeni bir cihaz kurmuş olabilir; ya da biri araya girmeye çalışıyor
                  olabilir. Mümkünse QR ile doğrulayın veya yeni anahtarı kabul edin.
                </span>
                <button
                  onClick={async () => {
                    await onAcceptKey(contact.email);
                    setSuccess('Yeni anahtar kabul edildi. Mesajlaşmaya devam edebilirsiniz.');
                  }}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                >
                  Yeni anahtarı kabul et
                </button>
              </span>
            </div>
          )}
          {status === 'no-key' && (
            <div className="rounded-lg bg-amber-950/50 p-2.5 text-xs text-amber-200 border border-amber-800/40">
              Bu kişi henüz uygulamaya giriş yapmadı. Giriş yaptıktan sonra doğrulama yapabilirsiniz.
            </div>
          )}
          {status === 'unverified' && (
            <p className="text-xs leading-relaxed text-[#8696a0]">
              Mesajlarınız zaten uçtan uca şifreli. Doğrulama <strong className="text-[#e9edef]">isteğe bağlıdır</strong>:
              konuştuğunuz kişinin gerçekten o olduğundan emin olmak için yüz yüzeyken birbirinizin kodunu okutun.
            </p>
          )}
        </div>

        <div className="mt-2 flex border-b border-[#222d34] px-2">
          {tabBtn('show', QrIcon, 'Kodum')}
          {tabBtn('scan', ScanLine, 'Kodu okut')}
          {tabBtn('number', Hash, 'Güvenlik no.')}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <p className="rounded-lg bg-red-950/60 p-2.5 text-xs text-red-200 border border-red-800/60">{error}</p>}
          {success && (
            <p className="flex items-center gap-2 rounded-lg bg-[#00a884]/10 p-2.5 text-xs text-[#00a884] border border-[#00a884]/30">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
            </p>
          )}

          {tab === 'show' && (
            <div className="flex flex-col items-center gap-2 text-center">
              <QrCode value={myVerifyCode} />
              <p className="text-[11px] text-[#8696a0]">{contact.name}, bu kodu kendi telefonundan okutsun.</p>
            </div>
          )}

          {tab === 'scan' && status !== 'no-key' && <QrScanner onResult={handleScan} busy={busy} />}

          {tab === 'number' && (
            <div className="space-y-3">
              {safety ? (
                <>
                  <p className="text-xs leading-relaxed text-[#8696a0]">
                    Bu numara iki telefonda da aynı olmalıdır. Telefonla konuşarak veya yan yana karşılaştırın.
                  </p>
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#202c33] p-3 font-mono text-sm text-[#e9edef] text-center">
                    {safety.map((g, i) => (
                      <span key={i}>{g}</span>
                    ))}
                  </div>
                  {status !== 'verified' && (
                    <button
                      onClick={async () => {
                        try {
                          await onVerifyBySafetyNumber(contact.email);
                          setSuccess('Güvenlik numarasıyla doğrulandı.');
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      className="w-full rounded-lg bg-[#00a884] py-2.5 text-xs font-semibold text-[#111b21] cursor-pointer"
                    >
                      Numaralar aynı, doğrulandı olarak işaretle
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#8696a0]">Karşı tarafın anahtarı henüz yok.</p>
              )}
            </div>
          )}

          {status === 'verified' && (
            <button
              onClick={() => onUnverify(contact.email)}
              className="w-full pt-2 text-center text-[11px] text-[#8696a0] hover:text-red-300 cursor-pointer"
            >
              Doğrulamayı kaldır
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm(`${contact.name} sohbet listenizden kaldırılsın mı? Mesaj geçmişi bu cihazda kalır.`)) {
                onRemoveContact(contact.email);
                onClose();
              }
            }}
            className="flex w-full items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-[#8696a0] hover:text-red-300 cursor-pointer"
          >
            <UserMinus className="h-3.5 w-3.5" /> Kişiyi listeden kaldır
          </button>
        </div>
      </div>
    </div>
  );
}
