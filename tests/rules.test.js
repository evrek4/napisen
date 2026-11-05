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
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Bytes,
} from 'firebase/firestore';

const OWNER = 'achartave@gmail.com';
const PUB = (c) => 'B' + c.repeat(87); // 88 karakterlik sahte açık anahtar
const USERS = {
  'a@x.com': { key: PUB('a'), code: 'AAAA-2222', discoverable: false },
  'b@x.com': { key: PUB('b'), code: 'BBBB-2222', discoverable: true },
  'c@x.com': { key: PUB('c'), code: 'CCCC-2222', discoverable: false },
  'mod@x.com': { key: PUB('m'), code: 'MMMM-2222', discoverable: false },
  [OWNER]: { key: PUB('o'), code: 'QQQQ-2222', discoverable: false },
};

let env;
const ctx = (email, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore();

function message(from, to, extra = {}) {
  return {
    from,
    to,
    fromPub: USERS[from]?.key || PUB('z'),
    toPub: USERS[to]?.key || PUB('z'),
    fromCode: USERS[from]?.code || 'ZZZZ-2222',
    toCode: USERS[to]?.code || null,
    keepOnServer: false,
    header: { iv: 'aXY=', ct: 'Y3Q=' },
    media: null,
    status: 'sent',
    createdAt: serverTimestamp(),
    ...extra,
  };
}

const profile = (email, code, extra = {}) => ({
  email,
  displayName: 'X',
  publicKey: PUB('n'),
  code,
  discoverable: false,
  termsVersion: '2026-11-05',
  termsAcceptedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});
const pub = (email) => ({ email, displayName: 'X', publicKey: PUB('n'), updatedAt: serverTimestamp() });

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
    for (const [email, u] of Object.entries(USERS)) {
      await setDoc(doc(db, 'codes', u.code), { email, displayName: email, publicKey: u.key, updatedAt: new Date() });
      await setDoc(doc(db, 'users', email), {
        email,
        displayName: email,
        publicKey: u.key,
        code: u.code,
        discoverable: u.discoverable,
        termsVersion: '2026-11-05',
        termsAcceptedAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await setDoc(doc(db, 'roles/mod@x.com'), { role: 'moderator', grantedBy: OWNER, grantedAt: new Date() });
    await setDoc(doc(db, 'messages/m1'), { ...message('a@x.com', 'b@x.com'), createdAt: new Date() });
    await setDoc(doc(db, 'reports/r1'), {
      reporter: 'a@x.com',
      reported: 'c@x.com',
      reason: 'spam',
      details: '',
      evidence: [],
      status: 'open',
      createdAt: new Date(),
    });
  });
});

describe('Açık kayıt ve koşul onayı', () => {
  it('yeni kullanıcı kod alıp koşulları kabul ederek üye olabilir', async () => {
    const db = ctx('yeni@x.com');
    await assertSucceeds(setDoc(doc(db, 'codes/NNNN-2222'), pub('yeni@x.com')));
    await assertSucceeds(setDoc(doc(db, 'users/yeni@x.com'), profile('yeni@x.com', 'NNNN-2222')));
  });

  it('koşullar kabul edilmeden profil oluşturulamaz', async () => {
    const db = ctx('yeni@x.com');
    await assertSucceeds(setDoc(doc(db, 'codes/NNNN-2222'), pub('yeni@x.com')));
    const p = profile('yeni@x.com', 'NNNN-2222');
    delete p.termsVersion;
    delete p.termsAcceptedAt;
    await assertFails(setDoc(doc(db, 'users/yeni@x.com'), p));
  });

  it('giriş yapmamış veya e-postası doğrulanmamış kullanıcı okuyamaz', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'codes/AAAA-2222')));
    await assertFails(getDoc(doc(ctx('b@x.com', false), 'codes/AAAA-2222')));
  });
});

describe('Gizlilik: listeleme ve bulma', () => {
  it('kullanıcılar, kodlar, roller, askılar ve şikâyetler normal kullanıcıya listelenmez', async () => {
    const db = ctx('a@x.com');
    for (const c of ['users', 'codes', 'roles', 'bans', 'reports']) {
      await assertFails(getDocs(collection(db, c)));
    }
  });

  it('e-postayla bulunma yalnızca kişi izin verdiyse çalışır', async () => {
    await assertFails(getDoc(doc(ctx('b@x.com'), 'users/a@x.com')));
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'users/b@x.com')));
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'users/a@x.com')));
    await assertFails(getDoc(doc(ctx('a@x.com'), 'users/yok@x.com')));
  });

  it('kodu bilen kullanıcı profili bulur', async () => {
    await assertSucceeds(getDoc(doc(ctx('b@x.com'), 'codes/AAAA-2222')));
  });

  it('başkasının kodunun üzerine yazılamaz, başkası adına kod alınamaz, geçersiz kod reddedilir', async () => {
    const db = ctx('b@x.com');
    await assertFails(setDoc(doc(db, 'codes/AAAA-2222'), pub('b@x.com')));
    await assertFails(setDoc(doc(db, 'codes/BXYZ-3457'), pub('a@x.com')));
    await assertFails(setDoc(doc(db, 'codes/OOOO-1111'), pub('b@x.com')));
  });

  it('profil yalnızca kendi kodunu gösterebilir', async () => {
    const db = ctx('b@x.com');
    await assertSucceeds(setDoc(doc(db, 'users/b@x.com'), profile('b@x.com', 'BBBB-2222')));
    await assertFails(setDoc(doc(db, 'users/b@x.com'), profile('b@x.com', 'AAAA-2222')));
    await assertFails(setDoc(doc(db, 'users/a@x.com'), profile('a@x.com', 'AAAA-2222')));
  });
});

