// napisen - Mesaj Balonu (Metin, Ses ve Görsel Desteği)
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, CheckCheck, Lock, Download, Mic, FileWarning } from 'lucide-react';

export default function MessageBubble({ message, onImageClick }) {
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
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const duration = audioRef.current.duration || message.duration || 1;
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        className={`relative max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutgoing
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
        }`}
      >
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
                src={imageUrl}
                alt="Şifreli Görsel"
                onClick={() => onImageClick && onImageClick(imageUrl)}
                className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
              />
            ) : (
              <div className="flex h-48 w-64 items-center justify-center rounded-xl bg-black/20 text-xs text-[#8696a0]">
                Görsel yükleniyor...
              </div>
            )}
          </div>
        )}

        {/* DÜZ METİN GÖRÜNÜMÜ */}
        {(!message.type || message.type === 'text') && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pr-2">
            {message.text}
          </p>
        )}

        {/* ALT BİLGİ: SAAT, E2EE KİLİDİ VE TİKLER */}
        <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] mt-0.5 select-none">
          <Lock className="h-2.5 w-2.5 text-[#00a884]" title="Uçtan Uca Şifreli" />
          <span>{formatTime(message.timestamp)}</span>

          {/* Giden mesajlarda iletim durumu (tikler) */}
          {isOutgoing && (
            <span className="ml-0.5">
              {message.status === 'read' ? (
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" title="Okundu" />
              ) : message.status === 'delivered' ? (
                <CheckCheck className="h-3.5 w-3.5 text-[#8696a0]" title="Teslim Edildi" />
              ) : (
                <Check className="h-3.5 w-3.5 text-[#8696a0]" title="Gönderildi" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

