// napisen - Firebase Servisi (Kimlik Doğrulama + Firestore)
//
// Güvenlik sunucu tarafında, firestore.rules ile sağlanır:
// - Google ile giriş yapıp Kullanım Koşullarını kabul eden herkes üye olabilir; askıya alınan hesaplar erişemez.
// - Kullanıcılar birbirlerini listeleyemez; yalnızca kodunu (veya izin verdiyse e-postasını) bildikleri kişiyle yazışabilir.
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
  deleteUser,
  reauthenticateWithPopup,
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
  addDoc,
  getDocs,
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

// ---------- Hesap durumu: rol ve askı ----------
// { role: 'admin' | 'moderator' | 'user', ban: { reason } | null }
export async function fetchAccountStatus(email) {
  const [banSnap, roleSnap] = await Promise.all([
    getDoc(doc(db, 'bans', email)),
    getDoc(doc(db, 'roles', email)),
  ]);
  const stored = roleSnap.exists() ? roleSnap.data().role : null;
  const role = stored === 'admin' || stored === 'moderator' ? stored : 'user';
  return { role, ban: banSnap.exists() ? banSnap.data() : null };
}

// ---------- Roller (yalnızca admin) ----------
export function subscribeRoles(callback, onError) {
  return onSnapshot(
    collection(db, 'roles'),
    (snap) => callback(snap.docs.map((d) => ({ email: d.id, ...d.data() }))),
    onError
  );
}

// role: 'moderator' | 'admin'
export function grantRole(email, role, grantedBy) {
  return setDoc(doc(db, 'roles', email), { role, grantedBy, grantedAt: serverTimestamp() });
}

export function revokeRole(email) {
  return deleteDoc(doc(db, 'roles', email));
}

// ---------- Askıya alma (moderatör / admin) ----------
export function subscribeBans(callback, onError) {
  return onSnapshot(
    collection(db, 'bans'),
    (snap) => callback(snap.docs.map((d) => ({ email: d.id, ...d.data() }))),
    onError
  );
}

export function banUser(email, reason, by) {
  return setDoc(doc(db, 'bans', email), { reason: (reason || '').slice(0, 500), by, at: serverTimestamp() });
}

export function unbanUser(email) {
  return deleteDoc(doc(db, 'bans', email));
}

// ---------- Engelleme ----------
export function subscribeBlocks(me, callback) {
  return onSnapshot(
    collection(db, 'blocks', me, 'list'),
    (snap) => callback(new Set(snap.docs.map((d) => d.id))),
    (err) => console.warn('Engel listesi dinlenemedi:', err?.code)
  );
}

export function blockUser(me, email) {
  return setDoc(doc(db, 'blocks', me, 'list', email), { at: serverTimestamp() });
}

export function unblockUser(me, email) {
  return deleteDoc(doc(db, 'blocks', me, 'list', email));
}

// ---------- Şikâyetler ----------
export function createReport({ reporter, reported, reason, details, evidence }) {
  return addDoc(collection(db, 'reports'), {
    reporter,
    reported,
    reason,
    details: (details || '').slice(0, 1000),
    evidence: (evidence || []).slice(0, 20),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export function subscribeOpenReports(callback, onError) {
  return onSnapshot(
    query(collection(db, 'reports'), where('status', '==', 'open')),
    (snap) =>
      callback(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      ),
    onError
  );
}

export function resolveReport(id, status, resolution, by) {
  return updateDoc(doc(db, 'reports', id), {
    status,
    resolution: (resolution || '').slice(0, 500),
    resolvedBy: by,
    resolvedAt: serverTimestamp(),
  });
}

// ---------- Hesap silme ----------
// Sunucudaki profil, kişi kodu, taşıma paketi ve bekleyen tüm mesajlar silinir; ardından Google oturumu
// Firebase'den kaldırılır. Son giriş eskiyse Google tekrar giriş ister.
export async function deleteAccount(email, code) {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı.');

  // Google, hesap silmek için yakın zamanda giriş yapılmış olmasını ister. Yeniden girişi EN BAŞTA
  // isteriz: böylece veriler silinip hesap silinemediği yarım bir durum oluşmaz.
  const lastSignIn = Date.parse(user.metadata?.lastSignInTime || '') || 0;
  if (Date.now() - lastSignIn > 4 * 60 * 1000) {
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        throw new Error('Tarayıcı Google doğrulama penceresini engelledi. Açılır pencerelere izin verip tekrar deneyin.');
      }
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        throw new Error('Hesap silme iptal edildi.');
      }
      throw err;
    }
  }

  for (const field of ['to', 'from']) {
    const snap = await getDocs(query(collection(db, 'messages'), where(field, '==', email)));
    for (const d of snap.docs) {
      await deleteMessageFromServer(d.id, d.data().media?.chunks || 0).catch(() => {});
    }
  }
  await deleteDoc(doc(db, 'transfers', email)).catch(() => {});
  await deleteDoc(doc(db, 'users', email)).catch(() => {});
  if (code) await deleteDoc(doc(db, 'codes', code)).catch(() => {});
  await deleteUser(user);
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
// termsAcceptedAt: mevcut Timestamp ya da 'now' (yeni onay)
export async function publishProfile({ email, displayName, publicKey, code, discoverable, termsVersion, termsAcceptedAt }) {
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
    termsVersion,
    termsAcceptedAt: !termsAcceptedAt || termsAcceptedAt === 'now' ? serverTimestamp() : termsAcceptedAt,
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

export async function uploadMessage(id, message, mediaBytes, onProgress) {
  const chunks = mediaBytes ? Math.ceil(mediaBytes.length / CHUNK_SIZE) : 0;
  for (let i = 0; i < chunks; i++) {
    onProgress?.(i / chunks);
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
        if (!s.exists()) throw Object.assign(new Error('Medya parçası eksik.'), { code: 'media-missing' });
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

// ---------- "Yazıyor..." göstergesi ----------
export function setTyping(to, from) {
  return setDoc(doc(db, 'typing', to, 'from', from), { at: serverTimestamp() });
}

export function clearTyping(to, from) {
  return deleteDoc(doc(db, 'typing', to, 'from', from));
}

// callback(gönderen e-postası, yazıyor mu)
export function subscribeTyping(me, callback) {
  return onSnapshot(
    collection(db, 'typing', me, 'from'),
    (snap) => {
      for (const change of snap.docChanges()) {
        callback(change.doc.id, change.type !== 'removed');
      }
    },
    (err) => console.warn('Yazıyor bilgisi dinlenemedi:', err?.code)
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
