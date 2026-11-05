// napisen - Ses Kaydı Servisi

import { MAX_AUDIO_SECONDS } from './media';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

class AudioRecorderService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = null;
    this.timerInterval = null;
  }

  get isActive() {
    return Boolean(this.mediaRecorder && this.mediaRecorder.state !== 'inactive');
  }

  // onTick(saniye), onLimit(): süre sınırına ulaşıldığında çağrılır
  async startRecording(onTick, onLimit) {
    if (this.isActive) this.cancelRecording();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Bu tarayıcı ses kaydını desteklemiyor.');
    }

    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t));
    try {
      this.mediaRecorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
    } catch (err) {
      this._releaseStream();
      throw err;
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };

    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - this.startTime) / 1000);
      onTick?.(seconds);
      if (seconds >= MAX_AUDIO_SECONDS) onLimit?.();
    }, 500);

    this.mediaRecorder.start(250);
    return true;
  }

  stopRecording() {
    return new Promise((resolve) => {
      clearInterval(this.timerInterval);
      const recorder = this.mediaRecorder;
      if (!recorder || recorder.state === 'inactive') {
        this._releaseStream();
        resolve(null);
        return;
      }
      const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type });
        this._releaseStream();
        this.mediaRecorder = null;
        this.audioChunks = [];
        resolve({ blob, duration });
      };
      recorder.stop();
    });
  }

  cancelRecording() {
    clearInterval(this.timerInterval);
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this._releaseStream();
  }

  _releaseStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

export const audioRecorder = new AudioRecorderService();
