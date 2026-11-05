// Firestore güvenlik kuralı testleri — emülatör gerektirir: npm run test:rules
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  Bytes,
} from 'firebase/firestore';

const PUB = (c) => 'B' + c.repeat(87); // 88 karakterlik sahte açık anahtar
const KEYS = { 'a@x.com': PUB('a'), 'b@x.com': PUB('b'), 'c@x.com': PUB('c') };

let env;
const ctx = (email, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore();

function message(from, to, extra = {}) {
  return {
    from,
    to,
    fromPub: KEYS[from],
    toPub: KEYS[to] || PUB('z'),
    keepOnServer: false,
    header: { iv: 'aXY=', ct: 'Y3Q=' },
    media: null,
    status: 'sent',
    createdAt: serverTimestamp(),
    ...extra,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-napisen',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'config/allowlist'), { emails: ['a@x.com', 'b@x.com', 'c@x.com'], admins: ['a@x.com'] });
    for (const [email, publicKey] of Object.entries(KEYS)) {
      await setDoc(doc(db, 'users', email), { email, displayName: email, publicKey, updatedAt: new Date() });
    }
    await setDoc(doc(db, 'messages/m1'), { ...message('a@x.com', 'b@x.com'), createdAt: new Date() });
  });
});

describe('İzin listesi', () => {
  it('listede olmayan kullanıcı hiçbir şey okuyamaz', async () => {
    const db = ctx('eve@x.com');
    await assertFails(getDoc(doc(db, 'config/allowlist')));
    await assertFails(getDoc(doc(db, 'users/a@x.com')));
    await assertFails(getDocs(query(collection(db, 'messages'), where('to', '==', 'eve@x.com'))));
  });

  it('giriş yapmamış kullanıcı okuyamaz', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/allowlist')));
  });

  it('e-postası doğrulanmamış hesap okuyamaz', async () => {
    await assertFails(getDoc(doc(ctx('b@x.com', false), 'config/allowlist')));
  });

  it('listedeki kullanıcı okuyabilir ama değiştiremez', async () => {
    const db = ctx('b@x.com');
    await assertSucceeds(getDoc(doc(db, 'config/allowlist')));
    await assertFails(updateDoc(doc(db, 'config/allowlist'), { emails: arrayUnion('eve@x.com') }));
  });

  it('yönetici kişi ekleyebilir ama kendini yöneticilikten çıkaramaz', async () => {
    const db = ctx('a@x.com');
    await assertSucceeds(updateDoc(doc(db, 'config/allowlist'), { emails: arrayUnion('d@x.com') }));
    await assertFails(updateDoc(doc(db, 'config/allowlist'), { admins: [] }));
  });
});

describe('Açık anahtarlar', () => {
  it('kullanıcı yalnızca kendi anahtarını yayınlayabilir', async () => {
    const db = ctx('b@x.com');
    const data = { email: 'b@x.com', displayName: 'B', publicKey: PUB('n'), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, 'users/b@x.com'), data));
    await assertFails(setDoc(doc(db, 'users/a@x.com'), { ...data, email: 'a@x.com' }));
  });
});

describe('Mesajlar', () => {
  it('kendi adına gönderebilir, başkası adına gönderemez', async () => {
    const db = ctx('a@x.com');
    await assertSucceeds(setDoc(doc(db, 'messages/m2'), message('a@x.com', 'b@x.com')));
    await assertFails(setDoc(doc(db, 'messages/m3'), message('b@x.com', 'c@x.com')));
  });

  it('yayınlanmış anahtarından farklı bir gönderici anahtarı reddedilir', async () => {
    const db = ctx('a@x.com');
    await assertFails(setDoc(doc(db, 'messages/m4'), message('a@x.com', 'b@x.com', { fromPub: PUB('q') })));
  });

  it('izin listesinde olmayan kişiye gönderilemez', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m5'), message('a@x.com', 'eve@x.com')));
  });

  it('beklenmeyen alanlar ve teslim edilmiş durumla oluşturma reddedilir', async () => {
    const db = ctx('a@x.com');
    await assertFails(setDoc(doc(db, 'messages/m6'), message('a@x.com', 'b@x.com', { plain: 'x' })));
    await assertFails(setDoc(doc(db, 'messages/m7'), message('a@x.com', 'b@x.com', { status: 'delivered' })));
  });

  it('var olan mesajın üzerine yazılamaz', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m1'), message('a@x.com', 'b@x.com')));
  });

  it('alıcı ve gönderen okuyabilir, üçüncü kişi okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(ctx('b@x.com'), 'messages/m1')));
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'messages/m1')));
    await assertFails(getDoc(doc(ctx('c@x.com'), 'messages/m1')));
  });

  it('gelen/giden kutusu sorguları çalışır, başkasının kutusu sorgulanamaz', async () => {
    await assertSucceeds(getDocs(query(collection(ctx('b@x.com'), 'messages'), where('to', '==', 'b@x.com'))));
    await assertSucceeds(getDocs(query(collection(ctx('a@x.com'), 'messages'), where('from', '==', 'a@x.com'))));
    await assertFails(getDocs(query(collection(ctx('c@x.com'), 'messages'), where('to', '==', 'b@x.com'))));
    await assertFails(getDocs(collection(ctx('c@x.com'), 'messages')));
  });

  it('yalnızca alıcı "teslim edildi" işaretleyebilir ve başka alanı değiştiremez', async () => {
    await assertFails(updateDoc(doc(ctx('a@x.com'), 'messages/m1'), { status: 'delivered' }));
    await assertFails(updateDoc(doc(ctx('b@x.com'), 'messages/m1'), { status: 'delivered', to: 'c@x.com' }));
    await assertSucceeds(updateDoc(doc(ctx('b@x.com'), 'messages/m1'), { status: 'delivered' }));
  });

  it('üçüncü kişi mesajı silemez, alıcı silebilir', async () => {
    await assertFails(deleteDoc(doc(ctx('c@x.com'), 'messages/m1')));
    await assertSucceeds(deleteDoc(doc(ctx('b@x.com'), 'messages/m1')));
  });

  it('medya parçaları yalnızca taraflarca okunur', async () => {
    const chunk = { from: 'a@x.com', to: 'b@x.com', data: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])) };
    await assertSucceeds(setDoc(doc(ctx('a@x.com'), 'messages/m8/chunks/0'), chunk));
    await assertFails(setDoc(doc(ctx('c@x.com'), 'messages/m8/chunks/1'), chunk));
    await assertSucceeds(getDoc(doc(ctx('b@x.com'), 'messages/m8/chunks/0')));
    await assertFails(getDoc(doc(ctx('c@x.com'), 'messages/m8/chunks/0')));
  });
});

describe('Cihaz taşıma', () => {
  it('yalnızca hesap sahibi taşıma paketini yazıp okuyabilir', async () => {
    const pkg = { oldPub: PUB('o'), iv: 'aXY=', ct: 'Y3Q=', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx('a@x.com'), 'transfers/a@x.com'), pkg));
    await assertFails(setDoc(doc(ctx('b@x.com'), 'transfers/a@x.com'), pkg));
    await assertFails(getDoc(doc(ctx('b@x.com'), 'transfers/a@x.com')));
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'transfers/a@x.com')));
  });
});
