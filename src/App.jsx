// napisen - Ana Uygulama Çerçevesi
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Ban, LogOut } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import SetupScreen from './components/SetupScreen';
import MessengerApp from './components/MessengerApp';
import ConsentScreen from './components/ConsentScreen';
import LegalPage from './components/LegalPage';
import LegalLinks from './components/LegalLinks';
import { auth, watchAuth, fetchAccountStatus, fetchMyProfile, logout } from './services/firebase';
import { normalizeEmail } from './services/crypto';
import { TERMS_VERSION } from './config/app';
import { LEGAL_PAGES } from './legal/texts';
import useIdentity from './hooks/useIdentity';

function FullScreenLoader({ text }) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 bg-[#0b141a] text-sm text-[#8696a0]">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  );
}

function useLegalRoute() {
  const find = () => LEGAL_PAGES.find((p) => p.path === window.location.pathname) || null;
  const [page, setPage] = useState(find);
  useEffect(() => {
    const onPop = () => setPage(find());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const close = () => {
    if (window.history.length > 1) window.history.back();
    else {
      window.history.replaceState({}, '', '/');
      setPage(null);
    }
  };
  return [page, close];
}

export default function App() {
  const [legalPage, closeLegal] = useLegalRoute();

  // undefined: yükleniyor, null: giriş yok
  const [authUser, setAuthUser] = useState(undefined);
  const [account, setAccount] = useState({ status: 'idle' });
  const [acceptedNow, setAcceptedNow] = useState(false);
  const [authError, setAuthError] = useState('');

  // Oturum başka bir sekmede kapatılır / değiştirilirse kullanıcıya nedenini söyle
  // (Firebase oturumu aynı tarayıcı profilindeki tüm sekmelerde ortaktır.)
  const lastEmailRef = useRef(null);
  const selfLogoutRef = useRef(false);
  const lastAuthErrorRef = useRef('');
  const [switchNotice, setSwitchNotice] = useState('');

  const doLogout = () => {
    selfLogoutRef.current = true;
    return logout();
  };

  useEffect(
    () =>
      watchAuth((u) => {
        const prev = lastEmailRef.current;
        const next = u?.email ? normalizeEmail(u.email) : null;
        if (prev && !next && !selfLogoutRef.current) {
          const code = lastAuthErrorRef.current;
          setAuthError(
            'Oturumunuz kapandı. Bu tarayıcıda başka bir sekmede çıkış yapılmış, tarayıcı verileri bir eklenti tarafından temizlenmiş veya Google oturum süresi dolmuş olabilir.' +
              (code ? ` (Teknik ayrıntı: ${code})` : '')
          );
          console.warn('Oturum beklenmedik şekilde kapandı. Son kimlik hatası:', code || 'yok');
        }
        // Oturum yenileme hatasını yakala (Firebase bu durumda oturumu kapatabilir)
        if (u) {
          u.getIdToken().catch((err) => {
            lastAuthErrorRef.current = err?.code || String(err);
            console.warn('Oturum anahtarı yenilenemedi:', err);
          });
        }
        if (prev && next && prev !== next) {
          setSwitchNotice(
            `Bu tarayıcıda başka bir sekmede ${next} hesabıyla giriş yapıldığı için bu sekme de o hesaba geçti. İki hesabı aynı anda kullanmak için ikincisini gizli pencerede açın.`
          );
        }
        selfLogoutRef.current = false;
        lastEmailRef.current = next;
        setAuthUser(u || null);
      }),
    []
  );

  // Hesap durumu: askı, rol ve koşul onayı
  useEffect(() => {
    setAcceptedNow(false);
    if (!authUser) {
      setAccount({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setAccount({ status: 'checking' });
    (async () => {
      if (!authUser.emailVerified) {
        setAuthError('Google hesabınızın e-posta adresi doğrulanmamış.');
        await doLogout();
        return;
      }
      const email = normalizeEmail(authUser.email);
      try {
        const [status, profile] = await Promise.all([
          fetchAccountStatus(email),
          fetchMyProfile(email).catch(() => null),
        ]);
        if (cancelled) return;
        setAuthError('');
        setAccount({ status: status.ban ? 'banned' : 'ok', role: status.role, ban: status.ban, profile });
      } catch (err) {
        console.error('Hesap durumu alınamadı:', err);
        if (!cancelled) setAccount({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Sekmeye geri dönüldüğünde oturumu tazele; hata olursa kodunu sakla
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || !auth?.currentUser) return;
      auth.currentUser.getIdToken().catch((err) => {
        lastAuthErrorRef.current = err?.code || String(err);
        console.warn('Oturum anahtarı yenilenemedi:', err);
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const termsOk =
    account.status === 'ok' && (acceptedNow || account.profile?.termsVersion === TERMS_VERSION);

  const me = useMemo(
    () =>
      authUser && termsOk
        ? {
            email: normalizeEmail(authUser.email),
            displayName: authUser.displayName || '',
            terms: {
              version: TERMS_VERSION,
              acceptedAt:
                !acceptedNow && account.profile?.termsVersion === TERMS_VERSION
                  ? account.profile.termsAcceptedAt
                  : 'now',
            },
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authUser, termsOk]
  );

  const identity = useIdentity(me);

  const notice = switchNotice ? (
    <div className="fixed inset-x-0 top-0 z-[70] flex items-start justify-center p-2">
      <div className="flex max-w-xl items-start gap-3 rounded-xl border border-amber-700/60 bg-amber-950/95 px-4 py-3 text-xs text-amber-100 shadow-xl">
        <span className="leading-relaxed">{switchNotice}</span>
        <button onClick={() => setSwitchNotice('')} className="shrink-0 font-semibold underline cursor-pointer">
          Tamam
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {notice}
      {renderScreen()}
    </>
  );

  function renderScreen() {
  if (legalPage) return <LegalPage page={legalPage} onBack={closeLegal} />;
  if (authUser === undefined) return <FullScreenLoader text="Yükleniyor..." />;
  if (!authUser) return <AuthScreen error={authError} />;
  if (account.status === 'checking' || account.status === 'idle') return <FullScreenLoader text="Hesap kontrol ediliyor..." />;
  if (account.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b141a] p-6 text-center text-sm text-[#e9edef]">
        <p>Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-[#00a884] px-4 py-2 text-[#111b21] font-semibold">
          Tekrar dene
        </button>
      </div>
    );
  }
  if (account.status === 'banned') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0b141a] p-6 text-center text-[#e9edef]">
        <Ban className="h-10 w-10 text-red-400" />
        <h1 className="text-lg font-bold">Hesabınız askıya alındı</h1>
        <p className="max-w-sm text-sm text-[#8696a0]">
          {account.ban?.reason ? `Gerekçe: ${account.ban.reason}` : 'Hesabınız Kullanım Koşullarının ihlali nedeniyle askıya alındı.'}
        </p>
        <p className="max-w-sm text-xs text-[#8696a0]">İtiraz için Kullanım Koşulları’ndaki iletişim adresine yazabilirsiniz.</p>
        <LegalLinks />
        <button onClick={doLogout} className="flex items-center gap-1.5 rounded-lg bg-[#202c33] px-4 py-2 text-sm cursor-pointer">
          <LogOut className="h-4 w-4" /> Çıkış yap
        </button>
      </div>
    );
  }
  if (!termsOk) {
    return (
      <ConsentScreen
        email={normalizeEmail(authUser.email)}
        isUpdate={Boolean(account.profile?.termsVersion)}
        onAccept={() => setAcceptedNow(true)}
        onLogout={doLogout}
      />
    );
  }

  if (identity.status === 'loading') return <FullScreenLoader text="Anahtarlar yükleniyor..." />;
  if (identity.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b141a] p-6 text-center text-sm text-red-200">
        <p>{identity.error}</p>
        <button onClick={identity.reload} className="rounded-lg bg-[#00a884] px-4 py-2 text-[#111b21] font-semibold">
          Tekrar dene
        </button>
      </div>
    );
  }
  if (identity.status !== 'ready') {
    return <SetupScreen me={me} identityState={identity} onLogout={doLogout} />;
  }

  return <MessengerApp me={me} role={account.role} identityState={identity} onLogout={doLogout} />;
  }
}