describe('Roller', () => {
  it('yalnızca admin moderatör atar ve kaldırır', async () => {
    const role = { role: 'moderator', grantedBy: OWNER, grantedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx(OWNER), 'roles/b@x.com'), role));
    await assertSucceeds(getDocs(collection(ctx(OWNER), 'roles')));
    await assertFails(setDoc(doc(ctx('mod@x.com'), 'roles/c@x.com'), { ...role, grantedBy: 'mod@x.com' }));
    await assertFails(setDoc(doc(ctx('a@x.com'), 'roles/a@x.com'), { ...role, grantedBy: 'a@x.com' }));
    await assertFails(setDoc(doc(ctx(OWNER), 'roles/c@x.com'), { ...role, role: 'admin' }));
    await assertSucceeds(deleteDoc(doc(ctx(OWNER), 'roles/b@x.com')));
  });

  it('kullanıcı kendi rolünü okuyabilir, başkasınınkini okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(ctx('mod@x.com'), 'roles/mod@x.com')));
    await assertFails(getDoc(doc(ctx('a@x.com'), 'roles/mod@x.com')));
  });
});

describe('Askıya alma', () => {
  const ban = (by) => ({ reason: 'spam', by, at: serverTimestamp() });

  it('moderatör kullanıcıyı askıya alır; askıdaki kullanıcı hiçbir şey yapamaz', async () => {
    await assertSucceeds(setDoc(doc(ctx('mod@x.com'), 'bans/c@x.com'), ban('mod@x.com')));
    const c = ctx('c@x.com');
    await assertSucceeds(getDoc(doc(c, 'bans/c@x.com'))); // nedenini görebilir
    await assertFails(getDoc(doc(c, 'codes/AAAA-2222')));
    await assertFails(setDoc(doc(c, 'messages/m9'), message('c@x.com', 'a@x.com')));
    // Askıdaki kişiye de mesaj gönderilemez
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m10'), message('a@x.com', 'c@x.com')));
  });

  it('normal kullanıcı askıya alamaz; moderatör admini ve diğer moderatörü askıya alamaz', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'bans/c@x.com'), ban('a@x.com')));
    await assertFails(setDoc(doc(ctx('mod@x.com'), `bans/${OWNER}`), ban('mod@x.com')));
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), 'roles/mod2@x.com'), { role: 'moderator', grantedBy: OWNER, grantedAt: new Date() })
    );
    await assertFails(setDoc(doc(ctx('mod@x.com'), 'bans/mod2@x.com'), ban('mod@x.com')));
    await assertSucceeds(setDoc(doc(ctx(OWNER), 'bans/mod2@x.com'), ban(OWNER)));
  });

  it('moderatör askıları listeler ve kaldırır', async () => {
    await assertSucceeds(setDoc(doc(ctx('mod@x.com'), 'bans/c@x.com'), ban('mod@x.com')));
    await assertSucceeds(getDocs(collection(ctx('mod@x.com'), 'bans')));
    await assertSucceeds(deleteDoc(doc(ctx('mod@x.com'), 'bans/c@x.com')));
  });
});

describe('Engelleme', () => {
  it('engellenen kişi mesaj ve medya gönderemez; engel kaldırılınca gönderebilir', async () => {
    await assertSucceeds(setDoc(doc(ctx('b@x.com'), 'blocks/b@x.com/list/a@x.com'), { at: serverTimestamp() }));
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m2'), message('a@x.com', 'b@x.com')));
    await assertFails(
      setDoc(doc(ctx('a@x.com'), 'messages/m2/chunks/0'), {
        from: 'a@x.com',
        to: 'b@x.com',
        data: Bytes.fromUint8Array(new Uint8Array([1])),
      })
    );
    await assertSucceeds(deleteDoc(doc(ctx('b@x.com'), 'blocks/b@x.com/list/a@x.com')));
    await assertSucceeds(setDoc(doc(ctx('a@x.com'), 'messages/m3'), message('a@x.com', 'b@x.com')));
  });

  it('başkası adına engel oluşturulamaz, başkasının engel listesi okunamaz', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'blocks/b@x.com/list/c@x.com'), { at: serverTimestamp() }));
    await assertFails(getDocs(collection(ctx('a@x.com'), 'blocks/b@x.com/list')));
  });
});

