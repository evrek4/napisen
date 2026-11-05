// napisen - Ayarlar: Gizlilik, Güvenlik, İzin Listesi, Hafıza
import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  UserPlus,
  Trash2,
  HardDrive,
  Cloud,
  LogOut,
  EyeOff,
  Server,
  Bell,
  Smartphone,
  KeyRound,
  FileText,
  UserX,
  AtSign,
  RefreshCw,
  Volume2,
  Keyboard,
  Copy,
} from 'lucide-react';
import QrScanner from './QrScanner';
import MyCodeCard from './MyCodeCard';
import { getStorageStats, clearMessageHistory, wipeDevice } from '../services/db';
import { deleteAccount } from '../services/firebase';
import ModerationPanel from './ModerationPanel';
import RolesPanel from './RolesPanel';
import LegalLinks from './LegalLinks';
import { publicKeyFingerprint } from '../services/crypto';
import { notificationsSupported } from '../services/notify';


function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition cursor-pointer ${
        on ? 'bg-[#00a884]' : 'bg-[#374248]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsModal({
  me,
  identity,
  myCode,
  discoverable,
  onSetDiscoverable,
  onRegenerateCode,
  role,
  contacts,
  preferences,
  onTogglePreference,
  onSendTransfer,
  onVerifyContact,
  onHistoryCleared,
  notifPerm,
  onRequestNotifications,
  onClose,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('privacy');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const isMod = role === 'admin' || role === 'moderator';
  const [storageStats, setStorageStats] = useState({ usageMB: '0.00', quotaMB: 'N/A' });
  const [fingerprint, setFingerprint] = useState('');

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMsg, setTransferMsg] = useState({ type: '', text: '' });
  const [transferBusy, setTransferBusy] = useState(false);

  const [profileMsg, setProfileMsg] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  const runProfile = async (fn, okText) => {
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileMsg('');
    try {
      await fn();
      if (okText) setProfileMsg(okText);
    } catch (err) {
      setProfileMsg('İşlem başarısız: ' + (err.message || err));
    } finally {
      setProfileBusy(false);
    }
  };


  useEffect(() => {
    getStorageStats().then(setStorageStats);
    publicKeyFingerprint(identity.publicKey).then(setFingerprint);
  }, [identity.publicKey]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDeleteAccount = async () => {
    const typed = window.prompt('Hesabınız kalıcı olarak silinecek. Onaylamak için SİL yazın:');
    if ((typed || '').trim().toLocaleUpperCase('tr-TR') !== 'SİL') return;
    setDeleting(true);
    setDeleteMsg('');
    try {
      await deleteAccount(me.email, myCode);
      await wipeDevice();
      try {
        localStorage.clear();
      } catch {
        /* yok say */
      }
      window.location.replace('/');
    } catch (err) {
      console.error('Hesap silinemedi:', err);
      setDeleteMsg('Hesap silinemedi: ' + (err.message || err) + '. Tekrar deneyin.');
      setDeleting(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Bu cihazdaki tüm mesaj geçmişi ve medyalar silinecek. Şifreleme anahtarınız korunur. Emin misiniz?')) {
      return;
    }
    await clearMessageHistory();
    onHistoryCleared?.();
    setStorageStats(await getStorageStats());
  };

  const handleTransferScan = async (text) => {
    if (transferBusy) return;
    setTransferBusy(true);
    setTransferMsg({ type: '', text: '' });
    try {
      await onSendTransfer(text);
      setTransferMsg({ type: 'ok', text: '✓ Anahtarınız yeni cihaza şifreli olarak gönderildi.' });
      setTransferOpen(false);
    } catch (err) {
      setTransferMsg({ type: 'err', text: err.message });
    } finally {
      setTransferBusy(false);
    }
  };

  const tabs = [
    ['privacy', 'Gizlilik'],
    ['security', 'Güvenlik'],
    ['storage', 'Hafıza'],
    ['account', 'Hesap'],
    ...(isMod ? [['moderation', 'Moderasyon']] : []),
    ...(role === 'admin' ? [['roles', 'Yetkiler']] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#111b21] border border-[#2a3942] shadow-2xl">
        <div className="flex items-center justify-between bg-[#202c33] px-5 py-3.5">
          <h2 className="text-base font-semibold text-[#e9edef]">Ayarlar</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#aebac1] hover:bg-[#374248] cursor-pointer" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-[#222d34] bg-[#111b21] px-2 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium transition cursor-pointer ${
                activeTab === id ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[#e9edef]">
          {/* ---------- GİZLİLİK ---------- */}
          {activeTab === 'privacy' && (
            <>
              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <AtSign className="h-5 w-5 text-[#00a884] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">E-posta adresimle bulunabilirim</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      <strong>Kapalı (önerilen):</strong> Sizi yalnızca kişi kodunuzu bilenler bulabilir.
                      <br />
                      <strong>Açık:</strong> E-posta adresinizi bilen izinli kullanıcılar da size yazabilir.
                    </p>
                  </div>
                </div>
                <Toggle
                  on={discoverable}
                  onClick={() => runProfile(() => onSetDiscoverable(!discoverable))}
                  label="E-postayla bulunabilirim"
                />
              </div>
              {profileMsg && activeTab === 'privacy' && <p className="text-xs text-[#00a884]">{profileMsg}</p>}

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Server className="h-5 w-5 text-[#53bdeb] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Sunucuda Sakla</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      <strong>Kapalı:</strong> Mesaj karşı tarafa teslim edildiği an sunucudan silinir.
                      <br />
                      <strong>Açık:</strong> Şifreli mesajlar sunucuda kalır; taşıdığınız yeni cihazda geçmiş geri
                      yüklenir. Sunucu yine de içeriği okuyamaz.
                    </p>
                  </div>
                </div>
                <Toggle
                  on={preferences.serverStorageEnabled}
                  onClick={() => onTogglePreference('serverStorageEnabled')}
                  label="Sunucuda sakla"
                />
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <EyeOff className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Yazılar Cihazda Tutulmasın (Hayalet Mod)</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      Açıkken mesajlar cihaz hafızasına yazılmaz; sayfa kapanınca kaybolur. Şifreleme anahtarınız
                      cihazda kalmaya devam eder.
                    </p>
                  </div>
                </div>
                <Toggle
                  on={preferences.dontStoreOnDevice}
                  onClick={() => onTogglePreference('dontStoreOnDevice')}
                  label="Hayalet mod"
                />
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Bell className="h-5 w-5 text-[#00a884] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">Yeni mesaj bildirimleri</h4>
                      <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                        Uygulama açıkken ekranda uyarı, arka plandayken sistem bildirimi gösterilir. Mesaj içeriği
                        bildirimde görünmez.
                      </p>
                    </div>
                  </div>
                  <Toggle
                    on={preferences.notifications !== false}
                    onClick={async () => {
                      const turningOn = preferences.notifications === false;
                      onTogglePreference('notifications');
                      if (turningOn && notifPerm === 'default') onRequestNotifications?.();
                    }}
                    label="Bildirimler"
                  />
                </div>

                {preferences.notifications !== false && (
                  <>
                    <div className="flex items-center justify-between gap-4 border-t border-[#222d34] pt-3">
                      <span className="flex items-center gap-2 text-xs">
                        <Volume2 className="h-4 w-4 text-[#8696a0]" /> Bildirim sesi
                      </span>
                      <Toggle
                        on={preferences.notificationSound !== false}
                        onClick={() => onTogglePreference('notificationSound')}
                        label="Bildirim sesi"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#222d34] pt-3 text-xs">
                      <span className="text-[#8696a0]">Sistem bildirimi izni (arka plan için)</span>
                      {!notificationsSupported() ? (
                        <span className="text-[#8696a0]">Desteklenmiyor</span>
                      ) : notifPerm === 'granted' ? (
                        <span className="text-[#00a884]">Verildi</span>
                      ) : notifPerm === 'denied' ? (
                        <span className="text-right text-red-300">
                          Tarayıcıda engelli — adres çubuğundaki kilit simgesinden izin verin
                        </span>
                      ) : (
                        <button
                          onClick={onRequestNotifications}
                          className="rounded-lg bg-[#00a884] px-3 py-1.5 font-semibold text-[#111b21] cursor-pointer"
                        >
                          İzin ver
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Copy className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Mesajlarım kopyalanabilir ve iletilebilir</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      Kapatırsanız bundan sonra gönderdiğiniz mesajlar karşı tarafta kopyalanamaz, iletilemez ve
                      fotoğraflar indirilemez. <strong>Not:</strong> Ekran görüntüsü almayı veya başka bir cihazla
                      fotoğraf çekmeyi hiçbir uygulama tam olarak engelleyemez.
                    </p>
                  </div>
                </div>
                <Toggle
                  on={preferences.allowCopy !== false}
                  onClick={() => onTogglePreference('allowCopy')}
                  label="Kopyalama ve iletmeye izin ver"
                />
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Keyboard className="h-5 w-5 text-[#53bdeb] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">"Yazıyor..." bilgisini gönder</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      Mesaj yazarken karşı taraf sohbet başlığında "yazıyor..." görür. Kapatırsanız gönderilmez.
                    </p>
                  </div>
                </div>
                <Toggle
                  on={preferences.sendTyping !== false}
                  onClick={() => onTogglePreference('sendTyping')}
                  label="Yazıyor bilgisini gönder"
                />
              </div>
            </>
          )}

          {/* ---------- GÜVENLİK ---------- */}
          {activeTab === 'security' && (
            <>
              <MyCodeCard code={myCode} />
              <button
                disabled={profileBusy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Yeni bir kişi kodu alınsın mı?\n\nEski kodunuz çalışmaz olur; onu bilen yeni kişiler sizi bulamaz. Mevcut sohbetleriniz devam eder (karşı taraf, siz ona yeniden yazınca yeni kodunuzu öğrenir).'
                    )
                  ) {
                    runProfile(onRegenerateCode, '✓ Yeni kişi kodunuz oluşturuldu.');
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-[#8696a0] hover:text-[#e9edef] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${profileBusy ? 'animate-spin' : ''}`} /> Kodumu yenile
              </button>
              {profileMsg && <p className="text-center text-xs text-[#00a884]">{profileMsg}</p>}

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942]">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="h-4 w-4 text-[#00a884]" /> Bu cihazın anahtar parmak izi
                </div>
                <p className="mt-2 font-mono text-sm tracking-wider text-[#e9edef]">{fingerprint}</p>
                <p className="mt-1 text-[11px] text-[#8696a0]">
                  Oluşturulma: {new Date(identity.createdAt).toLocaleString('tr-TR')}
                </p>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8696a0]">Kişi doğrulamaları</h4>
                <div className="divide-y divide-[#222d34] rounded-xl border border-[#2a3942] bg-[#182229]">
                  {contacts.length === 0 && <p className="p-3 text-xs text-[#8696a0]">Kişi yok.</p>}
                  {contacts.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => onVerifyContact(c.email)}
                      disabled={c.keyStatus === 'no-key'}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#202c33] disabled:opacity-60 cursor-pointer"
                    >
                      <span className="truncate text-xs">
                        <span className="block text-[#e9edef]">{c.name}</span>
                        <span className="block font-mono text-[#8696a0]">{c.code || ''}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px]">
                        {c.keyStatus === 'verified' && (
                          <span className="flex items-center gap-1 text-[#00a884]"><ShieldCheck className="h-3.5 w-3.5" />Doğrulandı</span>
                        )}
                        {c.keyStatus === 'unverified' && (
                          <span className="flex items-center gap-1 text-amber-400"><ShieldQuestion className="h-3.5 w-3.5" />Doğrula</span>
                        )}
                        {c.keyStatus === 'changed' && (
                          <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-3.5 w-3.5" />Anahtar değişti</span>
                        )}
                        {c.keyStatus === 'no-key' && <span className="text-[#8696a0]">Giriş yapmadı</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="h-4 w-4 text-[#53bdeb]" /> Yeni cihaza taşı
                </div>
                <p className="text-xs leading-relaxed text-[#8696a0]">
                  Yeni cihazda giriş yapıp <em>“Eski cihazımdan taşı”</em> seçeneğine dokunun ve orada görünen QR kodu
                  buradan okutun. Anahtarınız ve doğruladığınız kişiler uçtan uca şifreli aktarılır.
                </p>
                {transferMsg.text && (
                  <p
                    className={`rounded-lg p-2.5 text-xs border ${
                      transferMsg.type === 'ok'
                        ? 'bg-[#00a884]/10 text-[#00a884] border-[#00a884]/30'
                        : 'bg-red-950/60 text-red-200 border-red-800/60'
                    }`}
                  >
                    {transferMsg.text}
                  </p>
                )}
                {transferOpen ? (
                  <>
                    <QrScanner onResult={handleTransferScan} busy={transferBusy} />
                    <button onClick={() => setTransferOpen(false)} className="w-full text-center text-xs text-[#8696a0] cursor-pointer">
                      Vazgeç
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setTransferMsg({ type: '', text: '' });
                      setTransferOpen(true);
                    }}
                    className="w-full rounded-lg bg-[#53bdeb]/15 py-2.5 text-xs font-semibold text-[#53bdeb] border border-[#53bdeb]/40 cursor-pointer"
                  >
                    Yeni cihazın kodunu okut
                  </button>
                )}
              </div>
            </>
          )}

          {/* ---------- İZİN LİSTESİ ---------- */}
          {activeTab === 'moderation' && isMod && <ModerationPanel me={me} />}

          {activeTab === 'roles' && role === 'admin' && <RolesPanel me={me} />}

          {/* ---------- HESAP ---------- */}
          {activeTab === 'account' && (
            <>
              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] space-y-1 text-xs">
                <p className="text-[#8696a0]">Giriş yapılan hesap</p>
                <p className="text-sm text-[#e9edef]">{me.displayName || me.email}</p>
                <p className="text-[#8696a0]">{me.email}</p>
                <p className="pt-1 text-[#8696a0]">
                  Rol: {role === 'admin' ? 'Admin' : role === 'moderator' ? 'Moderatör' : 'Kullanıcı'}
                </p>
              </div>

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-[#8696a0]" /> Yasal metinler
                </h4>
                <LegalLinks />
              </div>

              <div className="rounded-xl bg-red-950/30 p-4 border border-red-900/50 space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-red-200">
                  <UserX className="h-4 w-4" /> Hesabımı sil
                </h4>
                <p className="text-xs leading-relaxed text-red-100/80">
                  Profiliniz, kişi kodunuz ve sunucuda bekleyen mesajlarınız kalıcı olarak silinir; bu cihazdaki
                  geçmiş ve anahtarlar da temizlenir. Bu işlem geri alınamaz.
                </p>
                {deleteMsg && <p className="text-xs text-red-200">{deleteMsg}</p>}
                <button
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                  className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? 'Siliniyor...' : 'Hesabımı kalıcı olarak sil'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'storage' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
                    <HardDrive className="h-4 w-4" /> Cihazdaki kullanım
                  </div>
                  <div className="mt-1 text-lg font-semibold">{storageStats.usageMB} MB</div>
                </div>
                <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
                    <Cloud className="h-4 w-4" /> Sunucu
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {preferences.serverStorageEnabled ? 'Şifreli yedek açık' : 'Teslimde silinir'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleClearData}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-950/50 py-3 text-xs font-semibold text-red-200 border border-red-800/50 hover:bg-red-900/50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Bu cihazdaki mesaj geçmişini sil
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#222d34] bg-[#111b21] px-5 py-3">
          <span className="truncate text-xs text-[#8696a0]">{me.email}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
