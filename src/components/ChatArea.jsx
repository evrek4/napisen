// napisen - Aktif Sohbet Alanı (Gizlilik Kontrolleri Dahil)
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Shield,
  Server,
  EyeOff,
  Lock,
  HardDrive,
  Cloud,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  MoreVertical,
  Flag,
  Ban,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import { canMessage } from '../hooks/useMessenger';
import InputBar from './InputBar';

export default function ChatArea({
  activeContact,
  messages,
  preferences,
  onTogglePreference,
  onBack,
  onVerify,
  onAcceptKey,
  onBlock,
  onUnblock,
  onReport,
  onTyping,
  onSendText,
  onSendAudio,
  onSendImage,
  onRetry,
  onImageClick,
  onCopyMessage,
  onForwardMessage,
  onError,
}) {
  const messagesEndRef = useRef(null);

  const scrollRef = useRef(null);
  const nearBottomRef = useRef(true);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  };

  // Kullanıcı en alttaysa: görsel yüklenince veya klavye açılıp ekran daralınca en altta kal
  const keepAtBottom = () => {
    if (nearBottomRef.current) scrollToBottom(false);
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    vv.addEventListener('resize', keepAtBottom);
    return () => vv.removeEventListener('resize', keepAtBottom);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

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

  const initial = (activeContact.name || activeContact.email)[0].toUpperCase();
  const keyStatus = activeContact.keyStatus;
  const isBlocked = Boolean(activeContact.blocked);
  const canSend = canMessage(keyStatus) && !isBlocked;

  return (
    <div className="flex flex-1 flex-col h-full bg-[#0b141a] overflow-hidden">
      {/* ÜST SOHBET BAŞLIĞI */}
      <div className="flex h-16 items-center justify-between bg-[#202c33] px-3 md:px-4 py-2 border-b border-[#222d34] shrink-0">
        <div className="flex min-w-0 items-center gap-3">
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
            <button
              onClick={onVerify}
              className={`flex items-center gap-1 text-[11px] font-mono truncate cursor-pointer hover:underline ${
                keyStatus === 'verified' ? 'text-[#00a884]' : keyStatus === 'changed' ? 'text-red-400' : 'text-[#8696a0]'
              }`}
              title="Güvenlik doğrulaması"
            >
              {keyStatus === 'verified' ? (
                <ShieldCheck className="h-3 w-3 shrink-0" />
              ) : keyStatus === 'changed' ? (
                <ShieldAlert className="h-3 w-3 shrink-0" />
              ) : (
                <Lock className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">
                {activeContact.typing ? (
                  <span className="text-[#00a884]">yazıyor...</span>
                ) : keyStatus === 'verified'
                  ? 'Doğrulandı'
                  : keyStatus === 'changed'
                    ? 'Anahtar değişti!'
                    : keyStatus === 'no-key'
                      ? 'Henüz giriş yapmadı'
                      : 'Şifreli · doğrula'}
              </span>
            </button>
          </div>
        </div>

        {/* HIZLI GİZLİLİK BUTONLARI + MENÜ */}
        <div className="flex shrink-0 items-center gap-2">
          {/* 1. Sunucuda Sakla Rozeti */}
          <button
            onClick={() => onTogglePreference('serverStorageEnabled')}
            title={`Sunucuda sakla: ${preferences.serverStorageEnabled ? 'açık' : 'kapalı (teslimde silinir)'} — değiştirmek için dokunun`}
            aria-label="Sunucuda sakla seçeneği"
            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-1 text-[11px] font-medium border transition cursor-pointer ${
              preferences.serverStorageEnabled
                ? 'bg-[#53bdeb]/15 text-[#53bdeb] border-[#53bdeb]/40'
                : 'bg-[#111b21] text-[#8696a0] border-[#2a3942] hover:text-[#e9edef]'
            }`}
          >
            <Cloud className="h-3 w-3" />
            <span className="hidden sm:inline">Sunucuda:</span>
            <span className="hidden sm:inline">{preferences.serverStorageEnabled ? 'Sakla' : 'Sil (0 Bayt)'}</span>
          </button>

          {/* 2. Yazılar Cihazda Tutulmasın Rozeti */}
          <button
            onClick={() => onTogglePreference('dontStoreOnDevice')}
            title={`Hayalet mod: ${preferences.dontStoreOnDevice ? 'açık' : 'kapalı'} — değiştirmek için dokunun`}
            aria-label="Hayalet mod seçeneği"
            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-1 text-[11px] font-medium border transition cursor-pointer ${
              preferences.dontStoreOnDevice
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                : 'bg-[#111b21] text-[#8696a0] border-[#2a3942] hover:text-[#e9edef]'
            }`}
          >
            <EyeOff className="h-3 w-3" />
            <span className="hidden sm:inline">Cihazda:</span>
            <span className="hidden sm:inline">{preferences.dontStoreOnDevice ? 'Tutulmasın (Hayalet)' : 'Saklanıyor'}</span>
          </button>
          <ChatMenu
            blocked={isBlocked}
            onVerify={onVerify}
            onBlock={onBlock}
            onUnblock={onUnblock}
            onReport={onReport}
          />
        </div>
      </div>

      {/* MESAJ AKIŞI ALANI */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
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

          {keyStatus === 'unverified' && (
            <button
              onClick={onVerify}
              className="max-w-md rounded-lg px-3 py-1 text-center text-[11px] text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
            >
              <ShieldQuestion className="inline h-3 w-3 mr-1" />
              İsteğe bağlı: ekstra güvenlik için {activeContact.name} ile QR kodlarınızı okutabilirsiniz.
            </button>
          )}
          {keyStatus === 'changed' && (
            <div className="max-w-md rounded-xl bg-red-950/70 px-3.5 py-2.5 text-center text-xs text-red-100 border border-red-700/60 space-y-2">
              <p>
                <ShieldAlert className="inline h-3.5 w-3.5 mr-1" />
                {activeContact.name} kişisinin güvenlik anahtarı değişti. Yeni bir telefona geçmiş olabilir. Emin
                değilseniz kendisine başka bir yoldan sorun.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={onAcceptKey}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                >
                  Yeni anahtarı kabul et
                </button>
                <button
                  onClick={onVerify}
                  className="rounded-lg bg-[#202c33] px-3 py-1.5 text-[11px] font-semibold text-[#e9edef] cursor-pointer"
                >
                  QR ile doğrula
                </button>
              </div>
            </div>
          )}
          {isBlocked && (
            <div className="max-w-md rounded-xl bg-[#182229] px-3.5 py-2.5 text-center text-xs text-[#e9edef] border border-[#2a3942] space-y-2">
              <p>
                <Ban className="inline h-3.5 w-3.5 mr-1 text-red-400" />
                Bu kişiyi engellediniz. Size mesaj gönderemez, siz de gönderemezsiniz.
              </p>
              <button onClick={onUnblock} className="rounded-lg bg-[#202c33] px-3 py-1.5 text-[11px] font-semibold cursor-pointer">
                Engeli kaldır
              </button>
            </div>
          )}
          {keyStatus === 'no-key' && (
            <div className="max-w-md rounded-xl bg-[#182229] px-3.5 py-2 text-center text-xs text-[#8696a0] border border-[#2a3942]">
              {activeContact.name} henüz uygulamaya giriş yapmadı.
            </div>
          )}

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
          <MessageBubble
            key={msg.id}
            message={msg}
            onImageClick={onImageClick}
            onRetry={onRetry}
            onMediaLoad={keepAtBottom}
            onCopy={onCopyMessage}
            onForward={onForwardMessage}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ALT MESAJ VE SES GİRİŞ ÇUBUĞU */}
      <InputBar
        key={activeContact.email}
        disabled={!canSend}
        disabledReason={
          isBlocked
            ? 'Bu kişiyi engellediniz'
            : keyStatus === 'changed'
            ? 'Göndermek için yukarıdan yeni anahtarı onaylayın'
            : 'Bu kişi henüz uygulamaya giriş yapmadı'
        }
        onError={onError}
        onTyping={onTyping}
        protectOn={preferences.allowCopy === false}
        onToggleProtect={() => onTogglePreference('allowCopy')}
        onSendText={onSendText}
        onSendAudio={onSendAudio}
        onSendImage={onSendImage}
      />
    </div>
  );
}

function ChatMenu({ blocked, onVerify, onBlock, onUnblock, onReport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const item = (Icon, label, fn, danger) => (
    <button
      onClick={() => {
        setOpen(false);
        fn();
      }}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-[#2a3942] cursor-pointer ${
        danger ? 'text-red-300' : 'text-[#e9edef]'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Sohbet menüsü"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#aebac1] hover:bg-[#374248] cursor-pointer"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-[#2a3942] bg-[#233138] shadow-xl">
          {item(ShieldCheck, 'Güvenlik doğrulaması', onVerify)}
          {blocked ? item(Ban, 'Engeli kaldır', onUnblock) : item(Ban, 'Engelle', onBlock, true)}
          {item(Flag, 'Şikâyet et', onReport, true)}
        </div>
      )}
    </div>
  );
}
