// napisen - Firebase Servisi (Kimlik Doğrulama + Firestore)
//
// Güvenlik sunucu tarafında, firestore.rules ile sağlanır:
// - Yalnızca Google ile giriş yapmış ve config/allowlist belgesindeki e-postalar erişebilir.
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
  arrayUnion,
  arrayRemove,
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

// ---------- İzin listesi (sunucu tarafı) ----------
const allowlistRef = () => doc(db, 'config', 'allowlist');

// İzinli değilse güvenlik kuralları okumayı reddeder -> null döner
export async function fetchAllowlist() {
  try {
    const snap = await getDoc(allowlistRef());
    if (!snap.exists()) return null;
    const data = snap.data();
    return { emails: data.emails || [], admins: data.admins || [] };
  } catch (err) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

export function subscribeAllowlist(callback) {
  return onSnapshot(
    allowlistRef(),
    (snap) => {
      const data = snap.data() || {};
      callback({ emails: data.emails || [], admins: data.admins || [] });
    },
    (err) => console.warn('İzin listesi dinlenemedi:', err)
  );
}

export function addAllowedEmail(email) {
  return updateDoc(allowlistRef(), { emails: arrayUnion(email) });
}

export function removeAllowedEmail(email) {
  return updateDoc(allowlistRef(), { emails: arrayRemove(email), admins: arrayRemove(email) });
}

// ---------- Kullanıcı profilleri ve açık anahtarlar ----------
export function publishPublicKey(email, displayName, publicKey) {
  return setDoc(doc(db, 'users', email), {
    email,
    displayName: (displayName || '').slice(0, 80),
    publicKey,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchUserProfile(email) {
  const snap = await getDoc(doc(db, 'users', email));
  return snap.exists() ? snap.data() : null;
}

export function subscribeUsers(callback) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const users = {};
      snap.forEach((d) => {
        users[d.id] = d.data();
      });
      callback(users);
    },
    (err) => console.warn('Kullanıcılar dinlenemedi:', err)
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
