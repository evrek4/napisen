// napisen - Cihaz kurulumu: yeni anahtar oluşturma veya eski cihazdan taşıma
import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Smartphone, AlertTriangle, Loader2, LogOut } from 'lucide-react';
import QrCode from './QrCode';
import { encodeTransferCode } from '../services/crypto';

export default function SetupScreen({ me, identityState, onLogout }) {
  const { status, publishedKey, createNewIdentity, startReceivingTransfer } = identityState;
  const hasOtherDevice = Boolean(publishedKey);
  const [mode, setMode] = useState(hasOtherDevice ? 'choose' : 'creating');
  const [transferCode, setTransferCode] = useState('');
  const [error, setError] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const unsubRef = useRef(null);
  const creatingRef = useRef(false);

  // Hiç anahtarı olmayan hesap: doğrudan oluştur (StrictMode'da iki kez çalışmasın)
  useEffect(() => {
    if (mode !== 'creating' || creatingRef.current) return;
    creatingRef.current = true;
    createNewIdentity().catch((err) => {
      console.error(err);
      setError('Anahtar oluşturulamadı: ' + (err.message || err));
      creatingRef.current = false;
      setMode('choose');
    });
  }, [mode, createNewIdentity]);

  useEffect(() => () => unsubRef.current?.(), []);

  const beginTransfer = async () => {
    setError('');
    setMode('transfer');
    try {
      unsubRef.current = await startReceivingTransfer(
        (ephPub) => setTransferCode(encodeTransferCode(me.email, ephPub)),
        () => {},
        (msg) => setError(msg)
      );
    } catch (err) {
      setError('Taşıma başlatılamadı: ' + (err.message || err));
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0b141a] p-4 text-[#e9edef] overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-[#111b21] p-6 shadow-2xl border border-[#202c33] space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-bold">Bu cihazı hazırlayalım</h1>
          <p className="mt-1 text-xs text-[#8696a0]">{me.email}</p>
        </div>

        {status === 'stale' && (
          <div className="flex gap-2 rounded-xl bg-amber-950/50 p-3 text-xs text-amber-200 border border-amber-800/40">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Bu hesap için başka bir cihazda yeni bir anahtar oluşturulmuş. Bu cihazdaki eski anahtar artık geçerli
              değil.
            </span>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-950/60 p-3 text-xs text-red-200 border border-red-800/60">{error}</p>}

        {mode === 'creating' && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#8696a0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Şifreleme anahtarınız oluşturuluyor...
          </div>
        )}

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={beginTransfer}
              className="w-full flex items-start gap-3 rounded-xl bg-[#00a884]/10 p-4 text-left border border-[#00a884]/40 hover:bg-[#00a884]/20 transition cursor-pointer"
            >
              <Smartphone className="h-5 w-5 text-[#00a884] shrink-0 mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Eski cihazımdan taşı (önerilen)</span>
                <span className="block text-xs text-[#8696a0] mt-1">
                  Anahtarınız ve doğruladığınız kişiler bu cihaza şifreli olarak aktarılır. Kişilerinizin yeniden
                  doğrulama yapması gerekmez.
                </span>
              </span>
            </button>

            {!confirmNew ? (
              <button
                onClick={() => setConfirmNew(true)}
                className="w-full flex items-start gap-3 rounded-xl bg-[#182229] p-4 text-left border border-[#2a3942] hover:bg-[#202c33] transition cursor-pointer"
              >
                <KeyRound className="h-5 w-5 text-[#8696a0] shrink-0 mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">Yeni anahtar oluştur</span>
                  <span className="block text-xs text-[#8696a0] mt-1">Eski cihaza erişiminiz yoksa.</span>
                </span>
              </button>
            ) : (
              <div className="rounded-xl bg-red-950/40 p-4 text-xs text-red-100 border border-red-800/50 space-y-3">
                <p>
                  Yeni anahtar oluşturursanız: diğer cihazdaki anahtar geçersiz olur, sunucuda saklanan eski mesajlar
                  okunamaz ve <strong>tüm kişilerinizin sizi yeniden QR ile doğrulaması gerekir.</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmNew(false)}
                    className="flex-1 rounded-lg bg-[#202c33] py-2 font-semibold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => setMode('creating')}
                    className="flex-1 rounded-lg bg-red-600 py-2 font-semibold text-white cursor-pointer"
                  >
                    Yine de oluştur
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'transfer' && (
          <div className="space-y-3 text-center">
            <p className="text-xs text-[#8696a0] leading-relaxed">
              Eski cihazınızda <strong className="text-[#e9edef]">Ayarlar → Güvenlik → Yeni cihaza taşı</strong>{' '}
              bölümünü açıp bu kodu okutun.
            </p>
            {transferCode ? (
              <>
                <QrCode value={transferCode} />
                <details className="text-left">
                  <summary className="text-[11px] text-[#8696a0] cursor-pointer">Kamera yoksa: kodu kopyala</summary>
                  <textarea
                    readOnly
                    value={transferCode}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 w-full rounded-lg bg-[#202c33] p-2 text-[10px] font-mono text-[#e9edef]"
                    rows={3}
                  />
                </details>
                <div className="flex items-center justify-center gap-2 text-xs text-[#8696a0]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Eski cihaz bekleniyor (10 dk geçerli)
                </div>
              </>
            ) : (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#8696a0]" />
            )}
            <button
              onClick={() => {
                unsubRef.current?.();
                setMode('choose');
              }}
              className="text-xs text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
            >
              ← Geri
            </button>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-1.5 pt-2 text-xs text-[#8696a0] hover:text-red-300 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" /> Çıkış yap
        </button>
      </div>
    </div>
  );
}
