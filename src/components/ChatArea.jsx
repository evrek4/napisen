// napisen - Aktif Sohbet Alanı (Gizlilik Kontrolleri Dahil)
import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Shield,
  Server,
  EyeOff,
  Lock,
  HardDrive,
  Cloud,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';

export default function ChatArea({
  activeContact,
  currentUser,
  messages,
  preferences,
  onTogglePreference,
  onBack,
  onSendText,
  onSendAudio,
  onSendImage,
  onImageClick,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!activeContact) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#222e35] p-6 text-center select-none border-b-6 border-[#00a884]">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#111b21] p-4 shadow-xl border border-[#202c33] mb-4">
          <img src="/logo.svg" alt="napisen" className="h-16 w-16 opacity-80" />
        </div>
        <h2 className="text-xl font-bold text-[#e9edef]">napisen Web & Android</h2>
        <p className="mt-2 max-w-sm text-sm text-[#8696a0] leading-relaxed">
          Sohbet etmek için sol taraftan bir kişi seçin. Mesajlarınız ve medyalarınız uçtan uca şifrelidir.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-xl bg-[#111b21] px-3 py-1.5 text-[#00a884] border border-[#00a884]/20">
            <Lock className="h-3.5 w-3.5" />
            <span>AES-256 E2EE</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-[#111b21] px-3 py-1.5 text-[#53bdeb] border border-[#53bdeb]/20">
            <Server className="h-3.5 w-3.5" />
            <span>İsteğe Bağlı Sunucu Saklama</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-[#111b21] px-3 py-1.5 text-purple-400 border border-purple-500/20">
            <EyeOff className="h-3.5 w-3.5" />
            <span>Hayalet Cihaz Modu</span>
          </div>
        </div>
      </div>
    );
  }

  const initial = activeContact.name ? activeContact.name[0].toUpperCase() : activeContact.email[0].toUpperCase();

  return (
    <div className="flex flex-1 flex-col h-full bg-[#0b141a] overflow-hidden select-none">
      {/* ÜST SOHBET BAŞLIĞI */}
      <div className="flex h-16 items-center justify-between bg-[#202c33] px-3 md:px-4 py-2 border-b border-[#222d34] shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobil Geri Butonu */}
          <button
            onClick={onBack}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-full text-[#aebac1] hover:bg-[#374248] active:bg-[#111b21] cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#53bdeb] text-sm font-bold text-[#111b21]">
            {initial}
          </div>

          {/* İsim ve Durum */}
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold text-[#e9edef] truncate">
              {activeContact.name || activeContact.email.split('@')[0]}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#00a884] font-mono">
              <Lock className="h-2.5 w-2.5" />
              <span>{activeContact.email}</span>
            </span>
          </div>
        </div>

        {/* HIZLI GİZLİLİK BUTONLARI (KULLANICININ İSTEDİĞİ İKİ SEÇENEK) */}
        <div className="flex items-center gap-2">
          {/* 1. Sunucuda Sakla Rozeti */}
          <button
            onClick={() => onTogglePreference('serverStorageEnabled')}
            title="Tıkla: Sunucuda Sakla seçeneğini değiştir"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
              preferences.serverStorageEnabled
                ? 'bg-[#53bdeb]/15 text-[#53bdeb] border-[#53bdeb]/40'
                : 'bg-[#111b21] text-[#8696a0] border-[#2a3942] hover:text-[#e9edef]'
            }`}
          >
            <Cloud className="h-3 w-3" />
            <span className="hidden sm:inline">Sunucuda:</span>
            <span>{preferences.serverStorageEnabled ? 'Sakla' : 'Sil (0 Bayt)'}</span>
          </button>

          {/* 2. Yazılar Cihazda Tutulmasın Rozeti */}
          <button
            onClick={() => onTogglePreference('dontStoreOnDevice')}
            title="Tıkla: Yazılar Cihazda Tutulmasın (Hayalet Mod) seçeneğini değiştir"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
              preferences.dontStoreOnDevice
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                : 'bg-[#111b21] text-[#8696a0] border-[#2a3942] hover:text-[#e9edef]'
            }`}
          >
            <EyeOff className="h-3 w-3" />
            <span className="hidden sm:inline">Cihazda:</span>
            <span>{preferences.dontStoreOnDevice ? 'Tutulmasın (Hayalet)' : 'Saklanıyor'}</span>
          </button>
        </div>
      </div>

      {/* MESAJ AKIŞI ALANI */}
      <div
        className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2"
        style={{
          backgroundImage: `radial-gradient(circle at center, #111b21 0%, #0b141a 100%)`,
        }}
      >
        {/* E2EE VE GİZLİLİK DURUM KARTUŞU */}
        <div className="flex flex-col items-center gap-1.5 my-2">
          <div className="max-w-md rounded-xl bg-[#182229]/90 px-3.5 py-2 text-center text-xs text-[#ffd279] shadow-sm border border-[#ffd279]/15 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <p className="leading-snug">
              Mesajlar ve medyalar <strong>uçtan uca şifrelidir</strong> (E2EE).
            </p>
          </div>

          {/* Aktif Mod Uyarısı */}
          {preferences.dontStoreOnDevice && (
            <div className="rounded-lg bg-purple-950/50 px-3 py-1 text-[11px] text-purple-200 border border-purple-800/40 flex items-center gap-1.5">
              <EyeOff className="h-3 w-3 text-purple-400" />
              <span>Hayalet Mod devrede: Bu yazışmalar cihazın hafızasına kaydedilmez.</span>
            </div>
          )}

          {preferences.serverStorageEnabled && (
            <div className="rounded-lg bg-sky-950/50 px-3 py-1 text-[11px] text-sky-200 border border-sky-800/40 flex items-center gap-1.5">
              <Cloud className="h-3 w-3 text-sky-400" />
              <span>Sunucuda Saklama açık: Şifreli yedek sunucuda tutulur.</span>
            </div>
          )}
        </div>

        {/* MESAJ LİSTESİ */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onImageClick={onImageClick} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ALT MESAJ VE SES GİRİŞ ÇUBUĞU */}
      <InputBar
        onSendText={onSendText}
        onSendAudio={onSendAudio}
        onSendImage={onSendImage}
      />
    </div>
  );
}
