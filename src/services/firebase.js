// napisen - Firebase Servisi (Kimlik Doğrulama + Firestore)
//
// Güvenlik sunucu tarafında, firestore.rules ile sağlanır:
// - Yalnızca Google ile giriş yapmış ve allowlist/{email} kaydı olan hesaplar erişebilir.
// - Kullanıcılar birbirlerini listeleyemez; yalnızca e-postasını bildikleri kişiyle yazışabilir.
// - Herkes yalnızca kendisine gelen / kendi gönderdiği mesajları okuyabilir.
// - Kimse başkası adına mesaj yazamaz veya başkasının açık anahtarını değiştiremez.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Bytes,
} from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const useEmulators = env.VITE_USE_EMULATORS === 'true';
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (useEmulators) {
    const host = env.VITE_EMULATOR_HOST || window.location.hostname;
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
}

export { auth, db };

// ---------- Kimlik doğrulama ----------
export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  getRedirectResult(auth).catch((err) => console.warn('Yönlendirmeli giriş hatası:', err));
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Açılır pencere engellendiyse (ör. Android PWA) yönlendirmeli girişe geç
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export function logout() {
  return auth ? signOut(auth) : Promise.resolve();
}

// ---------- İzin listesi (sunucu tarafı, kişi başına belge) ----------
// Kullanıcı yalnızca kendi kaydını okuyabilir; tüm listeyi yalnızca yöneticiler görür.

// { allowed: boolean, admin: boolean }
export async function checkAccess(email) {
  const ref = doc(db, 'allowlist', email);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return { allowed: true, admin: snap.data().admin === true };
    // Kural okumaya izin verdi ama kayıt yok: bu yalnızca uygulama sahibi için olur.
    // Sahibin kaydını oluştur ki yönetici listesinde görünsün.
    await setDoc(ref, { admin: true, addedBy: email, addedAt: serverTimestamp() }).catch(() => {});
    return { allowed: true, admin: true };
  } catch (err) {
    if (err?.code === 'permission-denied') return { allowed: false, admin: false };
    throw err;
  }
}

export function subscribeAllowlist(callback, onError) {
  return onSnapshot(
    collection(db, 'allowlist'),
    (snap) => {
      const entries = [];
      snap.forEach((d) => entries.push({ email: d.id, admin: d.data().admin === true }));
      entries.sort((a, b) => a.email.localeCompare(b.email));
      callback(entries);
    },
    (err) => {
      console.warn('İzin listesi dinlenemedi:', err);
      onError?.(err);
    }
  );
}

export function addAllowedEmail(email, addedBy, admin = false) {
  return setDoc(doc(db, 'allowlist', email), { admin, addedBy, addedAt: serverTimestamp() });
}

export function removeAllowedEmail(email) {
  return deleteDoc(doc(db, 'allowlist', email));
}

// ---------- Kişi kodları ve profiller ----------
// codes/{KOD}: kodu bilen herkesin okuyabildiği açık profil (ad + açık anahtar)
// users/{email}: sahibine özel; "e-postayla bulunabilirim" açıksa diğerleri de okuyabilir

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // karışan 0/O, 1/I harfleri yok

