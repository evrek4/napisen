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
  Bytes,
} from 'firebase/firestore';

const PUB = (c) => 'B' + c.repeat(87); // 88 karakterlik sahte açık anahtar
const KEYS = { 'a@x.com': PUB('a'), 'b@x.com': PUB('b'), 'c@x.com': PUB('c') };
const CODES = { 'a@x.com': 'AAAA-2222', 'b@x.com': 'BBBB-2222', 'c@x.com': 'CCCC-2222' };

let env;
const ctx = (email, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore();

function message(from, to, extra = {}) {
  return {
    from,
    to,
    fromPub: KEYS[from],
    toPub: KEYS[to] || PUB('z'),
    fromCode: CODES[from] || 'ZZZZ-2222',
    toCode: CODES[to] || null,
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

const OWNER = 'achartave@gmail.com';

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const email of ['a@x.com', 'b@x.com', 'c@x.com']) {
      await setDoc(doc(db, 'allowlist', email), { admin: false, addedBy: OWNER, addedAt: new Date() });
    }
    await setDoc(doc(db, 'allowlist', 'adm@x.com'), { admin: true, addedBy: OWNER, addedAt: new Date() });
    for (const [email, publicKey] of Object.entries(KEYS)) {
      const code = CODES[email];
      await setDoc(doc(db, 'codes', code), { email, displayName: email, publicKey, updatedAt: new Date() });
      await setDoc(doc(db, 'users', email), {
        email,
        displayName: email,
        publicKey,
        code,
        discoverable: email === 'b@x.com', // yalnızca b e-postayla bulunabilir
        updatedAt: new Date(),
      });
    }
    await setDoc(doc(db, 'messages/m1'), { ...message('a@x.com', 'b@x.com'), createdAt: new Date() });
  });
});

const entry = (email, admin = false, by = OWNER) => ({ admin, addedBy: by, addedAt: serverTimestamp() });

describe('İzin listesi ve gizlilik', () => {
  it('listede olmayan kullanıcı hiçbir şey okuyamaz', async () => {
    const db = ctx('eve@x.com');
    await assertFails(getDoc(doc(db, 'allowlist/eve@x.com')));
    await assertFails(getDoc(doc(db, 'users/a@x.com')));
    await assertFails(getDocs(query(collection(db, 'messages'), where('to', '==', 'eve@x.com'))));
  });

  it('giriş yapmamış veya e-postası doğrulanmamış kullanıcı okuyamaz', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'allowlist/a@x.com')));
    await assertFails(getDoc(doc(ctx('b@x.com', false), 'allowlist/b@x.com')));
  });

  it('kullanıcı yalnızca kendi kaydını görür, listeyi ve başkalarının kaydını göremez', async () => {
    const db = ctx('b@x.com');
    await assertSucceeds(getDoc(doc(db, 'allowlist/b@x.com')));
    await assertFails(getDoc(doc(db, 'allowlist/a@x.com')));
    await assertFails(getDocs(collection(db, 'allowlist')));
  });

  it('kullanıcılar ve kodlar listelenemez', async () => {
    const db = ctx('b@x.com');
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDocs(collection(db, 'codes')));
  });

  it('e-postayla bulunma yalnızca kişi izin verdiyse çalışır', async () => {
    await assertFails(getDoc(doc(ctx('b@x.com'), 'users/a@x.com'))); // a kapalı
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'users/b@x.com'))); // b açık
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'users/a@x.com'))); // kendi profili
    await assertFails(getDoc(doc(ctx('a@x.com'), 'users/yok@x.com'))); // kayıtsız ile kapalı ayırt edilemez
  });

  it('kodu bilen izinli kullanıcı profili bulur; izinsiz kullanıcı bulamaz', async () => {
    await assertSucceeds(getDoc(doc(ctx('b@x.com'), 'codes/AAAA-2222')));
    await assertFails(getDoc(doc(ctx('eve@x.com'), 'codes/AAAA-2222')));
  });

  it('normal kullanıcı listeye kişi ekleyemez', async () => {
    await assertFails(setDoc(doc(ctx('b@x.com'), 'allowlist/eve@x.com'), entry('eve@x.com', false, 'b@x.com')));
    await assertFails(setDoc(doc(ctx('b@x.com'), 'allowlist/b@x.com'), entry('b@x.com', true, 'b@x.com')));
  });

  it('sahip, kaydı olmadan da girer, kendi kaydını oluşturur ve listeyi yönetir', async () => {
    const db = ctx(OWNER);
    await assertSucceeds(getDoc(doc(db, `allowlist/${OWNER}`)));
    await assertSucceeds(setDoc(doc(db, `allowlist/${OWNER}`), entry(OWNER, true)));
    await assertSucceeds(getDocs(collection(db, 'allowlist')));
    await assertSucceeds(setDoc(doc(db, 'allowlist/d@x.com'), entry('d@x.com')));
    await assertSucceeds(deleteDoc(doc(db, 'allowlist/d@x.com')));
    await assertFails(deleteDoc(doc(db, `allowlist/${OWNER}`)));
  });

  it('yönetici ekler/çıkarır; kendini çıkaramaz, yetkisini düşüremez, sahibi silemez', async () => {
    const db = ctx('adm@x.com');
    await assertSucceeds(getDocs(collection(db, 'allowlist')));
    await assertSucceeds(setDoc(doc(db, 'allowlist/d@x.com'), entry('d@x.com', false, 'adm@x.com')));
    await assertSucceeds(deleteDoc(doc(db, 'allowlist/d@x.com')));
    await assertFails(deleteDoc(doc(db, 'allowlist/adm@x.com')));
    await assertFails(setDoc(doc(db, 'allowlist/adm@x.com'), entry('adm@x.com', false, 'adm@x.com')));
    await assertFails(deleteDoc(doc(db, `allowlist/${OWNER}`)));
  });

  it('büyük harfli / geçersiz adres ve sahte "addedBy" reddedilir', async () => {
    const db = ctx(OWNER);
    await assertFails(setDoc(doc(db, 'allowlist/Big@x.com'), entry('Big@x.com')));
    await assertFails(setDoc(doc(db, 'allowlist/bozuk'), entry('bozuk')));
    await assertFails(setDoc(doc(db, 'allowlist/e@x.com'), entry('e@x.com', false, 'b@x.com')));
  });

  it('eski config belgeleri kimseye açık değil', async () => {
    await assertFails(getDoc(doc(ctx(OWNER), 'config/allowlist')));
  });
});

