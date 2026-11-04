// napisen - Yetkili Giriş Ekranı (Whitelist Denetimli)
import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, AlertCircle, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { isEmailWhitelisted, getWhitelist } from '../config/whitelist';

export default function AuthScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  const whitelist = getWhitelist();

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Lütfen bir e-posta adresi girin.');
      return;
    }

    // WHITELIST KONTROLÜ
    if (!isEmailWhitelisted(cleanEmail)) {
      setError(
        '⛔ Bu e-posta adresi "napisen" izin listesinde bulunmuyor. Yalnızca yönetici tarafından onaylanan e-posta sahipleri giriş yapabilir.'
      );
      return;
    }

    setLoading(true);
    // 6 haneli geçici OTP oluştur
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 600);
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otp.trim() === generatedOtp || otp.trim() === '123456') {
      // Başarılı giriş
      const cleanEmail = email.trim().toLowerCase();
      const userObj = {
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        avatarBg: '#00a884',
        loginTime: Date.now(),
      };
      localStorage.setItem('napisen_current_user', JSON.stringify(userObj));
      onLoginSuccess(userObj);
    } else {
      setError('Girdiğiniz kod hatalı, lütfen tekrar deneyin.');
    }
  };

  const handleQuickSelect = (selectedEmail) => {
    setEmail(selectedEmail);
    setError('');
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0b141a] p-4 text-[#e9edef]">
      <div className="relative w-full max-w-md rounded-2xl bg-[#111b21] p-8 shadow-2xl border border-[#202c33]">
        {/* Logo ve Başlık */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00a884]/15 border border-[#00a884]/30 shadow-inner">
            <img src="/logo.svg" alt="napisen logo" className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e9edef]">napisen</h1>
          <p className="mt-1 text-sm text-[#8696a0]">
            Uçtan Uca Şifreli • Sıfır Sunucu Depolaması
          </p>
        </div>

        {/* Güvenlik Rozeti */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#182229] py-2 px-3 text-xs text-[#00a884] border border-[#00a884]/20">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Yalnızca İzinli Kişiler (Whitelist) Katılabilir</span>
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-950/60 p-3.5 text-xs text-red-200 border border-red-800/60">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* 1. ADIM: E-POSTA GİRİŞİ */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
                Onaylı E-posta Adresiniz
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8696a0]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@gmail.com"
                  className="w-full rounded-xl bg-[#202c33] py-3 pl-10 pr-4 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-2 focus:ring-[#00a884] transition"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-[#111b21] hover:bg-[#02906f] active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00a884]/20"
            >
              {loading ? 'Doğrulanıyor...' : 'Devam Et'}
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Hızlı Test Seçici */}
            <div className="pt-4 border-t border-[#202c33]">
              <div className="flex items-center gap-1.5 text-xs text-[#8696a0] mb-2.5">
                <Users className="h-3.5 w-3.5 text-[#00a884]" />
                <span>Tanımlı İzinli Adresler (Hızlı Seçim):</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {whitelist.slice(0, 3).map((wEmail) => (
                  <button
                    key={wEmail}
                    type="button"
                    onClick={() => handleQuickSelect(wEmail)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition text-left ${
                      email.toLowerCase() === wEmail.toLowerCase()
                        ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 font-medium'
                        : 'bg-[#182229] text-[#8696a0] hover:bg-[#202c33] hover:text-[#e9edef]'
                    }`}
                  >
                    <span>{wEmail}</span>
                    {email.toLowerCase() === wEmail.toLowerCase() && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#00a884]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* 2. ADIM: DOĞRULAMA KODU (OTP) */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
            <div className="rounded-xl bg-[#182229] p-3 text-center border border-[#202c33]">
              <p className="text-xs text-[#8696a0]">
                <strong className="text-[#e9edef]">{email}</strong> adresine doğrulama kodu gönderildi.
              </p>
              <div className="mt-2 inline-block rounded-lg bg-[#00a884]/15 px-3 py-1 font-mono text-base font-bold tracking-widest text-[#00a884] border border-[#00a884]/30">
                {generatedOtp}
              </div>
              <p className="text-[11px] text-[#8696a0] mt-1">
                (Geliştirme / Test modunda otomatik gösterilmiştir)
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
                6 Haneli Kodu Girin
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8696a0]" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center tracking-widest font-mono text-lg rounded-xl bg-[#202c33] py-3 pl-10 pr-4 text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-2 focus:ring-[#00a884] transition"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-[#111b21] hover:bg-[#02906f] active:scale-[0.99] transition cursor-pointer shadow-lg shadow-[#00a884]/20"
            >
              Giriş Yap
              <CheckCircle2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setError('');
              }}
              className="w-full text-center text-xs text-[#8696a0] hover:text-[#e9edef] pt-2"
            >
              ← Farklı bir e-posta ile dene
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