describe('Şikâyetler', () => {
  const report = (reporter, extra = {}) => ({
    reporter,
    reported: 'c@x.com',
    reason: 'harassment',
    details: 'rahatsız ediyor',
    evidence: [{ type: 'text', text: 'kötü mesaj', at: 1 }],
    status: 'open',
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('kullanıcı şikâyet oluşturur ama okuyamaz; başkası adına oluşturamaz', async () => {
    await assertSucceeds(addDoc(collection(ctx('a@x.com'), 'reports'), report('a@x.com')));
    await assertFails(addDoc(collection(ctx('a@x.com'), 'reports'), report('b@x.com')));
    await assertFails(addDoc(collection(ctx('a@x.com'), 'reports'), report('a@x.com', { status: 'resolved' })));
    await assertFails(getDoc(doc(ctx('a@x.com'), 'reports/r1')));
  });

  it('moderatör açık şikâyetleri görür ve sonuçlandırır', async () => {
    const db = ctx('mod@x.com');
    await assertSucceeds(getDocs(query(collection(db, 'reports'), where('status', '==', 'open'))));
    await assertSucceeds(
      updateDoc(doc(db, 'reports/r1'), {
        status: 'dismissed',
        resolution: 'geçersiz',
        resolvedBy: 'mod@x.com',
        resolvedAt: serverTimestamp(),
      })
    );
    await assertFails(updateDoc(doc(db, 'reports/r1'), { reason: 'other' }));
  });
});

describe('Mesajlar', () => {
  it('kendi adına gönderebilir, başkası adına gönderemez', async () => {
    await assertSucceeds(setDoc(doc(ctx('a@x.com'), 'messages/m2'), message('a@x.com', 'b@x.com')));
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m3'), message('b@x.com', 'c@x.com')));
  });

  it('yayınlanmış anahtarından / kodundan farklı gönderici bilgisi reddedilir', async () => {
    const db = ctx('a@x.com');
    await assertFails(setDoc(doc(db, 'messages/m4'), message('a@x.com', 'b@x.com', { fromPub: PUB('q') })));
    await assertFails(setDoc(doc(db, 'messages/m4b'), message('a@x.com', 'b@x.com', { fromCode: 'BBBB-2222' })));
  });

  it('kayıtlı olmayan kişiye gönderilemez', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m5'), message('a@x.com', 'yok@x.com')));
  });

  it('beklenmeyen alanlar ve teslim edilmiş durumla oluşturma reddedilir', async () => {
    const db = ctx('a@x.com');
    await assertFails(setDoc(doc(db, 'messages/m6'), message('a@x.com', 'b@x.com', { plain: 'x' })));
    await assertFails(setDoc(doc(db, 'messages/m7'), message('a@x.com', 'b@x.com', { status: 'delivered' })));
  });

  it('var olan mesajın üzerine yazılamaz', async () => {
    await assertFails(setDoc(doc(ctx('a@x.com'), 'messages/m1'), message('a@x.com', 'b@x.com')));
  });

  it('alıcı ve gönderen okuyabilir, üçüncü kişi ve moderatör okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(ctx('b@x.com'), 'messages/m1')));
    await assertSucceeds(getDoc(doc(ctx('a@x.com'), 'messages/m1')));
    await assertFails(getDoc(doc(ctx('c@x.com'), 'messages/m1')));
    await assertFails(getDoc(doc(ctx('mod@x.com'), 'messages/m1')));
  });

  it('gelen/giden kutusu sorguları çalışır, başkasının kutusu sorgulanamaz', async () => {
    await assertSucceeds(getDocs(query(collection(ctx('b@x.com'), 'messages'), where('to', '==', 'b@x.com'))));
    await assertSucceeds(getDocs(query(collection(ctx('a@x.com'), 'messages'), where('from', '==', 'a@x.com'))));
    await assertFails(getDocs(query(collection(ctx('c@x.com'), 'messages'), where('to', '==', 'b@x.com'))));
    await assertFails(getDocs(collection(ctx('c@x.com'), 'messages')));
  });

  it('yalnızca alıcı "teslim edildi" işaretleyebilir', async () => {
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

describe('Hesap silme', () => {
  it('kullanıcı kendi profilini ve kodunu silebilir; başkasınınkini silemez', async () => {
    await assertFails(deleteDoc(doc(ctx('b@x.com'), 'users/a@x.com')));
    await assertFails(deleteDoc(doc(ctx('b@x.com'), 'codes/AAAA-2222')));
    await assertSucceeds(deleteDoc(doc(ctx('a@x.com'), 'users/a@x.com')));
    await assertSucceeds(deleteDoc(doc(ctx('a@x.com'), 'codes/AAAA-2222')));
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

describe('Eski koleksiyonlar', () => {
  it('config ve allowlist kimseye açık değil', async () => {
    await assertFails(getDoc(doc(ctx(OWNER), 'config/allowlist')));
    await assertFails(getDoc(doc(ctx(OWNER), `allowlist/${OWNER}`)));
  });
});
