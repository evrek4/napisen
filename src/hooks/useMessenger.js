// napisen - Mesajlaşma çekirdeği
// Gelen/giden kutularını dinler, şifreler/çözer, yerel depolamayı ve sohbet özetlerini yönetir.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeCode,
  lookupByCode,
  lookupByEmail,
  normalizeCode,
  subscribeMessages,
  subscribeBlocks,
  blockUser,
  unblockUser,
  createReport,
  setTyping,
  clearTyping,
  subscribeTyping,
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
  normalizeEmail,
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
  deleteLocalMessage,
  getMyContacts,
  saveMyContact,
  removeMyContact,
} from '../services/db';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// no-key     : kişi henüz giriş yapmadı
// unverified : mesajlaşılabilir; anahtar ilk görüşte sabitlendi ama QR ile doğrulanmadı (isteğe bağlı)
// verified   : QR / güvenlik numarası ile doğrulandı
// changed    : sabitlenen anahtar değişti -> kullanıcı onaylayana kadar gönderim durur
export function contactKeyStatus(publishedKey, trustedRecord) {
  // Profil okunamıyorsa (ör. kişi kodunu yeniledi) daha önce kaydedilen anahtarla devam edilir
  if (!publishedKey) return trustedRecord ? (trustedRecord.verified ? 'verified' : 'unverified') : 'no-key';
  if (!trustedRecord) return 'unverified';
  if (trustedRecord.publicKey !== publishedKey) return 'changed';
  return trustedRecord.verified ? 'verified' : 'unverified';
}

export const canMessage = (status) => status === 'verified' || status === 'unverified';

