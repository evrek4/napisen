// napisen - Mesaj Giriş ve Ses Kayıt Çubuğu
import React, { useState, useRef } from 'react';
import { Send, Mic, Paperclip, Trash2, Check, Smile, Image as ImageIcon } from 'lucide-react';
import { audioRecorder } from '../services/audio';

export default function InputBar({ onSendText, onSendAudio, onSendImage }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const fileInputRef = useRef(null);

  // Metin Gönderme
  const handleSendText = (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    onSendText(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Ses Kaydı Başlatma
  const handleStartRecord = async () => {
    try {
      setRecordSeconds(0);
      setIsRecording(true);
      await audioRecorder.startRecording((sec) => {
        setRecordSeconds(sec);
      });
    } catch (err) {
      alert('Mikrofon erişim izni verilmedi veya desteklenmiyor.');
      setIsRecording(false);
    }
  };

  // Ses Kaydını Bitir ve Gönder
  const handleStopAndSendRecord = async () => {
    try {
      const audioData = await audioRecorder.stopRecording();
      setIsRecording(false);
      setRecordSeconds(0);
      if (audioData && audioData.blob) {
        onSendAudio(audioData.blob, audioData.duration);
      }
    } catch (err) {
      console.error('Ses kaydı durdurulamadı:', err);
      setIsRecording(false);
    }
  };

  // Ses Kaydını İptal Et (Çöpe at)
  const handleCancelRecord = () => {
    audioRecorder.cancelRecording();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // Görsel Seçme
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lütfen yalnızca fotoğraf veya görsel dosyası seçin.');
      return;
    }

    onSendImage(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-[#202c33] px-3 py-2 border-t border-[#222d34] select-none">
      {/* GİZLİ DOSYA SEÇİCİ */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* SES KAYDI CANLI GÖRÜNÜMÜ */}
      {isRecording ? (
        <div className="flex h-12 items-center justify-between gap-3 px-2">
          {/* İptal Butonu */}
          <button
            onClick={handleCancelRecord}
            className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 hover:bg-red-500/20 active:scale-95 transition cursor-pointer"
            title="Kaydı İptal Et"
          >
            <Trash2 className="h-5 w-5" />
          </button>

          {/* Süre ve Dalga Animasyonu */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="font-mono text-sm font-semibold text-[#e9edef]">
              {formatSeconds(recordSeconds)}
            </span>
            <span className="text-xs text-[#8696a0]">Ses kaydediliyor...</span>
          </div>

          {/* Gönder Butonu */}
          <button
            onClick={handleStopAndSendRecord}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] hover:scale-105 active:scale-95 transition shadow cursor-pointer"
            title="Sesli Mesajı Gönder"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        /* NORMAL METİN / MEDYA GİRİŞ ALANI */
        <div className="flex items-center gap-2">
          {/* Görsel Ekle Butonu */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] transition cursor-pointer"
            title="Fotoğraf Gönder"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Metin Giriş Alanı */}
          <div className="flex-1">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir mesaj yazın..."
              className="w-full rounded-xl bg-[#2a3942] py-2.5 px-4 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          </div>

          {/* Gönder veya Ses Kaydet Butonu */}
          {text.trim().length > 0 ? (
            <button
              onClick={handleSendText}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] hover:scale-105 active:scale-95 transition shadow cursor-pointer"
              title="Gönder"
            >
              <Send className="h-5 w-5 ml-0.5" />
            </button>
          ) : (
            <button
              onClick={handleStartRecord}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#374248] active:scale-95 transition cursor-pointer"
              title="Sesli Mesaj Kaydet"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

