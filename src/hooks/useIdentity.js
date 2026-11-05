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
import {
  getIdentity,
  saveIdentity,
  getTrustedContacts,
  saveTrustedContact,
  getMyContacts,
  saveMyContact,
} from '../services/db';
import {
  fetchMyProfile,
  publishProfile,
  deleteCode,
  subscribeMyProfile,
  subscribeTransfer,
  deleteTransfer,
  writeTransfer,
} from '../services/firebase';

const TRANSFER_MAX_AGE_MS = 10 * 60 * 1000;

export default function useIdentity(me) {
  const [state, setState] = useState({
    status: 'loading',
    identity: null,
    publishedKey: null,
    profile: null,
    error: '',
  });

  const publish = useCallback(
    async (publicKey, overrides = {}) => {
      const current = overrides.profile || {};
      // Bu ekrana yalnızca güncel koşullar onaylandıktan sonra gelinir
      const termsVersion = me.terms.version;
      const termsAcceptedAt =
        current.termsVersion === termsVersion && current.termsAcceptedAt ? current.termsAcceptedAt : 'now';
      const code = await publishProfile({
        email: me.email,
        displayName: me.displayName,
        publicKey,
        code: 'code' in overrides ? overrides.code : current.code,
        discoverable: overrides.discoverable ?? current.discoverable ?? false,
        termsVersion,
        termsAcceptedAt,
      });
      return {
        code,
        discoverable: overrides.discoverable ?? current.discoverable ?? false,
        publicKey,
        displayName: (me.displayName || '').slice(0, 80),
        termsVersion,
        termsAcceptedAt: termsAcceptedAt === 'now' ? null : termsAcceptedAt,
      };
    },
    [me]
  );

  const load = useCallback(async () => {
    if (!me) return;
    setState((s) =>
      s.identity?.email === me.email
        ? s
        : { status: 'loading', identity: null, publishedKey: null, profile: null, error: '' }
    );
    try {
      const [local, profile] = await Promise.all([getIdentity(me.email), fetchMyProfile(me.email)]);
      const publishedKey = profile?.publicKey || null;
      if (!local) {
        setState({ status: 'needs-setup', identity: null, publishedKey, profile, error: '' });
        return;
      }
      if (publishedKey && publishedKey !== local.publicKey) {
        setState({ status: 'stale', identity: local, publishedKey, profile, error: '' });
        return;
      }
      let current = profile;
      // İlk yayın, eski sürümden kalan kodsuz profil veya değişen görünen ad
      if (
        !profile ||
        !profile.code ||
        profile.termsVersion !== me.terms.version ||
        profile.displayName !== (me.displayName || '').slice(0, 80)
      ) {
        current = await publish(local.publicKey, { profile: profile || {} });
      }
      setState({ status: 'ready', identity: local, publishedKey: local.publicKey, profile: current, error: '' });
    } catch (err) {
      console.error('Kimlik yüklenemedi:', err);
      setState((s) => ({ ...s, status: 'error', error: err.message || 'Kimlik yüklenemedi.' }));
    }
  }, [me, publish]);

  useEffect(() => {
    load();
  }, [load]);

  // Hazırken kendi profilini izle: başka cihazda yeni anahtar üretildiyse bu cihaz "eski" olur
  const readyKey = state.status === 'ready' ? state.identity?.publicKey : null;
  useEffect(() => {
    if (!me || !readyKey) return undefined;
    return subscribeMyProfile(me.email, (profile) => {
      if (!profile) return;
      if (profile.publicKey && profile.publicKey !== readyKey) {
        setState((s) => ({ ...s, status: 'stale', publishedKey: profile.publicKey, profile }));
      } else {
        setState((s) =>
          s.status === 'ready' &&
          (s.profile?.code !== profile.code || s.profile?.discoverable !== profile.discoverable)
            ? { ...s, profile: { ...s.profile, code: profile.code, discoverable: profile.discoverable } }
            : s
        );
      }
    });
  }, [me, readyKey]);

  // Yeni anahtar üret ve yayınla (önceki cihazdaki anahtarı geçersiz kılar). Kod korunur.
  const createNewIdentity = useCallback(async () => {
    const pair = await generateIdentityKeyPair();
    const identity = {
      email: me.email,
      privateKey: pair.privateKey,
      publicKey: await exportPublicKey(pair.publicKey),
      createdAt: Date.now(),
    };
    const existing = await fetchMyProfile(me.email).catch(() => null);
    const profile = await publish(identity.publicKey, { profile: existing || {} });
    await saveIdentity(identity);
    setState({ status: 'ready', identity, publishedKey: identity.publicKey, profile, error: '' });
  }, [me, publish]);

  // "E-posta adresimle bulunabilirim" ayarı
  const setDiscoverable = useCallback(
    async (discoverable) => {
      const profile = await publish(state.identity.publicKey, { profile: state.profile, discoverable });
      setState((s) => ({ ...s, profile }));
    },
    [publish, state.identity, state.profile]
  );

  // Yeni kişi kodu al; eski kod artık çalışmaz
  const regenerateCode = useCallback(async () => {
    const oldCode = state.profile?.code;
    const profile = await publish(state.identity.publicKey, { profile: state.profile, code: null });
    if (oldCode && oldCode !== profile.code) await deleteCode(oldCode);
    setState((s) => ({ ...s, profile }));
    return profile.code;
  }, [publish, state.identity, state.profile]);

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
            await saveTrustedContact(me.email, t.email, t.publicKey, t.method || 'tofu', t.verified);
          }
          for (const c of secret.contacts || []) {
            await saveMyContact(me.email, c.email, c.name, c.code);
          }
          await deleteTransfer(me.email);
          unsub();
          let profile = await fetchMyProfile(me.email).catch(() => null);
          if (profile?.publicKey === identity.publicKey && profile.termsVersion !== me.terms.version) {
            profile = await publish(identity.publicKey, { profile });
          }
          setState({ status: 'ready', identity, publishedKey: identity.publicKey, profile, error: '' });
          onDone?.();
        } catch (err) {
          console.error('Taşıma paketi açılamadı:', err);
          onError?.('Taşıma paketi açılamadı. QR kodu yenileyip tekrar deneyin.');
        }
      });
      return unsub;
    },
    [me, publish]
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
      const contacts = await getMyContacts(me.email);
      const sealed = await sealTransfer(me.email, parsed.ephPub, {
        privateKey: await exportPrivateKeyJwk(identity.privateKey),
        publicKey: identity.publicKey,
        createdAt: identity.createdAt,
        trusted: trusted.map((t) => ({
          email: t.email,
          publicKey: t.publicKey,
          method: t.method,
          verified: t.verified ?? t.method !== 'tofu',
        })),
        contacts: contacts.map((c) => ({ email: c.email, name: c.name, code: c.code })),
      });
      await writeTransfer(me.email, sealed);
    },
    [me, state.identity]
  );

  return {
    ...state,
    reload: load,
    createNewIdentity,
    startReceivingTransfer,
    sendTransfer,
    setDiscoverable,
    regenerateCode,
  };
}
