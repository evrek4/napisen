// napisen - Ana Uygulama Çerçevesi
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import SetupScreen from './components/SetupScreen';
import MessengerApp from './components/MessengerApp';
import { watchAuth, fetchAllowlist, logout } from './services/firebase';
import { normalizeEmail } from './services/crypto';
import useIdentity from './hooks/useIdentity';

function FullScreenLoader({ text }) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 bg-[#0b141a] text-sm text-[#8696a0]">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  );
}

export default function App() {
  // undefined: yükleniyor, null: giriş yok
  const [authUser, setAuthUser] = useState(undefined);
  const [access, setAccess] = useState({ status: 'idle', allowlist: null });
  const [authError, setAuthError] = useState('');

  useEffect(() => watchAuth((u) => setAuthUser(u || null)), []);

  // Sunucu tarafı izin listesi kontrolü
  useEffect(() => {
    if (!authUser) {
      setAccess({ status: 'idle', allowlist: null });
      return;
    }
    let cancelled = false;
    setAccess({ status: 'checking', allowlist: null });
    (async () => {
      if (!authUser.emailVerified) {
        setAuthError('Google hesabınızın e-posta adresi doğrulanmamış.');
        await logout();
        return;
      }
      try {
        const list = await fetchAllowlist();
        if (cancelled) return;
        if (!list) {
          setAuthError(
            `⛔ ${authUser.email} izin listesinde bulunmuyor. Yalnızca yöneticinin eklediği hesaplar giriş yapabilir.`
          );
          await logout();
          return;
        }
        setAuthError('');
        setAccess({ status: 'allowed', allowlist: list });
      } catch (err) {
        console.error('İzin kontrolü başarısız:', err);
        if (!cancelled) setAccess({ status: 'error', allowlist: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const me = useMemo(
    () =>
      authUser && access.status === 'allowed'
        ? { email: normalizeEmail(authUser.email), displayName: authUser.displayName || '', photoURL: authUser.photoURL }
        : null,
    [authUser, access.status]
  );

  const identity = useIdentity(me);

  if (authUser === undefined) return <FullScreenLoader text="Yükleniyor..." />;
  if (!authUser) return <AuthScreen error={authError} />;
  if (access.status === 'checking' || access.status === 'idle') return <FullScreenLoader text="Erişim doğrulanıyor..." />;
  if (access.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b141a] p-6 text-center text-sm text-[#e9edef]">
        <p>Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-[#00a884] px-4 py-2 text-[#111b21] font-semibold">
          Tekrar dene
        </button>
      </div>
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

  return <MessengerApp me={me} identityState={identity} onLogout={logout} />;
}