export function normalizeCode(input) {
  const raw = (input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (raw.length !== 8 || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(bytes, (b) => CODE_ALPHABET[b % 32]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function fetchMyProfile(email) {
  const snap = await getDoc(doc(db, 'users', email));
  return snap.exists() ? snap.data() : null;
}

// Profili yayınlar. code verilmezse yeni bir kod alır (çakışırsa tekrar dener).
export async function publishProfile({ email, displayName, publicKey, code, discoverable }) {
  const name = (displayName || '').slice(0, 80);
  const publicPart = { email, displayName: name, publicKey, updatedAt: serverTimestamp() };
  let finalCode = code;
  if (finalCode) {
    await setDoc(doc(db, 'codes', finalCode), publicPart);
  } else {
    for (let attempt = 0; attempt < 6 && !finalCode; attempt++) {
      const candidate = randomCode();
      try {
        // Başkasına ait bir kodun üzerine yazmayı kurallar reddeder -> yeni kod dene
        await setDoc(doc(db, 'codes', candidate), publicPart);
        finalCode = candidate;
      } catch (err) {
        if (err?.code !== 'permission-denied') throw err;
      }
    }
    if (!finalCode) throw new Error('Kişi kodu oluşturulamadı.');
  }
  await setDoc(doc(db, 'users', email), {
    ...publicPart,
    code: finalCode,
    discoverable: Boolean(discoverable),
  });
  return finalCode;
}

export async function deleteCode(code) {
  await deleteDoc(doc(db, 'codes', code)).catch(() => {});
}

// Kendi profilini dinle (başka cihazda yeni anahtar oluşturulursa fark etmek için)
export function subscribeMyProfile(email, callback) {
  return onSnapshot(
    doc(db, 'users', email),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => console.warn('Profil dinlenemedi:', err?.code)
  );
}

// Kodla kişi bul: { email, displayName, publicKey } veya null
export async function lookupByCode(code) {
  try {
    const snap = await getDoc(doc(db, 'codes', code));
    return snap.exists() ? { ...snap.data(), code } : null;
  } catch (err) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

// E-postayla kişi bul (yalnızca kişi buna izin verdiyse). Kayıtlı olmayan ile
// izin vermeyen ayırt edilemez; ikisinde de null döner.
export async function lookupByEmail(email) {
  try {
    const snap = await getDoc(doc(db, 'users', email));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

// Bir kişinin açık profilini (anahtar değişikliklerini) kodu üzerinden dinler
export function subscribeCode(code, callback) {
  return onSnapshot(
    doc(db, 'codes', code),
    (snap) => callback(snap.exists() ? { ...snap.data(), code } : null),
    (err) => {
      console.warn('Profil dinlenemedi:', code, err?.code);
      callback(null);
    }
  );
}

// ---------- Mesajlar ----------
// Firestore belge sınırı 1 MiB; medya 512 KB'lık şifreli parçalara bölünür.
export const CHUNK_SIZE = 512 * 1024;

export async function uploadMessage(id, message, mediaBytes) {
  const chunks = mediaBytes ? Math.ceil(mediaBytes.length / CHUNK_SIZE) : 0;
  for (let i = 0; i < chunks; i++) {
    const part = mediaBytes.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await setDoc(doc(db, 'messages', id, 'chunks', String(i)), {
      from: message.from,
      to: message.to,
      data: Bytes.fromUint8Array(part),
    });
  }
  // Ana belge en son yazılır: alıcı onu gördüğünde tüm parçalar hazırdır
  await setDoc(doc(db, 'messages', id), {
    ...message,
    media: message.media ? { ...message.media, chunks } : null,
    status: 'sent',
    createdAt: serverTimestamp(),
  });
}

export async function downloadMediaBytes(id, chunks) {
  const parts = await Promise.all(
    Array.from({ length: chunks }, (_, i) =>
      getDoc(doc(db, 'messages', id, 'chunks', String(i))).then((s) => {
        if (!s.exists()) throw new Error('Medya parçası eksik.');
        return s.data().data.toUint8Array();
      })
    )
  );
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export async function deleteMessageFromServer(id, chunks = 0) {
  for (let i = 0; i < chunks; i++) {
    await deleteDoc(doc(db, 'messages', id, 'chunks', String(i)));
  }
  await deleteDoc(doc(db, 'messages', id));
}

export function markDeliveredOnServer(id) {
  return updateDoc(doc(db, 'messages', id), { status: 'delivered' });
}

// field: 'to' (gelen kutusu) veya 'from' (giden kutusu)
export function subscribeMessages(field, email, onChange, onError) {
  const q = query(collection(db, 'messages'), where(field, '==', email));
  return onSnapshot(
    q,
    (snap) => {
      for (const change of snap.docChanges()) {
        onChange(change.type, change.doc.id, change.doc.data());
      }
    },
    (err) => {
      console.error(`Mesaj dinleme hatası (${field}):`, err);
      onError?.(err);
    }
  );
}

// ---------- Cihaz taşıma ----------
const transferRef = (email) => doc(db, 'transfers', email);

export function writeTransfer(email, sealed) {
  return setDoc(transferRef(email), { ...sealed, createdAt: serverTimestamp() });
}

export function subscribeTransfer(email, callback) {
  return onSnapshot(transferRef(email), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export function deleteTransfer(email) {
  return deleteDoc(transferRef(email)).catch(() => {});
}
