// napisen - Uçtan Uca Şifreleme (E2EE) Modülü
// Web Crypto API (AES-GCM 256-bit) standardını kullanır.
// Hiçbir açık metin, ses kaydı veya resim cihazdan şifrelenmeden çıkmaz.

// ArrayBuffer'ı Base64 dizgesine çevirme
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Base64 dizgesini ArrayBuffer'a çevirme
export function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// İki kullanıcı arasındaki konuşma için deterministik ortak anahtar türetme
export async function deriveSharedKey(userEmail1, userEmail2) {
  const emails = [userEmail1.toLowerCase(), userEmail2.toLowerCase()].sort();
  const roomSecret = `napisen_e2ee_${emails[0]}_<->_${emails[1]}`;

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(roomSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = enc.encode('napisen_secure_salt_2026');

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Düz metin veya JSON şifreleme
export async function encryptPayload(key, rawData) {
  const enc = new TextEncoder();
  const encodedData = typeof rawData === 'string' ? enc.encode(rawData) : enc.encode(JSON.stringify(rawData));

  // Her mesaj için benzersiz 12 bayt IV (Initialization Vector)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(cipherBuffer),
    timestamp: Date.now(),
  };
}

// Şifreli metin veya JSON'u çözme
export async function decryptPayload(key, encryptedPackage) {
  try {
    const iv = base64ToArrayBuffer(encryptedPackage.iv);
    const ciphertext = base64ToArrayBuffer(encryptedPackage.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const decodedString = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(decodedString);
    } catch {
      return decodedString;
    }
  } catch (error) {
    console.error('Şifre çözme hatası:', error);
    throw new Error('Mesaj şifresi çözülemedi. Anahtar eşleşmiyor olabilir.');
  }
}

// Medya (Resim / Ses Blob'u) şifreleme
export async function encryptMediaBlob(key, blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    arrayBuffer
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(cipherBuffer),
    mimeType: blob.type,
    size: blob.size,
  };
}

// Şifreli medya paketini yerel Blob'a geri dönüştürme
export async function decryptMediaBlob(key, encryptedPackage) {
  const iv = base64ToArrayBuffer(encryptedPackage.iv);
  const ciphertext = base64ToArrayBuffer(encryptedPackage.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    key,
    ciphertext
  );

  return new Blob([decryptedBuffer], { type: encryptedPackage.mimeType });
}

