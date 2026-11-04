// napisen - Firebase ve Geçici İletim Kuyruğu Servisi (Burn-after-Delivery & Bulut Seçeneği)
//
// 1. "Sunucuda Sakla" KAPALI ise: Mesaj alıcıya teslim edildiği an Firestore'dan kalıcı olarak SİLİNİR (deleteDoc).
// 2. "Sunucuda Sakla" AÇIK ise: Şifreli mesaj sunucuda tutulur, silinmez; yalnızca teslim edildi olarak işaretlenir.

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { getPreferences } from '../config/preferences';

const FIREBASE_CONFIG_KEY = 'napisen_firebase_config';

export function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Firebase config hatası:', e);
  }

  return {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || '',
  };
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
}

export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId);
}

let firestoreInstance = null;

export function initFirebase() {
  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  } catch (error) {
    console.error('Firebase başlatılamadı:', error);
    return null;
  }
}

// Sekmeler/Pencereler arası anlık haberleşme köprüsü
const localBus = new BroadcastChannel('napisen_mesh_bus');

// Şifreli paketi iletme
export async function sendEncryptedToQueue({ from, to, payload, type, keepOnServer = false }) {
  const messagePackage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    payload,
    type,
    keepOnServer,
    createdAt: Date.now(),
  };

  const firestore = initFirebase();
  if (firestore) {
    try {
      const docRef = await addDoc(collection(firestore, 'temp_queue'), messagePackage);
      messagePackage.firebaseDocId = docRef.id;
    } catch (err) {
      console.warn('Firebase geçici kuyruğa yazılamadı, yerel köprü devrede:', err);
    }
  }

  localBus.postMessage({
    action: 'NEW_ENCRYPTED_MESSAGE',
    data: messagePackage,
  });

  return messagePackage;
}

// Gelen mesajları dinleme (Kullanıcı tercihine göre silme veya sunucuda saklama)
export function listenForIncomingQueue(currentUserEmail, onMessageReceived) {
  const userEmail = currentUserEmail.toLowerCase();
  let unsubFirestore = null;

  const firestore = initFirebase();
  if (firestore) {
    try {
      const q = query(collection(firestore, 'temp_queue'), where('to', '==', userEmail));
      unsubFirestore = onSnapshot(q, async (snapshot) => {
        for (const docChange of snapshot.docChanges()) {
          if (docChange.type === 'added') {
            const data = docChange.doc.data();
            const docId = docChange.doc.id;

            // 1. Alıcıya teslim et
            await onMessageReceived(data);

            const prefs = getPreferences();
            const shouldKeepOnServer = data.keepOnServer || prefs.serverStorageEnabled;

            if (shouldKeepOnServer) {
              // SUNUCUDA SAKLA AÇIK: Silme, yalnızca teslim edildi olarak güncelle
              try {
                await updateDoc(doc(firestore, 'temp_queue', docId), { status: 'delivered' });
                console.log(`[E2EE] Mesaj sunucuda saklandı: ${docId}`);
              } catch (updErr) {
                console.warn('Durum güncellenemedi:', updErr);
              }
            } else {
              // SUNUCUDA SAKLA KAPALI (VARSAYILAN): Anında kalıcı olarak sil (0 Bayt)
              try {
                await deleteDoc(doc(firestore, 'temp_queue', docId));
                console.log(`[E2EE] Mesaj teslim edildi ve sunucudan kalıcı olarak silindi: ${docId}`);
              } catch (delErr) {
                console.error('Firebase geçici belge silinemedi:', delErr);
              }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Firestore dinleme hatası:', e);
    }
  }

  const handleBusMessage = async (event) => {
    const { action, data } = event.data || {};
    if (action === 'NEW_ENCRYPTED_MESSAGE' && data && data.to === userEmail) {
      await onMessageReceived(data);

      localBus.postMessage({
        action: 'DELIVERY_ACK',
        messageId: data.id,
        from: userEmail,
        to: data.from,
      });
    }
  };

  localBus.addEventListener('message', handleBusMessage);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localBus.removeEventListener('message', handleBusMessage);
  };
}

export function listenForDeliveryAcks(onAckReceived) {
  const handleAck = (event) => {
    const { action, messageId } = event.data || {};
    if (action === 'DELIVERY_ACK' && messageId) {
      onAckReceived(messageId);
    }
  };

  localBus.addEventListener('message', handleAck);
  return () => localBus.removeEventListener('message', handleAck);
}
