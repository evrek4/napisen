// napisen - Mesaj Giriş ve Ses Kayıt Çubuğu
import React, { useEffect, useRef, useState } from 'react';
import { Send, Mic, Paperclip, Trash2, Lock } from 'lucide-react';
import { audioRecorder } from '../services/audio';
import { prepareImage } from '../services/media';
import { MAX_TEXT_LENGTH } from '../hooks/useMessenger';

export default function InputBar({ disabled, onSendText, onSendAudio, onSendImage, onError }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const fileInputRef = useRef(null);
  const stoppingRef = useRef(false);

  // Bileşen kapanırsa mikrofonu mutlaka serbest bırak
  useEffect(() => () => audioRecorder.cancelRecording(), []);

  const handleSendText = (e) => {
    if (e) e.preventDefault();
    const clean = text.trim();
    if (!clean || disabled) return;
    if (clean.length > MAX_TEXT_LENGTH) {
      onError?.(`Mesaj en fazla ${MAX_TEXT_LENGTH} karakter olabilir.`);
      return;
    }
    onSendText(clean);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleStopAndSendRecord = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const audioData = await audioRecorder.stopRecording();
      if (audioData?.blob?.size) onSendAudio(audioData.blob, audioData.duration);
    } catch (err) {
      console.error('Ses kaydı durdurulamadı:', err);
      onError?.('Ses kaydı tamamlanamadı.');
    } finally {
      stoppingRef.current = false;
      setIsRecording(false);
      setRecordSeconds(0);
    }
  };

  const handleStartRecord = async () => {
    if (disabled) return;
    try {
      setRecordSeconds(0);
      setIsRecording(true);
      await audioRecorder.startRecording(setRecordSeconds, () => handleStopAndSendRecord());
    } catch (err) {
      console.error(err);
      onError?.(
        err?.name === 'NotAllowedError'
          ? 'Mikrofon izni verilmedi.'
          : err?.message || 'Ses kaydı bu cihazda desteklenmiyor.'
      );
      setIsRecording(false);
    }
  };

  const handleCancelRecord = () => {
    audioRecorder.cancelRecording();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Lütfen yalnızca fotoğraf veya görsel dosyası seçin.');
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      onSendImage(prepared);
    } catch (err) {
      onError?.(err.message || 'Görsel hazırlanamadı.');
    } finally {
      setPreparing(false);
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

      {disabled ? (
        <div className="flex h-12 items-center justify-center gap-2 text-xs text-[#8696a0]">
          <Lock className="h-3.5 w-3.5" /> Mesaj göndermek için önce kişiyi doğrulayın
        </div>
      ) : isRecording ? (
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
            disabled={preparing}
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
              placeholder={preparing ? 'Görsel hazırlanıyor...' : 'Bir mesaj yazın...'}
              maxLength={MAX_TEXT_LENGTH}
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

