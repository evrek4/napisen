// napisen - Cihaz kimliği (anahtar çifti) yönetimi
//
// Durumlar:
//  loading      : yükleniyor
//  ready        : bu cihazın anahtarı var ve sunucudaki ile aynı
//  needs-setup  : bu cihazda anahtar yok (ilk kurulum veya yeni cihaz)
//  stale        : bu cihazdaki anahtar artık sunucudaki ile aynı değil (başka cihazda yeni anahtar üretilmiş)

import { useCallback, useEffect, useState } from 'react';
import {
  generateIdentityKeyPair,
  exportPublicKey,
  exportPrivateKeyJwk,
  importPrivateKeyJwk,
  generateEphemeralKeyPair,
  openTransfer,
  sealTransfer,
  decodeTransferCode,
} from '../services/crypto';
import { getIdentity, saveIdentity, getTrustedContacts, saveTrustedContact } from '../services/db';
import {
  fetchUserProfile,
  publishPublicKey,
  subscribeTransfer,
  deleteTransfer,
  writeTransfer,
} from '../services/firebase';

const TRANSFER_MAX_AGE_MS = 10 * 60 * 1000;

export default function useIdentity(me) {
  const [state, setState] = useState({ status: 'loading', identity: null, publishedKey: null, error: '' });

  const load = useCallback(async () => {
    if (!me) return;
    setState((s) => (s.identity?.email === me.email ? s : { status: 'loading', identity: null, publishedKey: null, error: '' }));
    try {
      const [local, profile] = await Promise.all([getIdentity(me.email), fetchUserProfile(me.email)]);
      const publishedKey = profile?.publicKey || null;
      if (!local) {
        setState({ status: 'needs-setup', identity: null, publishedKey, error: '' });
        return;
      }
      if (!publishedKey) {
        await publishPublicKey(me.email, me.displayName, local.publicKey);
        setState({ status: 'ready', identity: local, publishedKey: local.publicKey, error: '' });
        return;
      }
      if (publishedKey !== local.publicKey) {
        setState({ status: 'stale', identity: local, publishedKey, error: '' });
        return;
      }
      // Görünen adı güncel tut
      if (profile.displayName !== (me.displayName || '').slice(0, 80)) {
        publishPublicKey(me.email, me.displayName, local.publicKey).catch(() => {});
      }
      setState({ status: 'ready', identity: local, publishedKey, error: '' });
    } catch (err) {
      console.error('Kimlik yüklenemedi:', err);
      setState((s) => ({ ...s, status: 'error', error: err.message || 'Kimlik yüklenemedi.' }));
    }
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  // Yeni anahtar üret ve yayınla (önceki cihazdaki anahtarı geçersiz kılar)
  const createNewIdentity = useCallback(async () => {
    const pair = await generateIdentityKeyPair();
    const identity = {
      email: me.email,
      privateKey: pair.privateKey,
      publicKey: await exportPublicKey(pair.publicKey),
      createdAt: Date.now(),
    };
    await saveIdentity(identity);
    await publishPublicKey(me.email, me.displayName, identity.publicKey);
    setState({ status: 'ready', identity, publishedKey: identity.publicKey, error: '' });
  }, [me]);

  // YENİ CİHAZ: geçici anahtar üret, eski cihazın şifreli paketi yazmasını bekle
  const startReceivingTransfer = useCallback(
    async (onCode, onDone, onError) => {
      const eph = await generateEphemeralKeyPair();
      const ephPub = await exportPublicKey(eph.publicKey);
      await deleteTransfer(me.email);
      const startedAt = Date.now();
      onCode(ephPub);

      const unsub = subscribeTransfer(me.email, async (sealed) => {
        try {
          const created = sealed.createdAt?.toMillis?.() || Date.now();
          if (created < startedAt - 5000 || Date.now() - created > TRANSFER_MAX_AGE_MS) return;
          const secret = await openTransfer(me.email, eph.privateKey, sealed);
          const privateKey = await importPrivateKeyJwk(secret.privateKey);
          const identity = {
            email: me.email,
            privateKey,
            publicKey: secret.publicKey,
            createdAt: secret.createdAt || Date.now(),
          };
          await saveIdentity(identity);
          for (const t of secret.trusted || []) {
            await saveTrustedContact(me.email, t.email, t.publicKey, t.method || 'transfer');
          }
          await deleteTransfer(me.email);
          unsub();
          setState({ status: 'ready', identity, publishedKey: identity.publicKey, error: '' });
          onDone?.();
        } catch (err) {
          console.error('Taşıma paketi açılamadı:', err);
          onError?.('Taşıma paketi açılamadı. QR kodu yenileyip tekrar deneyin.');
        }
      });
      return unsub;
    },
    [me]
  );

  // ESKİ CİHAZ: yeni cihazın QR kodunu okut ve kimliği ona şifreli gönder
  const sendTransfer = useCallback(
    async (codeText) => {
      const parsed = decodeTransferCode(codeText);
      if (!parsed) throw new Error('Bu bir napisen cihaz taşıma kodu değil.');
      if (parsed.email !== me.email) {
        throw new Error('Bu kod başka bir hesaba ait. Yalnızca kendi hesabınızı taşıyabilirsiniz.');
      }
      const identity = state.identity;
      if (!identity) throw new Error('Bu cihazda taşınacak anahtar yok.');
      const trusted = await getTrustedContacts(me.email);
      const sealed = await sealTransfer(me.email, parsed.ephPub, {
        privateKey: await exportPrivateKeyJwk(identity.privateKey),
        publicKey: identity.publicKey,
        createdAt: identity.createdAt,
        trusted: trusted.map((t) => ({ email: t.email, publicKey: t.publicKey, method: t.method })),
      });
      await writeTransfer(me.email, sealed);
    },
    [me, state.identity]
  );

  return { ...state, reload: load, createNewIdentity, startReceivingTransfer, sendTransfer };
}