export default function useMessenger({ me, identity, myCode, preferences, onIncoming }) {
  const [myContacts, setMyContacts] = useState({});
  const [users, setUsers] = useState({});
  const [trusted, setTrusted] = useState({});
  const [metas, setMetas] = useState({});
  const [activeEmail, setActiveEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [syncError, setSyncError] = useState('');
  const [blocked, setBlocked] = useState(() => new Set());
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  // Abonelik geri çağrılarında en güncel değerleri okumak için ref'ler
  const prefsRef = useRef(preferences);
  const activeRef = useRef(activeEmail);
  const trustedRef = useRef(trusted);
  const usersRef = useRef(users);
  const myContactsRef = useRef(myContacts);
  prefsRef.current = preferences;
  activeRef.current = activeEmail;
  trustedRef.current = trusted;
  usersRef.current = users;
  myContactsRef.current = myContacts;
  const myCodeRef = useRef(myCode);
  myCodeRef.current = myCode;
  const onIncomingRef = useRef(onIncoming);
  onIncomingRef.current = onIncoming;

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

  // ---------- "Yazıyor..." göstergesi ----------
  // Karşı tarafın yazdığı, son güncellemeden sonra 6 saniye boyunca gösterilir (saat farkından etkilenmez)
  const TYPING_TTL = 6000;
  const [typingSeen, setTypingSeen] = useState({}); // email -> yerel alınma zamanı
  const [tick, setTick] = useState(0);
  useEffect(
    () =>
      subscribeTyping(myEmail, (email, active) =>
        setTypingSeen((prev) => {
          const next = { ...prev };
          if (active) next[email] = Date.now();
          else delete next[email];
          return next;
        })
      ),
    [myEmail]
  );
  const anyTyping = Object.keys(typingSeen).length > 0;
  useEffect(() => {
    if (!anyTyping) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [anyTyping]);

  // Kendi yazma durumumuzu gönder (en fazla 3 saniyede bir)
  const lastTypingSent = useRef({});
  const notifyTyping = useCallback(
    (to, active) => {
      if (!to || !prefsRef.current.sendTyping || blockedRef.current.has(to)) return;
      const last = lastTypingSent.current[to] || 0;
      if (active) {
        if (Date.now() - last < 3000) return;
        lastTypingSent.current[to] = Date.now();
        setTyping(to, myEmail).catch(() => {});
      } else if (last) {
        lastTypingSent.current[to] = 0;
        clearTyping(to, myEmail).catch(() => {});
      }
    },
    [myEmail]
  );

  // Gelen mesaj, "yazıyor" durumunu hemen bitirir
  const clearTypingFor = useCallback((email) => {
    setTypingSeen((prev) => {
      if (!prev[email]) return prev;
      const next = { ...prev };
      delete next[email];
      return next;
    });
  }, []);

  // ---------- Engellenenler ----------
  useEffect(() => subscribeBlocks(myEmail, setBlocked), [myEmail]);

  // ---------- Kişiler (yalnızca bu cihazda) ve anahtar sabitleme ----------
  const ensureContact = useCallback(
    async (email, code, name) => {
      const existing = myContactsRef.current[email];
      if (existing && (!code || existing.code === code)) return;
      const rec = await saveMyContact(myEmail, email, name || existing?.name || '', code || existing?.code);
      myContactsRef.current = { ...myContactsRef.current, [email]: rec };
      setMyContacts(myContactsRef.current);
    },
    [myEmail]
  );

  const setTrustedRecord = useCallback((email, rec) => {
    trustedRef.current = { ...trustedRef.current, [email]: rec };
    setTrusted(trustedRef.current);
  }, []);

  // İlk görüşte anahtarı sabitle (TOFU). Sonradan değişirse kullanıcı uyarılır.
  const pinIfNew = useCallback(
    async (email, publicKey) => {
      const existing = trustedRef.current[email];
      if (existing || !publicKey) return existing || null;
      const rec = await saveTrustedContact(myEmail, email, publicKey, 'tofu', false);
      setTrustedRecord(email, rec);
      return rec;
    },
    [myEmail, setTrustedRecord]
  );

  // Yalnızca kişi listesindekilerin açık profilleri, kodları üzerinden tek tek dinlenir
  const userSubs = useRef(new Map()); // email -> { code, unsub }
  useEffect(() => {
    for (const [email, contact] of Object.entries(myContacts)) {
      const sub = userSubs.current.get(email);
      if (sub && sub.code === contact.code) continue;
      sub?.unsub();
      if (!contact.code) {
        userSubs.current.delete(email);
        continue;
      }
      userSubs.current.set(email, {
        code: contact.code,
        unsub: subscribeCode(contact.code, (profile) =>
          setUsers((prev) => ({ ...prev, [email]: profile && profile.email === email ? profile : null }))
        ),
      });
    }
    for (const [email, sub] of userSubs.current) {
      if (!myContacts[email]) {
        sub.unsub();
        userSubs.current.delete(email);
      }
    }
  }, [myContacts]);
  useEffect(
    () => () => {
      userSubs.current.forEach((sub) => sub.unsub());
      userSubs.current.clear();
    },
    []
  );

  const fetchProfile = useCallback(async (email) => {
    const code = myContactsRef.current[email]?.code;
    if (!code) return null;
    const profile = await lookupByCode(code);
    return profile && profile.email === email ? profile : null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMyContacts(myEmail).then((list) => {
      if (cancelled) return;
      const map = {};
      list.forEach((c) => (map[c.email] = c));
      myContactsRef.current = { ...map, ...myContactsRef.current };
      setMyContacts(myContactsRef.current);
    });
    getTrustedContacts(myEmail).then((list) => {
      if (cancelled) return;
      const map = {};
      list.forEach((t) => (map[t.email] = { ...t, verified: t.verified ?? t.method !== 'tofu' }));
      trustedRef.current = { ...map, ...trustedRef.current };
      setTrusted(trustedRef.current);
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
      // Bu cihazın anahtarına şifrelenmemiş mesaja dokunma: aynı hesabın yeni anahtarlı cihazına aittir.
      // (Silersek o cihaz mesajı hiç alamaz.)
      if (data.toPub !== identity.publicKey) return;
      if (processed.current.has(id) || (await hasLocal(id))) {
        processed.current.add(id);
        await finalizeIncoming(id, data);
        return;
      }

      // Engellenen kişiden gelen (engellemeden önce gönderilmiş) mesajları gösterme
      if (blockedRef.current.has(data.from)) {
        processed.current.add(id);
        await deleteMessageFromServer(id, data.media?.chunks || 0).catch(() => {});
        return;
      }

      const sender = data.from;
      await ensureContact(sender, data.fromCode);
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
        const pinned = await pinIfNew(sender, data.fromPub);
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
          protect: Boolean(header.protect),
          forwarded: Boolean(header.forwarded),
          timestamp: header.ts || base.timestamp,
          mediaBlob,
          // Sabitlenen anahtardan farklı bir anahtarla geldiyse uyar
          keyMismatch: Boolean(pinned && pinned.publicKey !== data.fromPub),
        };
      } catch (err) {
        if (err?.code === 'media-missing') {
          // Aynı hesabın başka bir cihazı mesajı teslim alıp sunucudan sildi: bu cihazda gösterme
          processed.current.add(id);
          return;
        }
        console.error('Gelen mesaj çözülemedi:', err);
        msg = { ...base, type: 'undecryptable', text: err.message || 'Mesaj çözülemedi.' };
      }

      processed.current.add(id);
      clearTypingFor(sender);
      await persist(msg);
      showInView(msg);
      const isViewing = activeRef.current === sender && !document.hidden;
      await bumpMeta(msg, { unread: !isViewing });
      if (!isViewing) {
        // İlk kez yazan kişinin profili henüz yüklenmemiş olabilir: kodundan adını al
        if (!usersRef.current[sender]?.displayName && data.fromCode) {
          const p = await lookupByCode(data.fromCode).catch(() => null);
          if (p?.email === sender) {
            usersRef.current = { ...usersRef.current, [sender]: p };
            setUsers((prev) => ({ ...prev, [sender]: prev[sender] || p }));
          }
        }
        const name = usersRef.current[sender]?.displayName || myContactsRef.current[sender]?.name || 'Bir kişi';
        onIncomingRef.current?.({ sender, name });
      }
      await finalizeIncoming(id, data);
    },
    [myEmail, identity, getKey, hasLocal, persist, showInView, bumpMeta, finalizeIncoming, ensureContact, pinIfNew, clearTypingFor]
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
        await ensureContact(data.to, data.toCode);
        await pinIfNew(data.to, data.toPub);
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
          protect: Boolean(header.protect),
          forwarded: Boolean(header.forwarded),
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
    [identity, myEmail, getKey, hasLocal, persist, patchMessage, showInView, bumpMeta, ensureContact, pinIfNew]
  );

  useEffect(() => {
    const onErr = (err) =>
      setSyncError(
        err?.code === 'permission-denied'
          ? 'Sunucu erişimi reddedildi. Hesabınız askıya alınmış olabilir; sayfayı yenileyin.'
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
      if (blockedRef.current.has(to)) throw new Error('Bu kişiyi engellediniz. Mesaj göndermek için engeli kaldırın.');
      notifyTyping(to, false);
      let publishedKey = usersRef.current[to]?.publicKey;
      if (!publishedKey) publishedKey = (await fetchProfile(to))?.publicKey;
      const pinned = await pinIfNew(to, publishedKey);
      const status = contactKeyStatus(publishedKey, pinned);
      if (status === 'no-key') throw new Error('Bu kişi henüz uygulamaya giriş yapmadı.');
      if (status === 'changed') {
        throw new Error('Bu kişinin güvenlik anahtarı değişti. Göndermeden önce yeni anahtarı onaylayın.');
      }
      const trustedKey = pinned.publicKey;

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
        // Gönderen kopyalama/iletmeyi kapattıysa (Ayarlar → Gizlilik)
        protect: prefsRef.current.allowCopy === false,
        forwarded: Boolean(content.forwarded),
      };

      await persist(msg);
      showInView(msg);
      await bumpMeta(msg);

      try {
        const key = await getKey(to, trustedKey);
        const header = await encryptJSON(
          key,
          {
            type: msg.type,
            text: msg.text,
            duration: msg.duration,
            mimeType: msg.mimeType,
            ts,
            protect: msg.protect,
            forwarded: msg.forwarded,
          },
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
            fromCode: myCodeRef.current,
            toCode: myContactsRef.current[to]?.code || null,
            keepOnServer: Boolean(prefsRef.current.serverStorageEnabled),
            header,
            media,
          },
          mediaBytes,
          // Yükleme yüzdesi yalnızca ekranda gösterilir (yerel veritabanına yazılmaz)
          mediaBytes
            ? (fraction) =>
                setMessages((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, progress: Math.round(fraction * 100) } : m))
                )
            : undefined
        );
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, progress: null } : m)));
        await patchMessage(id, { status: 'sent', error: null }, (m) => m.status === 'sending');
      } catch (err) {
        console.error('Mesaj gönderilemedi:', err);
        const reason =
          err?.code === 'permission-denied'
            ? 'Sunucu reddetti (kişi sizi engellemiş, hesabı askıda veya anahtar uyuşmazlığı olabilir).'
            : err?.message || 'Gönderilemedi.';
        await patchMessage(id, { status: 'failed', error: reason });
      }
    },
    [myEmail, identity, getKey, persist, showInView, bumpMeta, patchMessage, pinIfNew, fetchProfile, notifyTyping]
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

  // İletme: gönderen korumaya aldıysa iletilemez
  const forward = useCallback(
    async (msg, to) => {
      if (!msg.isOutgoing && msg.protect) throw new Error('Gönderen bu mesajın iletilmesine izin vermiyor.');
      if (msg.type === 'undecryptable') throw new Error('Bu mesaj iletilemez.');
      await send(to, {
        type: msg.type,
        text: msg.text,
        duration: msg.duration,
        blob: msg.mediaBlob || null,
        forwarded: true,
      });
    },
    [send]
  );

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

  // ---------- Kişi ekleme (kod ile, ya da kişi izin verdiyse e-posta ile) ----------
  const addContact = useCallback(
    async (rawInput) => {
      const input = (rawInput || '').trim();
      let profile;
      try {
        if (input.includes('@')) {
          const email = normalizeEmail(input);
          if (!EMAIL_RE.test(email)) throw new Error('Geçerli bir e-posta adresi yazın.');
          if (email === myEmail) throw new Error('Kendi adresinizi yazdınız.');
          profile = await lookupByEmail(email);
          if (!profile?.code) {
            throw new Error(
              'Bu e-postayla bulunabilen bir kullanıcı yok. Kişi e-postayla bulunmayı kapatmış olabilir; ondan kişi kodunu isteyin.'
            );
          }
        } else {
          const code = normalizeCode(input);
          if (!code) throw new Error('Kod 8 karakter olmalı (ör. 7K3Q-9XW2).');
          if (code === myCodeRef.current) throw new Error('Bu sizin kendi kodunuz.');
          profile = await lookupByCode(code);
          if (!profile) throw new Error('Bu koda sahip bir kullanıcı bulunamadı. Kodu kontrol edin.');
        }
      } catch (err) {
        if (err instanceof Error && !err.code) throw err;
        throw new Error('Kişi aranamadı. İnternet bağlantınızı kontrol edin.');
      }
      const email = profile.email;
      if (email === myEmail) throw new Error('Bu sizin kendi kodunuz.');
      setUsers((prev) => ({ ...prev, [email]: { ...profile } }));
      await ensureContact(email, profile.code, profile.displayName);
      await pinIfNew(email, profile.publicKey);
      return email;
    },
    [myEmail, ensureContact, pinIfNew]
  );

  const removeContact = useCallback(
    async (email) => {
      await removeMyContact(myEmail, email);
      const next = { ...myContactsRef.current };
      delete next[email];
      myContactsRef.current = next;
      setMyContacts(next);
      if (activeRef.current === email) {
        setActiveEmail(null);
        setMessages([]);
      }
    },
    [myEmail]
  );

  // ---------- Kişi doğrulama (isteğe bağlı) ----------
  const trustContact = useCallback(
    async (email, publicKey, method) => {
      const rec = await saveTrustedContact(myEmail, email, publicKey, method, method !== 'tofu');
      setTrustedRecord(email, rec);
    },
    [myEmail, setTrustedRecord]
  );

  const verifyByCode = useCallback(
    async (codeText) => {
      const parsed = decodeVerifyCode(codeText);
      if (!parsed) throw new Error('Bu bir napisen doğrulama kodu değil.');
      if (parsed.email === myEmail) throw new Error('Kendi kodunuzu okuttunuz. Karşı tarafın kodunu okutun.');
      let published = usersRef.current[parsed.email]?.publicKey;
      if (!published && parsed.code) {
        const p = await lookupByCode(parsed.code).catch(() => null);
        if (p?.email === parsed.email) published = p.publicKey;
      }
      if (!published) {
        throw new Error('Bu kişi henüz uygulamaya giriş yapıp anahtarını yayınlamamış.');
      }
      if (published !== parsed.publicKey) {
        throw new Error(
          'QR koddaki anahtar sunucudaki anahtarla eşleşmiyor. Karşı taraf uygulamayı yeniden açıp tekrar denesin; sorun sürerse bağlantı güvenli olmayabilir.'
        );
      }
      await ensureContact(parsed.email, parsed.code);
      await trustContact(parsed.email, parsed.publicKey, 'qr');
      return parsed.email;
    },
    [myEmail, trustContact, ensureContact]
  );

  const verifyBySafetyNumber = useCallback(
    async (email) => {
      const published = usersRef.current[email]?.publicKey;
      if (!published) throw new Error('Bu kişinin anahtarı yok.');
      await trustContact(email, published, 'safety-number');
    },
    [trustContact]
  );

  // Anahtar değiştiğinde yeni anahtarı kabul et (doğrulanmamış olarak)
  const acceptNewKey = useCallback(
    async (email) => {
      const published = usersRef.current[email]?.publicKey;
      if (!published) throw new Error('Bu kişinin anahtarı yok.');
      await trustContact(email, published, 'tofu');
    },
    [trustContact]
  );

  const unverifyContact = useCallback(
    async (email) => {
      const rec = trustedRef.current[email];
      if (rec) await trustContact(email, rec.publicKey, 'tofu');
    },
    [trustContact]
  );

  // ---------- Kişi listesi ----------
  const contacts = useMemo(
    () =>
      Object.keys(myContacts)
        .filter((e) => e !== myEmail)
        .map((email) => {
          const profile = users[email];
          const meta = metas[email] || {};
          return {
            email,
            name: profile?.displayName || myContacts[email]?.name || 'İsimsiz kişi',
            code: myContacts[email]?.code || null,
            publicKey: profile?.publicKey || null,
            keyStatus: contactKeyStatus(profile?.publicKey, trusted[email]),
            blocked: blocked.has(email),
            typing: Boolean(typingSeen[email] && Date.now() - typingSeen[email] < TYPING_TTL),
            unreadCount: meta.unread || 0,
            lastMessageText: meta.lastText || '',
            lastMessageType: meta.lastType || null,
            lastMessageTs: meta.lastTs || 0,
          };
        })
        .sort((a, b) => b.lastMessageTs - a.lastMessageTs || a.name.localeCompare(b.name, 'tr')),
    // tick: "yazıyor" süresinin dolmasını yansıtmak için saniyede bir yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myContacts, users, metas, trusted, myEmail, blocked, typingSeen, tick]
  );

  // ---------- Engelleme ve şikâyet ----------
  const block = useCallback((email) => blockUser(myEmail, email), [myEmail]);
  const unblock = useCallback((email) => unblockUser(myEmail, email), [myEmail]);

  // Şikâyet: kullanıcı isterse karşı taraftan gelen son 10 mesaj (çözülmüş hâliyle) moderatörlere iletilir
  const report = useCallback(
    async (email, reason, details, includeEvidence) => {
      let evidence = [];
      if (includeEvidence) {
        const convId = conversationIdFor(myEmail, email);
        const stored = await getMessagesByConversation(convId);
        const mem = [...memStore.current.values()].filter((m) => m.conversationId === convId);
        const all = new Map();
        [...stored, ...mem].forEach((m) => all.set(m.id, m));
        evidence = [...all.values()]
          .filter((m) => !m.isOutgoing)
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-10)
          .map((m) => ({
            type: m.type,
            text:
              m.type === 'text'
                ? String(m.text || '').slice(0, 1000)
                : m.type === 'image'
                  ? '[Fotoğraf]'
                  : m.type === 'audio'
                    ? '[Sesli mesaj]'
                    : '[Çözülemeyen mesaj]',
            at: m.timestamp,
          }));
      }
      await createReport({ reporter: myEmail, reported: email, reason, details, evidence });
    },
    [myEmail]
  );

  const clearMemory = useCallback(() => {
    memStore.current.clear();
    memMetas.current = {};
    metasRef.current = {};
    setMessages([]);
    setMetas({});
  }, []);

  return {
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
    acceptNewKey,
    addContact,
    removeContact,
    block,
    unblock,
    report,
    notifyTyping,
    forward,
    trusted,
    clearMemory,
  };
}
