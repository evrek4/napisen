// napisen - Medya hazırlama (görsel sıkıştırma, boyut sınırları)

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // şifreleme öncesi en fazla 20 MB
export const MAX_AUDIO_SECONDS = 5 * 60;
const MAX_IMAGE_DIMENSION = 1920;

// Büyük fotoğrafları gönderimden önce küçültür (EXIF/konum bilgisi de böylece temizlenir)
export async function prepareImage(file) {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > MAX_MEDIA_BYTES) throw new Error('Dosya çok büyük (en fazla 20 MB).');
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Bu görsel biçimi açılamadı.');
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Görsel işlenemedi.');
  if (blob.size > MAX_MEDIA_BYTES) throw new Error('Görsel çok büyük.');
  return blob;
}
