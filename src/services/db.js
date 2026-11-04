// napisen - Cihaz İçi Yerel Veritabanı (IndexedDB)
// Tüm mesaj geçmişi, çözülmüş fotoğraflar ve ses kayıtları
// SADECE kullanıcının cihazındaki bu veritabanında saklanır.

import { openDB } from 'idb';

const DB_NAME = 'napisen_local_db';
const DB_VERSION = 1;

let dbPromise = null;

export async function getLocalDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Mesajlar tablosu (Metin, ses ve resimler burada saklanır)
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Kişiler tablosu
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'email' });
        }

        // Medya blob deposu
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Mesaj kaydetme (Cihaz içi)
export async function saveMessage(message) {
  const db = await getLocalDB();
  return db.put('messages', message);
}

// Konuşmaya ait mesajları getirme
export async function getMessagesByConversation(conversationId) {
  const db = await getLocalDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.store.index('conversationId');
  const messages = await index.getAll(conversationId);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

// Mesaj durumunu güncelleme (örn: 'sent' -> 'delivered' -> 'read')
export async function updateMessageStatus(id, status) {
  const db = await getLocalDB();
  const msg = await db.get('messages', id);
  if (msg) {
    msg.status = status;
    await db.put('messages', msg);
  }
}

// Medya Blob'unu kaydetme
export async function saveMediaBlob(id, blob) {
  const db = await getLocalDB();
  return db.put('media', { id, blob, createdAt: Date.now() });
}

// Medya Blob'unu okuma
export async function getMediaBlob(id) {
  const db = await getLocalDB();
  const item = await db.get('media', id);
  return item ? item.blob : null;
}

// Depolama istatistiklerini hesaplama (Kullanıcının cihazında kaç MB tutulduğu)
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

// Tüm yerel verileri sıfırlama (Kullanıcı cihazından tamamen silmek isterse)
export async function clearAllLocalData() {
  const db = await getLocalDB();
  await db.clear('messages');
  await db.clear('media');
  await db.clear('contacts');
}

