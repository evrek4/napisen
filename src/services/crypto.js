// napisen - Uçtan Uca Şifreleme (E2EE) Modülü
//
// Model:
// - Her cihaz ilk kurulumda kendi ECDH P-256 anahtar çiftini üretir. Özel anahtar cihazdan çıkmaz
//   (yalnızca kullanıcı kendi yeni cihazına şifreli olarak taşıyabilir).
// - Açık anahtar Firestore'da yayınlanır; ancak gönderim yapılabilmesi için karşı tarafın anahtarı
//   yüz yüze QR okutarak (veya güvenlik numarası karşılaştırılarak) DOĞRULANMIŞ olmalıdır.
// - İki kişi arasındaki sohbet anahtarı: ECDH(benim özel, onun açık) -> HKDF-SHA256 -> AES-GCM-256.
// - Her şifreleme benzersiz 12 baytlık IV ve mesaja bağlı ek doğrulama verisi (AAD) kullanır;
//   böylece bir mesajın şifreli içeriği başka bir mesajın yerine konamaz.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

// ---------- Base64 yardımcıları ----------
export function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const toB64Url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4);
};

export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

// ---------- Kimlik anahtarları ----------
// Özel anahtar "extractable" üretilir; yalnızca şifreli cihaz taşıma işleminde dışa aktarılır.
export async function generateIdentityKeyPair() {
  return subtle.generateKey(ECDH, true, ['deriveBits']);
}

export async function exportPublicKey(publicKey) {
  return bytesToBase64(await subtle.exportKey('raw', publicKey));
}

export async function importPublicKey(b64) {
  const raw = base64ToBytes(b64);
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('Geçersiz açık anahtar.');
  }
  return subtle.importKey('raw', raw, ECDH, true, []);
}

export async function exportPrivateKeyJwk(privateKey) {
  return subtle.exportKey('jwk', privateKey);
}

export async function importPrivateKeyJwk(jwk) {
  return subtle.importKey('jwk', jwk, ECDH, true, ['deriveBits']);
}

async function hkdfAesKey(sharedBits, salt, info) {
  const base = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// İki kullanıcı arasındaki sohbet anahtarı (her iki tarafta da aynı sonucu verir)
export async function deriveConversationKey(myPrivateKey, theirPublicKeyB64, emailA, emailB) {
  const theirPublic = await importPublicKey(theirPublicKeyB64);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: theirPublic }, myPrivateKey, 256);
  const salt = [normalizeEmail(emailA), normalizeEmail(emailB)].sort().join('\n');
  return hkdfAesKey(bits, salt, 'napisen/v1/conversation');
}

// ---------- Simetrik şifreleme ----------
export async function encryptBytes(key, data, aad) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    data
  );
  return { iv: bytesToBase64(iv), data: new Uint8Array(ct) };
}

export async function decryptBytes(key, ivB64, data, aad) {
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64), additionalData: enc.encode(aad) },
    key,
    data
  );
  return new Uint8Array(pt);
}

export async function encryptJSON(key, obj, aad) {
  const { iv, data } = await encryptBytes(key, enc.encode(JSON.stringify(obj)), aad);
  return { iv, ct: bytesToBase64(data) };
}

export async function decryptJSON(key, pkg, aad) {
  const pt = await decryptBytes(key, pkg.iv, base64ToBytes(pkg.ct), aad);
  return JSON.parse(dec.decode(pt));
}

// ---------- Güvenlik numarası ve parmak izi ----------
// İki tarafta da aynı çıkan 60 haneli numara (12 grup x 5 hane). Telefonla veya yüz yüze karşılaştırılır.
export async function computeSafetyNumber(emailA, pubA, emailB, pubB) {
  const parts = [
    [normalizeEmail(emailA), pubA],
    [normalizeEmail(emailB), pubB],
  ].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const input = enc.encode(`napisen-safety-v1|${parts[0][0]}|${parts[0][1]}|${parts[1][0]}|${parts[1][1]}`);
  const hash = new Uint8Array(await subtle.digest('SHA-512', input));
  const groups = [];
  for (let i = 0; i < 12; i++) {
    const o = i * 5;
    const n =
      (hash[o] * 2 ** 32 + hash[o + 1] * 2 ** 24 + hash[o + 2] * 2 ** 16 + hash[o + 3] * 2 ** 8 + hash[o + 4]) %
      100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups;
}

export async function publicKeyFingerprint(pubB64) {
  const hash = new Uint8Array(await subtle.digest('SHA-256', base64ToBytes(pubB64)));
  return Array.from(hash.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .match(/.{4}/g)
    .join(' ');
}

// ---------- QR kod içerikleri ----------
// Kişi doğrulama kodu: napisen:v2:<kişi kodu>:<email>:<açık anahtar (base64url)>
// (eski napisen:v1:<email>:<anahtar> biçimi de okunur)
export function encodeVerifyCode(email, pubB64, code) {
  if (code) return `napisen:v2:${code}:${normalizeEmail(email)}:${toB64Url(pubB64)}`;
  return `napisen:v1:${normalizeEmail(email)}:${toB64Url(pubB64)}`;
}

export function decodeVerifyCode(text) {
  const t = (text || '').trim();
  const v2 = /^napisen:v2:([2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}):([^:\s]+@[^:\s]+):([A-Za-z0-9_-]+)$/.exec(t);
  if (v2) return { code: v2[1], email: normalizeEmail(v2[2]), publicKey: fromB64Url(v2[3]) };
  const m = /^napisen:v1:([^:\s]+@[^:\s]+):([A-Za-z0-9_-]+)$/.exec(t);
  if (!m) return null;
  return { code: null, email: normalizeEmail(m[1]), publicKey: fromB64Url(m[2]) };
}

// Cihaz taşıma kodu: napisen-transfer:v1:<email>:<geçici açık anahtar>
export function encodeTransferCode(email, ephPubB64) {
  return `napisen-transfer:v1:${normalizeEmail(email)}:${toB64Url(ephPubB64)}`;
}

export function decodeTransferCode(text) {
  const m = /^napisen-transfer:v1:([^:\s]+@[^:\s]+):([A-Za-z0-9_-]+)$/.exec((text || '').trim());
  if (!m) return null;
  return { email: normalizeEmail(m[1]), ephPub: fromB64Url(m[2]) };
}

// ---------- Cihaz taşıma (eski cihaz -> yeni cihaz) ----------
// Yeni cihaz geçici bir anahtar üretip QR gösterir; eski cihaz okutur, kimlik anahtarını
// bu geçici anahtara şifreler. Sunucu yalnızca şifreli paketi görür.
async function transferKey(myEphPrivate, theirEphPubB64, email) {
  const theirPub = await importPublicKey(theirEphPubB64);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: theirPub }, myEphPrivate, 256);
  return hkdfAesKey(bits, normalizeEmail(email), 'napisen/v1/device-transfer');
}

export async function sealTransfer(email, newDeviceEphPubB64, secretObj) {
  const eph = await subtle.generateKey(ECDH, true, ['deriveBits']);
  const key = await transferKey(eph.privateKey, newDeviceEphPubB64, email);
  const pkg = await encryptJSON(key, secretObj, `transfer|${normalizeEmail(email)}`);
  return { oldPub: await exportPublicKey(eph.publicKey), ...pkg };
}

export async function openTransfer(email, myEphPrivate, sealed) {
  const key = await transferKey(myEphPrivate, sealed.oldPub, email);
  return decryptJSON(key, sealed, `transfer|${normalizeEmail(email)}`);
}

export async function generateEphemeralKeyPair() {
  return subtle.generateKey(ECDH, false, ['deriveBits']);
}
