// napisen - Mesaj Balonu (Metin, Ses ve Görsel Desteği)
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Copy, Forward, ShieldOff } from 'lucide-react';
import { Play, Pause, Check, CheckCheck, Lock, Mic, FileWarning, Clock, AlertCircle, RotateCw, ShieldQuestion } from 'lucide-react';

export default function MessageBubble({ message, onImageClick, onRetry, onMediaLoad, onCopy, onForward }) {
  // Karşı taraf kopyalama/iletmeyi kapattıysa bu mesaj korumalıdır
  const protectedIncoming = !message.isOutgoing && message.protect;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);
  const canCopy = !protectedIncoming && (!message.type || message.type === 'text');
  const canForward = !protectedIncoming && message.type !== 'undecryptable' && (message.type === 'text' || message.mediaBlob);

  const isOutgoing = message.isOutgoing;
  const [audioUrl, setAudioUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef(null);

  // Blob URL oluşturma ve temizleme
  useEffect(() => {
    let url = null;
    if (message.type === 'audio' && message.mediaBlob) {
      url = URL.createObjectURL(message.mediaBlob);
      setAudioUrl(url);
    } else if (message.type === 'image' && message.mediaBlob) {
      url = URL.createObjectURL(message.mediaBlob);
      setImageUrl(url);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [message.mediaBlob, message.type]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Ses oynatılamadı:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const raw = audioRef.current.duration;
    const duration = Number.isFinite(raw) && raw > 0 ? raw : message.duration || 1;
    setAudioCurrentTime(current);
    setAudioProgress((current / duration) * 100);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
    setAudioCurrentTime(0);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatSeconds = (sec) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className={`flex w-full ${isOutgoing ? 'justify-end' : 'justify-start'} my-1 px-4`}>
      <div
        className={`group relative max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutgoing
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
        } ${protectedIncoming ? 'select-none' : 'select-text'}`}
        // Korumalı mesajda kopyalama ve sağ tık / uzun basma menüsü kapalı
        onCopy={protectedIncoming ? (e) => e.preventDefault() : undefined}
        onContextMenu={(e) => {
          if (message.type === 'undecryptable') return;
          e.preventDefault();
          setMenuOpen(true);
        }}
      >
        {/* Mesaj menüsü (masaüstünde üzerine gelince, mobilde uzun basınca) */}
        {message.type !== 'undecryptable' && (
          <div ref={menuRef} className="absolute right-1 top-1 z-10">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mesaj menüsü"
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/80 transition cursor-pointer ${
                menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
              }`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className={`absolute top-7 z-20 w-56 overflow-hidden rounded-xl border border-[#2a3942] bg-[#233138] py-1 text-xs shadow-xl ${isOutgoing ? 'right-0' : 'left-0'}`}>
                {protectedIncoming ? (
                  <p className="flex items-start gap-2 px-3 py-2 text-[#8696a0]">
                    <ShieldOff className="h-4 w-4 shrink-0" /> Gönderen bu mesajın kopyalanmasına ve iletilmesine izin
                    vermiyor.
                  </p>
                ) : (
                  <>
                    {canCopy && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onCopy?.(message);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#e9edef] hover:bg-[#2a3942] cursor-pointer"
                      >
                        <Copy className="h-4 w-4" /> Kopyala
                      </button>
                    )}
                    {canForward && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onForward?.(message);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#e9edef] hover:bg-[#2a3942] cursor-pointer"
                      >
                        <Forward className="h-4 w-4" /> İlet
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {message.forwarded && (
          <p className="mb-1 flex items-center gap-1 text-[10px] italic text-[#8696a0]">
            <Forward className="h-3 w-3" /> İletildi
          </p>
        )}

        {/* SESLİ MESAJ GÖRÜNÜMÜ */}
        {message.type === 'audio' && (
          <div className="flex items-center gap-3 py-1 pr-1 min-w-[220px]">
            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnded}
                preload="metadata"
              />
            )}
            <button
              onClick={toggleAudio}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] hover:scale-105 active:scale-95 transition shadow cursor-pointer"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>

            {/* İlerleme Çubuğu ve Dalga Görünümü */}
            <div className="flex flex-1 flex-col justify-center gap-1.5">
              <div className="relative h-1.5 w-full rounded-full bg-[#ffffff]/20 overflow-hidden">
                <div
                  className="h-full bg-[#00a884] transition-all duration-100"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8696a0] font-mono">
                <span>{isPlaying ? formatSeconds(audioCurrentTime) : formatSeconds(message.duration)}</span>
                <span className="flex items-center gap-1">
                  <Mic className="h-2.5 w-2.5 text-[#00a884]" />
                  Ses Kaydı
                </span>
              </div>
            </div>
          </div>
        )}

        {/* FOTOĞRAF / GÖRSEL GÖRÜNÜMÜ */}
        {message.type === 'image' && (
          <div className="mb-1 overflow-hidden rounded-xl">
            {imageUrl ? (
              <img
                onLoad={onMediaLoad}
                src={imageUrl}
                alt="Şifreli Görsel"
                onClick={() => onImageClick && onImageClick(message.mediaBlob, message.mimeType, protectedIncoming)}
                draggable={!protectedIncoming}
                className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
              />
            ) : (
              <div className="flex h-48 w-64 items-center justify-center rounded-xl bg-black/20 text-xs text-[#8696a0]">
                Görsel yükleniyor...
              </div>
            )}
          </div>
        )}

        {/* ÇÖZÜLEMEYEN MESAJ */}
        {message.type === 'undecryptable' && (
          <p className="flex items-start gap-1.5 text-xs italic text-red-200 pr-2">
            <FileWarning className="h-4 w-4 shrink-0" />
            <span>{message.text || 'Bu mesaj çözülemedi.'}</span>
          </p>
        )}

        {message.keyMismatch && (
          <p className="mb-1 flex items-center gap-1 text-[10px] text-amber-300">
            <ShieldQuestion className="h-3 w-3" /> Kayıtlı olandan farklı bir anahtarla geldi
          </p>
        )}

        {/* DÜZ METİN GÖRÜNÜMÜ */}
        {(!message.type || message.type === 'text') && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pr-2">
            {message.text}
          </p>
        )}

        {/* ALT BİLGİ: SAAT, E2EE KİLİDİ VE TİKLER */}
        <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] mt-0.5 select-none">
          {message.protect && (
            <ShieldOff
              className="h-2.5 w-2.5 text-amber-300"
              aria-label={isOutgoing ? 'Kopyalanamaz / iletilemez olarak gönderildi' : 'Kopyalanamaz / iletilemez'}
            />
          )}
          <Lock className="h-2.5 w-2.5 text-[#00a884]" aria-label="Uçtan uca şifreli" />
          <span>{formatTime(message.timestamp)}</span>

          {/* Giden mesajlarda iletim durumu (tikler) */}
          {isOutgoing && (
            <span className="ml-0.5">
              {message.status === 'delivered' ? (
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="Teslim edildi" />
              ) : message.status === 'sent' ? (
                <Check className="h-3.5 w-3.5 text-[#8696a0]" aria-label="Gönderildi" />
              ) : message.status === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-400" aria-label="Gönderilemedi" />
              ) : (
                <span className="flex items-center gap-0.5">
                  {typeof message.progress === 'number' && (
                    <span className="font-mono text-[10px] text-[#8696a0]">%{message.progress}</span>
                  )}
                  <Clock className="h-3 w-3 text-[#8696a0]" aria-label="Gönderiliyor" />
                </span>
              )}
            </span>
          )}
        </div>

        {isOutgoing && message.status === 'failed' && (
          <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-red-950/50 px-2 py-1 text-[10px] text-red-200">
            <span className="truncate">{message.error || 'Gönderilemedi'}</span>
            {onRetry && (message.type === 'text' || message.mediaBlob) && (
              <button
                onClick={() => onRetry(message)}
                className="flex shrink-0 items-center gap-1 font-semibold text-red-100 hover:underline cursor-pointer"
              >
                <RotateCw className="h-3 w-3" /> Tekrar dene
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

