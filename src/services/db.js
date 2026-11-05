// napisen - Cihaz İçi Yerel Veritabanı (IndexedDB)
// - identity: Bu cihazın kimlik anahtar çifti (hesap başına bir kayıt)
// - trusted:  Kişi anahtarları (ilk görüşte sabitlenir; QR / güvenlik numarası ile "doğrulanmış" işaretlenir)
// - mycontacts: Kullanıcının sohbet ettiği kişiler
// - messages, media, conversations: Mesaj geçmişi (Hayalet Mod kapalıyken)

import { openDB } from 'idb';

const DB_NAME = 'napisen_local_db';
const DB_VERSION = 3;

let dbPromise = null;

export function getLocalDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
        // v1'deki kullanılmayan "contacts" deposu kaldırıldı
        if (db.objectStoreNames.contains('contacts')) {
          db.deleteObjectStore('contacts');
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity', { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains('mycontacts')) {
          // Kullanıcının kendi eklediği kişiler (yalnızca bu cihazda; sunucu kişi listesini bilmez)
          db.createObjectStore('mycontacts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('trusted')) {
          // key: `${owner}|${contact}` (aynı cihazda birden fazla hesap olabilir)
          db.createObjectStore('trusted', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function conversationIdFor(a, b) {
  const emails = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${emails[0]}_${emails[1]}`;
}

// ---------- Kimlik ----------
export async function getIdentity(email) {
  return (await getLocalDB()).get('identity', email);
}

export async function saveIdentity(identity) {
  return (await getLocalDB()).put('identity', identity);
}

export async function deleteIdentity(email) {
  return (await getLocalDB()).delete('identity', email);
}

// ---------- Doğrulanmış kişiler ----------
export async function getTrustedContacts(owner) {
  const all = await (await getLocalDB()).getAll('trusted');
  return all.filter((t) => t.owner === owner);
}

// method: 'tofu' (ilk görüşte sabitlendi, doğrulanmadı) | 'qr' | 'safety-number'
export async function saveTrustedContact(owner, contactEmail, publicKey, method, verified) {
  const record = {
    id: `${owner}|${contactEmail}`,
    owner,
    email: contactEmail,
    publicKey,
    method,
    verified: verified ?? method !== 'tofu',
    verifiedAt: Date.now(),
  };
  await (await getLocalDB()).put('trusted', record);
  return record;
}

// ---------- Kişiler ----------
export async function getMyContacts(owner) {
  const all = await (await getLocalDB()).getAll('mycontacts');
  return all.filter((c) => c.owner === owner);
}

export async function saveMyContact(owner, email, name, code) {
  const record = { id: `${owner}|${email}`, owner, email, name: name || '', code: code || null, addedAt: Date.now() };
  await (await getLocalDB()).put('mycontacts', record);
  return record;
}

export async function removeMyContact(owner, email) {
  return (await getLocalDB()).delete('mycontacts', `${owner}|${email}`);
}


// ---------- Mesajlar ----------
export async function saveMessage(message) {
  // Blob'lar ayrı depoda tutulur; mesaj kaydında yalnızca meta veri bulunur
  // eslint-disable-next-line no-unused-vars
  const { mediaBlob, ...rest } = message;
  return (await getLocalDB()).put('messages', rest);
}

export async function getMessage(id) {
  return (await getLocalDB()).get('messages', id);
}

export async function getMessagesByConversation(conversationId) {
  const db = await getLocalDB();
  const messages = await db.getAllFromIndex('messages', 'conversationId', conversationId);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateMessage(id, changes) {
  const db = await getLocalDB();
  const tx = db.transaction('messages', 'readwrite');
  const msg = await tx.store.get(id);
  if (msg) {
    Object.assign(msg, changes);
    await tx.store.put(msg);
  }
  await tx.done;
  return msg;
}

export async function saveMediaBlob(id, blob) {
  return (await getLocalDB()).put('media', { id, blob, createdAt: Date.now() });
}

export async function getMediaBlob(id) {
  const item = await (await getLocalDB()).get('media', id);
  return item ? item.blob : null;
}

// ---------- Sohbet özetleri (sol liste) ----------
export async function getConversationMetas() {
  return (await getLocalDB()).getAll('conversations');
}

export async function saveConversationMeta(meta) {
  return (await getLocalDB()).put('conversations', meta);
}

// ---------- İstatistik ve temizlik ----------
export async function getStorageStats() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
      quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
    };
  }
  return { usageMB: '0.00', quotaMB: 'N/A' };
}

// Mesaj geçmişini siler; kimlik anahtarı ve doğrulanmış kişiler korunur
export async function clearMessageHistory() {
  const db = await getLocalDB();
  await db.clear('messages');
  await db.clear('media');
  await db.clear('conversations');
}

// Cihazı tamamen sıfırlar (anahtarlar dahil)
export async function wipeDevice() {
  const db = await getLocalDB();
  await clearMessageHistory();
  await db.clear('identity');
  await db.clear('trusted');
  await db.clear('mycontacts');
}

export async function deleteLocalMessage(id) {
  const db = await getLocalDB();
  await db.delete('messages', id);
  await db.delete('media', id);
}
