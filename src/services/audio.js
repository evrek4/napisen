// napisen - Ses Kaydı ve Oynatma Servisi
// Mikrofon erişimi, ses kaydı, süre ölçümü ve ses dalgası analizi

class AudioRecorderService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = null;
    this.timerInterval = null;
  }

  // Mikrofon izni al ve kayda başla
  async startRecording(onTick) {
    this.audioChunks = [];
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Desteklenen mime type seçimi
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.startTime = Date.now();
      if (onTick) {
        this.timerInterval = setInterval(() => {
          const seconds = Math.floor((Date.now() - this.startTime) / 1000);
          onTick(seconds);
        }, 500);
      }

      this.mediaRecorder.start(100); // 100ms parçalar
      return true;
    } catch (error) {
      console.error('Mikrofon başlatma hatası:', error);
      throw error;
    }
  }

  // Kaydı durdur ve Blob nesnesini döndür
  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      clearInterval(this.timerInterval);
      const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        // Mikrofon akışını kapat
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }

        resolve({
          blob: audioBlob,
          duration: durationSeconds,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  // Kaydı iptal et (göndermeden sil)
  cancelRecording() {
    clearInterval(this.timerInterval);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.audioChunks = [];
  }
}

export const audioRecorder = new AudioRecorderService();

