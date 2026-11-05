import { describe, it, expect } from 'vitest';
import {
  generateIdentityKeyPair,
  exportPublicKey,
  deriveConversationKey,
  encryptJSON,
  decryptJSON,
  encryptBytes,
  decryptBytes,
  computeSafetyNumber,
  encodeVerifyCode,
  decodeVerifyCode,
  encodeTransferCode,
  decodeTransferCode,
  generateEphemeralKeyPair,
  sealTransfer,
  openTransfer,
  exportPrivateKeyJwk,
  importPrivateKeyJwk,
} from '../src/services/crypto.js';

async function user(email) {
  const pair = await generateIdentityKeyPair();
  return { email, pair, pub: await exportPublicKey(pair.publicKey) };
}

describe('E2EE', () => {
  it('iki taraf aynı sohbet anahtarını türetir ve mesajı çözer', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const kA = await deriveConversationKey(a.pair.privateKey, b.pub, a.email, b.email);
    const kB = await deriveConversationKey(b.pair.privateKey, a.pub, b.email, a.email);
    const pkg = await encryptJSON(kA, { text: 'Merhaba ğüşiöç 🔒' }, 'id1|a|b');
    expect(await decryptJSON(kB, pkg, 'id1|a|b')).toEqual({ text: 'Merhaba ğüşiöç 🔒' });
  });

  it('üçüncü kişi (yalnızca e-postaları bilen) mesajı çözemez', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const eve = await user('eve@x.com');
    const kA = await deriveConversationKey(a.pair.privateKey, b.pub, a.email, b.email);
    const kEve = await deriveConversationKey(eve.pair.privateKey, a.pub, b.email, a.email);
    const pkg = await encryptJSON(kA, { text: 'gizli' }, 'aad');
    await expect(decryptJSON(kEve, pkg, 'aad')).rejects.toThrow();
  });

  it('AAD farklıysa (mesaj yer değiştirme) çözme başarısız olur', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const k = await deriveConversationKey(a.pair.privateKey, b.pub, a.email, b.email);
    const pkg = await encryptJSON(k, { text: 'x' }, 'm1|a|b');
    await expect(decryptJSON(k, pkg, 'm2|a|b')).rejects.toThrow();
  });

  it('her şifrelemede farklı IV kullanılır', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const k = await deriveConversationKey(a.pair.privateKey, b.pub, a.email, b.email);
    const p1 = await encryptJSON(k, 'aynı', 'x');
    const p2 = await encryptJSON(k, 'aynı', 'x');
    expect(p1.iv).not.toBe(p2.iv);
    expect(p1.ct).not.toBe(p2.ct);
  });

  it('büyük ikili medya şifrelenip çözülür', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const k = await deriveConversationKey(a.pair.privateKey, b.pub, a.email, b.email);
    const data = new Uint8Array(2_000_000);
    for (let i = 0; i < data.length; i += 65536) crypto.getRandomValues(data.subarray(i, i + 65536));
    const sealed = await encryptBytes(k, data, 'm|media');
    const plain = await decryptBytes(k, sealed.iv, sealed.data, 'm|media');
    expect(plain).toEqual(data);
  });
});

describe('Güvenlik numarası ve kodlar', () => {
  it('güvenlik numarası iki tarafta aynıdır, anahtar değişince değişir', async () => {
    const a = await user('a@x.com');
    const b = await user('b@x.com');
    const c = await user('b@x.com');
    const n1 = await computeSafetyNumber(a.email, a.pub, b.email, b.pub);
    const n2 = await computeSafetyNumber(b.email, b.pub, a.email, a.pub);
    const n3 = await computeSafetyNumber(a.email, a.pub, c.email, c.pub);
    expect(n1).toEqual(n2);
    expect(n1).toHaveLength(12);
    n1.forEach((g) => expect(g).toMatch(/^\d{5}$/));
    expect(n1).not.toEqual(n3);
  });

  it('doğrulama kodu kodlanır/çözülür', async () => {
    const a = await user('Ali@X.com');
    const code = encodeVerifyCode(a.email, a.pub);
    expect(decodeVerifyCode(code)).toEqual({ code: null, email: 'ali@x.com', publicKey: a.pub });
    const v2 = encodeVerifyCode(a.email, a.pub, '7K3Q-9XW2');
    expect(decodeVerifyCode(v2)).toEqual({ code: '7K3Q-9XW2', email: 'ali@x.com', publicKey: a.pub });
    expect(decodeVerifyCode('rastgele metin')).toBeNull();
    expect(decodeTransferCode(code)).toBeNull();
  });
});

describe('Cihaz taşıma', () => {
  it('kimlik yalnızca yeni cihazın geçici anahtarıyla açılır', async () => {
    const me = await user('a@x.com');
    const newDevice = await generateEphemeralKeyPair();
    const code = encodeTransferCode(me.email, await exportPublicKey(newDevice.publicKey));
    const { ephPub } = decodeTransferCode(code);

    const secret = { privateKey: await exportPrivateKeyJwk(me.pair.privateKey), publicKey: me.pub };
    const sealed = await sealTransfer(me.email, ephPub, secret);
    expect(JSON.stringify(sealed)).not.toContain(secret.privateKey.d);

    const opened = await openTransfer(me.email, newDevice.privateKey, sealed);
    const imported = await importPrivateKeyJwk(opened.privateKey);

    // Taşınan anahtarla sohbet anahtarı aynı çıkmalı
    const b = await user('b@x.com');
    const k1 = await deriveConversationKey(me.pair.privateKey, b.pub, me.email, b.email);
    const k2 = await deriveConversationKey(imported, b.pub, me.email, b.email);
    const pkg = await encryptJSON(k1, 'ok', 'x');
    expect(await decryptJSON(k2, pkg, 'x')).toBe('ok');

    const attacker = await generateEphemeralKeyPair();
    await expect(openTransfer(me.email, attacker.privateKey, sealed)).rejects.toThrow();
  });
});
