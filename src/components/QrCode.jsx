// napisen - QR kod görüntüleyici
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ value, size = 240 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch((err) => console.error('QR oluşturulamadı:', err));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className="rounded-xl bg-white p-2 inline-block" style={{ width: size + 16, height: size + 16 }}>
      {src && <img src={src} alt="QR kod" width={size} height={size} />}
    </div>
  );
}
