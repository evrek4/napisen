// napisen - Mesajlaşma çekirdeği
// Gelen/giden kutularını dinler, şifreler/çözer, yerel depolamayı ve sohbet özetlerini yönetir.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeUsers,
  subscribeAllowlist,
  subscribeMessages,
  uploadMessage,
  downloadMediaBytes,
  deleteMessageFromServer,
  markDeliveredOnServer,
} from '../services/firebase';
import {
  deriveConversationKey,
  encryptJSON,
  decryptJSON,
  encryptBytes,
  decryptBytes,
  decodeVerifyCode,
} from '../services/crypto';
import {
  conversationIdFor,
  saveMessage,
  getMessage,
  getMessagesByConversation,
  updateMessage,
  saveMediaBlob,
  getMediaBlob,
  getConversationMetas,
  saveConversationMeta,
  getTrustedContacts,
  saveTrustedContact,
  removeTrustedContact,
  deleteLocalMessage,
} from '../services/db';
import { showMessageNotification } from '../services/notify';
import { MAX_MEDIA_BYTES } from '../services/media';

export const MAX_TEXT_LENGTH = 4000;

const headerAad = (id, from, to) => `${id}|${from}|${to}`;
const mediaAad = (id) => `${id}|media`;

function newMessageId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'm_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function previewText(msg) {
  if (msg.type === 'audio') return 'Sesli Mesaj';
  if (msg.type === 'image') return 'Fotoğraf';
  if (msg.type === 'undecryptable') return 'Çözülemeyen mesaj';
  return msg.text || '';
}

export function contactKeyStatus(publishedKey, trustedKey) {
  if (!publishedKey) return 'no-key';
  if (!trustedKey) return 'unverified';
  return trustedKey === publishedKey ? 'verified' : 'changed';
}

