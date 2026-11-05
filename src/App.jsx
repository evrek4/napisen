// napisen - Ana Uygulama Çerçevesi
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Ban, LogOut } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import SetupScreen from './components/SetupScreen';
import MessengerApp from './components/MessengerApp';
import ConsentScreen from './components/ConsentScreen';
import LegalPage from './components/LegalPage';
import LegalLinks from './components/LegalLinks';
import { watchAuth, fetchAccountStatus, fetchMyProfile, logout } from './services/firebase';
import { normalizeEmail } from './services/crypto';
import { OWNER_EMAIL, TERMS_VERSION } from './config/app';
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

  useEffect(() => watchAuth((u) => setAuthUser(u || null)), []);

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
        await logout();
        return;
      }
      const email = normalizeEmail(authUser.email);
      try {
        const [status, profile] = await Promise.all([
          fetchAccountStatus(email, OWNER_EMAIL),
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
        <button onClick={logout} className="flex items-center gap-1.5 rounded-lg bg-[#202c33] px-4 py-2 text-sm cursor-pointer">
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
        onLogout={logout}
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
    return <SetupScreen me={me} identityState={identity} onLogout={logout} />;
  }

  return <MessengerApp me={me} role={account.role} identityState={identity} onLogout={logout} />;
}
