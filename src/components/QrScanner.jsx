// napisen - Kamera ile QR okuyucu (+ elle yapıştırma yedeği)
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ClipboardPaste } from 'lucide-react';

export default function QrScanner({ onResult, busy = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;
    let lastValue = '';
    let lastAt = 0;

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        const result = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        const now = Date.now();
        if (result?.data && (result.data !== lastValue || now - lastAt > 3000)) {
          lastValue = result.data;
          lastAt = now;
          onResultRef.current(result.data);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setCameraError('Kamera açılamadı. İzin verin veya kodu aşağıya yapıştırın.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-3">
      {!cameraError ? (
        <div className="relative overflow-hidden rounded-xl bg-black aspect-square max-w-[280px] mx-auto">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-[#00a884]/80" />
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1 text-[11px] text-white/80">
            <Camera className="h-3 w-3" /> QR kodu çerçeveye getirin
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-950/50 p-3 text-xs text-amber-200 border border-amber-800/40">{cameraError}</p>
      )}
      <canvas ref={canvasRef} className="hidden" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onResult(manual.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="veya kodu buraya yapıştırın"
          className="flex-1 min-w-0 rounded-lg bg-[#202c33] px-3 py-2 text-xs font-mono text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-[#111b21] disabled:opacity-50 cursor-pointer"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Kullan
        </button>
      </form>
    </div>
  );
}