export default function useMessenger({ me, identity, preferences }) {
  const [allowlist, setAllowlist] = useState({ emails: [], admins: [] });
  const [users, setUsers] = useState({});
  const [trusted, setTrusted] = useState({});
  const [metas, setMetas] = useState({});
  const [activeEmail, setActiveEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [syncError, setSyncError] = useState('');

  // Abonelik geri çağrılarında en güncel değerleri okumak için ref'ler
  const prefsRef = useRef(preferences);
  const activeRef = useRef(activeEmail);
  const trustedRef = useRef(trusted);
  const usersRef = useRef(users);
  prefsRef.current = preferences;
  activeRef.current = activeEmail;
  trustedRef.current = trusted;
  usersRef.current = users;

  const keyCache = useRef(new Map());
  const memStore = useRef(new Map()); // Hayalet Mod: id -> mesaj (yalnızca RAM)
  const memMetas = useRef({});
  const processed = useRef(new Set());
  const queue = useRef(Promise.resolve());

  const myEmail = me.email;

  // ---------- Yardımcılar ----------
  const getKey = useCallback(
    async (theirEmail, theirPub) => {
      const cacheKey = `${theirEmail}|${theirPub}`;
      if (!keyCache.current.has(cacheKey)) {
        keyCache.current.set(
          cacheKey,
          deriveConversationKey(identity.privateKey, theirPub, myEmail, theirEmail)
        );
      }
      return keyCache.current.get(cacheKey);
    },
    [identity, myEmail]
  );

  const enqueue = useCallback((task) => {
    queue.current = queue.current.then(task).catch((err) => console.error('Mesaj işleme hatası:', err));
    return queue.current;
  }, []);

  const hasLocal = useCallback(async (id) => {
    if (memStore.current.has(id)) return true;
    return Boolean(await getMessage(id));
  }, []);

  const persist = useCallback(async (msg) => {
    if (prefsRef.current.dontStoreOnDevice) {
      memStore.current.set(msg.id, msg);
      return;
    }
    if (msg.mediaBlob) await saveMediaBlob(msg.id, msg.mediaBlob);
    await saveMessage(msg);
  }, []);

  const patchMessage = useCallback(async (id, changes, onlyIf) => {
    const mem = memStore.current.get(id);
    if (mem) {
      if (!onlyIf || onlyIf(mem)) Object.assign(mem, changes);
    } else {
      const stored = await getMessage(id);
      if (stored && (!onlyIf || onlyIf(stored))) await updateMessage(id, changes);
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === id && (!onlyIf || onlyIf(m)) ? { ...m, ...changes } : m))
    );
  }, []);

  const showInView = useCallback((msg) => {
    const other = msg.isOutgoing ? msg.receiver : msg.sender;
    if (activeRef.current !== other) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const metasRef = useRef({});
  const writeMeta = useCallback(
    async (email, next) => {
      metasRef.current = { ...metasRef.current, [email]: next };
      setMetas(metasRef.current);
      if (prefsRef.current.dontStoreOnDevice) memMetas.current[email] = next;
      else await saveConversationMeta(next);
    },
    []
  );

  const bumpMeta = useCallback(
    async (msg, { unread = false } = {}) => {
      const other = msg.isOutgoing ? msg.receiver : msg.sender;
      const cur = metasRef.current[other] || {
        id: `${myEmail}|${other}`,
        owner: myEmail,
        email: other,
        unread: 0,
        lastTs: 0,
      };
      const newer = msg.timestamp >= (cur.lastTs || 0);
      if (!newer && !unread) return;
      await writeMeta(other, {
        ...cur,
        ...(newer ? { lastText: previewText(msg), lastType: msg.type, lastTs: msg.timestamp } : {}),
        unread: unread ? (cur.unread || 0) + 1 : cur.unread || 0,
      });
    },
    [myEmail, writeMeta]
  );

  const resetUnread = useCallback(
    async (email) => {
      const cur = metasRef.current[email];
      if (cur?.unread) await writeMeta(email, { ...cur, unread: 0 });
    },
    [writeMeta]
  );

  // ---------- Abonelikler: izin listesi, kullanıcılar, doğrulanmış kişiler, özetler ----------
  useEffect(() => subscribeAllowlist(setAllowlist), []);
  useEffect(() => subscribeUsers(setUsers), []);

  useEffect(() => {
    let cancelled = false;
    getTrustedContacts(myEmail).then((list) => {
      if (cancelled) return;
      const map = {};
      list.forEach((t) => (map[t.email] = t));
      setTrusted(map);
    });
    getConversationMetas().then((list) => {
      if (cancelled) return;
      const map = {};
      list.filter((m) => m.owner === myEmail).forEach((m) => (map[m.email] = m));
      metasRef.current = { ...map, ...memMetas.current };
      setMetas(metasRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [myEmail]);

  // ---------- Gelen kutusu ----------
  const finalizeIncoming = useCallback(async (id, data) => {
    const keep = data.keepOnServer || prefsRef.current.serverStorageEnabled;
    try {
      if (keep) {
        if (data.status !== 'delivered') await markDeliveredOnServer(id);
      } else {
        await deleteMessageFromServer(id, data.media?.chunks || 0);
      }
    } catch (err) {
      console.warn('Sunucu temizliği yapılamadı:', err);
    }
  }, []);

  const handleIncoming = useCallback(
    async (type, id, data) => {
      if (type !== 'added') return;
      if (processed.current.has(id) || (await hasLocal(id))) {
        processed.current.add(id);
        await finalizeIncoming(id, data);
        return;
      }

      const sender = data.from;
      const base = {
        id,
        conversationId: conversationIdFor(myEmail, sender),
        sender,
        receiver: myEmail,
        isOutgoing: false,
        status: 'delivered',
        timestamp: data.createdAt?.toMillis?.() || Date.now(),
      };

      let msg;
      try {
        if (data.toPub !== identity.publicKey) {
          throw new Error('Bu mesaj bu cihazın eski bir anahtarına şifrelenmiş.');
        }
        const key = await getKey(sender, data.fromPub);
        const header = await decryptJSON(key, data.header, headerAad(id, sender, myEmail));
        let mediaBlob = null;
        if (data.media) {
          const cipher = await downloadMediaBytes(id, data.media.chunks);
          const plain = await decryptBytes(key, data.media.iv, cipher, mediaAad(id));
          mediaBlob = new Blob([plain], { type: header.mimeType || 'application/octet-stream' });
        }
        msg = {
          ...base,
          type: header.type,
          text: header.type === 'text' ? String(header.text || '') : '',
          duration: header.duration || null,
          mimeType: header.mimeType || null,
          timestamp: header.ts || base.timestamp,
          mediaBlob,
          unverifiedSender: trustedRef.current[sender]?.publicKey !== data.fromPub,
        };
      } catch (err) {
        console.error('Gelen mesaj çözülemedi:', err);
        msg = { ...base, type: 'undecryptable', text: err.message || 'Mesaj çözülemedi.' };
      }

      processed.current.add(id);
      await persist(msg);
      showInView(msg);
      const isViewing = activeRef.current === sender && !document.hidden;
      await bumpMeta(msg, { unread: !isViewing });
      if (!isViewing) {
        const name = usersRef.current[sender]?.displayName || sender;
        showMessageNotification(name);
      }
      await finalizeIncoming(id, data);
    },
    [myEmail, identity, getKey, hasLocal, persist, showInView, bumpMeta, finalizeIncoming]
  );

  // ---------- Giden kutusu (teslim tikleri + başka cihazdan geri yükleme) ----------
  const handleOutgoing = useCallback(
    async (type, id, data) => {
      if (type === 'removed') {
        // Alıcı teslim aldıktan sonra sunucudan sildi
        await patchMessage(id, { status: 'delivered' }, (m) => m.status === 'sent' || m.status === 'sending');
        return;
      }
      if (await hasLocal(id)) {
        if (data.status === 'delivered') {
          await patchMessage(id, { status: 'delivered' }, (m) => m.status !== 'delivered');
        }
        return;
      }
      if (type !== 'added' || processed.current.has(id)) return;
      processed.current.add(id);

      // Sunucuda saklanan, bu cihazda olmayan kendi mesajımız: geri yükle
      if (data.fromPub !== identity.publicKey) return;
      try {
        const key = await getKey(data.to, data.toPub);
        const header = await decryptJSON(key, data.header, headerAad(id, myEmail, data.to));
        let mediaBlob = null;
        if (data.media) {
          const cipher = await downloadMediaBytes(id, data.media.chunks);
          const plain = await decryptBytes(key, data.media.iv, cipher, mediaAad(id));
          mediaBlob = new Blob([plain], { type: header.mimeType || 'application/octet-stream' });
        }
        const msg = {
          id,
          conversationId: conversationIdFor(myEmail, data.to),
          sender: myEmail,
          receiver: data.to,
          isOutgoing: true,
          status: data.status === 'delivered' ? 'delivered' : 'sent',
          type: header.type,
          text: header.type === 'text' ? String(header.text || '') : '',
          duration: header.duration || null,
          mimeType: header.mimeType || null,
          timestamp: header.ts || Date.now(),
          mediaBlob,
        };
        await persist(msg);
        showInView(msg);
        await bumpMeta(msg);
      } catch (err) {
        console.warn('Giden mesaj geri yüklenemedi:', err);
      }
    },
    [identity, myEmail, getKey, hasLocal, persist, patchMessage, showInView, bumpMeta]
  );

  useEffect(() => {
    const onErr = (err) =>
      setSyncError(
        err?.code === 'permission-denied'
          ? 'Sunucu erişimi reddedildi. İzin listesinden çıkarılmış olabilirsiniz.'
          : 'Sunucuyla bağlantı kurulamadı.'
      );
    const unsubIn = subscribeMessages('to', myEmail, (t, id, d) => enqueue(() => handleIncoming(t, id, d)), onErr);
    const unsubOut = subscribeMessages('from', myEmail, (t, id, d) => enqueue(() => handleOutgoing(t, id, d)), onErr);
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [myEmail, enqueue, handleIncoming, handleOutgoing]);

  // ---------- Aktif sohbet ----------
  const openConversation = useCallback(
    async (email) => {
      setActiveEmail(email);
      if (!email) {
        setMessages([]);
        return;
      }
      const convId = conversationIdFor(myEmail, email);
      const stored = await getMessagesByConversation(convId);
      const withMedia = await Promise.all(
        stored.map(async (m) =>
          m.type === 'audio' || m.type === 'image' ? { ...m, mediaBlob: await getMediaBlob(m.id) } : m
        )
      );
      const mem = [...memStore.current.values()].filter((m) => m.conversationId === convId);
      const all = new Map();
      [...withMedia, ...mem].forEach((m) => all.set(m.id, m));
      if (activeRef.current === email) {
        setMessages([...all.values()].sort((a, b) => a.timestamp - b.timestamp));
      }

      await resetUnread(email);
    },
    [myEmail, resetUnread]
  );

  // Sekmeye geri dönüldüğünde açık sohbetin sayacını sıfırla
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && activeRef.current) resetUnread(activeRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [resetUnread]);

  // ---------- Gönderim ----------
  const send = useCallback(
    async (to, content) => {
      const trustedKey = trustedRef.current[to]?.publicKey;
      const publishedKey = usersRef.current[to]?.publicKey;
      if (contactKeyStatus(publishedKey, trustedKey) !== 'verified') {
        throw new Error('Bu kişinin anahtarı doğrulanmadan mesaj gönderilemez.');
      }

      const id = newMessageId();
      const ts = Date.now();
      const msg = {
        id,
        conversationId: conversationIdFor(myEmail, to),
        sender: myEmail,
        receiver: to,
        isOutgoing: true,
        status: 'sending',
        timestamp: ts,
        type: content.type,
        text: content.text || '',
        duration: content.duration || null,
        mimeType: content.blob?.type || null,
        mediaBlob: content.blob || null,
      };

      await persist(msg);
      showInView(msg);
      await bumpMeta(msg);

      try {
        const key = await getKey(to, trustedKey);
        const header = await encryptJSON(
          key,
          { type: msg.type, text: msg.text, duration: msg.duration, mimeType: msg.mimeType, ts },
          headerAad(id, myEmail, to)
        );
        let media = null;
        let mediaBytes = null;
        if (content.blob) {
          const sealed = await encryptBytes(key, await content.blob.arrayBuffer(), mediaAad(id));
          media = { iv: sealed.iv, size: content.blob.size };
          mediaBytes = sealed.data;
        }
        await uploadMessage(
          id,
          {
            from: myEmail,
            to,
            fromPub: identity.publicKey,
            toPub: trustedKey,
            keepOnServer: Boolean(prefsRef.current.serverStorageEnabled),
            header,
            media,
          },
          mediaBytes
        );
        await patchMessage(id, { status: 'sent', error: null }, (m) => m.status === 'sending');
      } catch (err) {
        console.error('Mesaj gönderilemedi:', err);
        const reason =
          err?.code === 'permission-denied'
            ? 'Sunucu reddetti (izin listesi veya anahtar uyuşmazlığı).'
            : err?.message || 'Gönderilemedi.';
        await patchMessage(id, { status: 'failed', error: reason });
      }
    },
    [myEmail, identity, getKey, persist, showInView, bumpMeta, patchMessage]
  );

  const sendText = useCallback(
    (to, text) => {
      const clean = text.slice(0, MAX_TEXT_LENGTH);
      return send(to, { type: 'text', text: clean });
    },
    [send]
  );

  const sendAudio = useCallback(
    (to, blob, duration) => {
      if (blob.size > MAX_MEDIA_BYTES) throw new Error('Ses kaydı çok büyük.');
      return send(to, { type: 'audio', blob, duration });
    },
    [send]
  );

  const sendImage = useCallback((to, blob) => send(to, { type: 'image', blob }), [send]);

  // Başarısız mesajı yeni kimlikle tekrar gönder, eskisini kaldır
  const retry = useCallback(
    async (msg) => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      memStore.current.delete(msg.id);
      await deleteLocalMessage(msg.id);
      await send(msg.receiver, {
        type: msg.type,
        text: msg.text,
        duration: msg.duration,
        blob: msg.mediaBlob || null,
      });
    },
    [send]
  );

  // ---------- Kişi doğrulama ----------
  const trustContact = useCallback(
    async (email, publicKey, method) => {
      await saveTrustedContact(myEmail, email, publicKey, method);
      setTrusted((prev) => ({ ...prev, [email]: { email, publicKey, method, verifiedAt: Date.now() } }));
    },
    [myEmail]
  );

  const verifyByCode = useCallback(
    async (codeText) => {
      const parsed = decodeVerifyCode(codeText);
      if (!parsed) throw new Error('Bu bir napisen doğrulama kodu değil.');
      if (parsed.email === myEmail) throw new Error('Kendi kodunuzu okuttunuz. Karşı tarafın kodunu okutun.');
      if (!allowlist.emails.includes(parsed.email)) {
        throw new Error(`${parsed.email} izin listesinde değil.`);
      }
      const published = usersRef.current[parsed.email]?.publicKey;
      if (!published) {
        throw new Error('Bu kişi henüz uygulamaya giriş yapıp anahtarını yayınlamamış.');
      }
      if (published !== parsed.publicKey) {
        throw new Error(
          'QR koddaki anahtar sunucudaki anahtarla eşleşmiyor. Karşı taraf uygulamayı yeniden açıp tekrar denesin; sorun sürerse bağlantı güvenli olmayabilir.'
        );
      }
      await trustContact(parsed.email, parsed.publicKey, 'qr');
      return parsed.email;
    },
    [myEmail, allowlist, trustContact]
  );

  const verifyBySafetyNumber = useCallback(
    async (email) => {
      const published = usersRef.current[email]?.publicKey;
      if (!published) throw new Error('Bu kişinin anahtarı yok.');
      await trustContact(email, published, 'safety-number');
    },
    [trustContact]
  );

  const unverifyContact = useCallback(
    async (email) => {
      await removeTrustedContact(myEmail, email);
      setTrusted((prev) => {
        const next = { ...prev };
        delete next[email];
        return next;
      });
    },
    [myEmail]
  );

  // ---------- Kişi listesi ----------
  const contacts = useMemo(
    () =>
      allowlist.emails
        .filter((e) => e !== myEmail)
        .map((email) => {
          const profile = users[email];
          const meta = metas[email] || {};
          return {
            email,
            name: profile?.displayName || email.split('@')[0],
            publicKey: profile?.publicKey || null,
            keyStatus: contactKeyStatus(profile?.publicKey, trusted[email]?.publicKey),
            unreadCount: meta.unread || 0,
            lastMessageText: meta.lastText || '',
            lastMessageType: meta.lastType || null,
            lastMessageTs: meta.lastTs || 0,
          };
        })
        .sort((a, b) => b.lastMessageTs - a.lastMessageTs || a.name.localeCompare(b.name, 'tr')),
    [allowlist, users, metas, trusted, myEmail]
  );

  const clearMemory = useCallback(() => {
    memStore.current.clear();
    memMetas.current = {};
    metasRef.current = {};
    setMessages([]);
    setMetas({});
  }, []);

  return {
    allowlist,
    contacts,
    activeEmail,
    messages,
    syncError,
    openConversation,
    sendText,
    sendAudio,
    sendImage,
    retry,
    verifyByCode,
    verifyBySafetyNumber,
    unverifyContact,
    trusted,
    clearMemory,
  };
}
