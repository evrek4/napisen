// napisen - Giriş / Üyelik Ekranı (Google hesabı)
import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, LogIn } from 'lucide-react';
import { signInWithGoogle, isFirebaseConfigured } from '../services/firebase';
import LegalLinks from './LegalLinks';

export default function AuthScreen({ error: externalError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shownError = error || externalError;

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Giriş hatası:', err);
        setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0b141a] p-4 text-[#e9edef]">
      <div className="relative w-full max-w-md rounded-2xl bg-[#111b21] p-8 shadow-2xl border border-[#202c33]">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00a884]/15 border border-[#00a884]/30 shadow-inner">
            <img src="/logo.svg" alt="napisen logo" className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">napisen</h1>
          <p className="mt-1 text-sm text-[#8696a0]">Uçtan uca şifreli güvenli mesajlaşma</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#182229] py-2 px-3 text-xs text-[#00a884] border border-[#00a884]/20">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Mesajlarınızı bizim dahil kimse okuyamaz</span>
        </div>

        {shownError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-950/60 p-3.5 text-xs text-red-200 border border-red-800/60">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{shownError}</span>
          </div>
        )}

        {!isFirebaseConfigured ? (
          <div className="mt-6 rounded-xl bg-amber-950/50 p-4 text-xs leading-relaxed text-amber-200 border border-amber-800/40">
            Firebase yapılandırılmamış. <code>.env.example</code> dosyasını <code>.env.local</code> olarak
            kopyalayıp Firebase proje bilgilerinizi girin (README'ye bakın).
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-[#111b21] hover:bg-[#02906f] active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00a884]/20"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Google penceresi açılıyor...' : 'Google ile Giriş Yap / Üye Ol'}
          </button>
        )}

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#8696a0]">
          Giriş Google tarafından doğrulanır. Google hesabınızda iki adımlı doğrulamayı açmanız önerilir.
        </p>
        <LegalLinks className="mt-3 text-center" />
      </div>
    </div>
  );
}