describe('Kişi kodları ve profiller', () => {
  const pub = (email, publicKey = PUB('n')) => ({ email, displayName: 'X', publicKey, updatedAt: serverTimestamp() });

  it('kullanıcı kendine kod alabilir; başkası adına veya başkasının kodunun üzerine yazamaz', async () => {
    const db = ctx('b@x.com');
    await assertSucceeds(setDoc(doc(db, 'codes/BXYZ-3456'), pub('b@x.com')));
    await assertFails(setDoc(doc(db, 'codes/BXYZ-3457'), pub('a@x.com')));
    await assertFails(setDoc(doc(db, 'codes/AAAA-2222'), pub('b@x.com')));
  });

  it('geçersiz biçimli kod reddedilir', async () => {
    await assertFails(setDoc(doc(ctx('b@x.com'), 'codes/abc'), pub('b@x.com')));
    await assertFails(setDoc(doc(ctx('b@x.com'), 'codes/OOOO-1111'), pub('b@x.com')));
  });

  it('kod yalnızca sahibince silinir', async () => {
    await assertFails(deleteDoc(doc(ctx('b@x.com'), 'codes/AAAA-2222')));
    await assertSucceeds(deleteDoc(doc(ctx('a@x.com'), 'codes/AAAA-2222')));
  });

  it('profil yalnızca kendi kodunu gösterebilir', async () => {
    const db = ctx('b@x.com');
    const data = (code) => ({ ...pub('b@x.com'), code, discoverable: false });
    await assertSucceeds(setDoc(doc(db, 'users/b@x.com'), data('BBBB-2222')));
    await assertFails(setDoc(doc(db, 'users/b@x.com'), data('AAAA-2222')));
    await assertFails(setDoc(doc(db, 'users/a@x.com'), { ...data('AAAA-2222'), email: 'a@x.com' }));
  });
});

describe('Mesajlar', () => {
  it('kendi adına gönderebilir, başkası adına gönderemez', async () => {
    const db = ctx('a@x.com');
    await assertSucceeds(setDoc(doc(db, 'messages/m2'), message('a@x.com', 'b@x.com')));
    await assertFails(setDoc(doc(db, 'messages/m3'), message('b@x.com', 'c@x.com')));
  });

  it('yayınlanmış anahtarından / kodundan farklı gönderici bilgisi reddedilir', async () => {
    const db = ctx('a@x.com');
    await assertFails(setDoc(doc(db, 'messages/m4'), message('a@x.com', 'b@x.com', { fromPub: PUB('q') })));
    await assertFails(setDoc(doc(db, 'messages/m4b'), message('a@x.com', 'b@x.com', { fromCode: 'BBBB-2222' })));
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
