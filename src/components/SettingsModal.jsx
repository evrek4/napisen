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
  Crown,
} from 'lucide-react';
import QrScanner from './QrScanner';
import { getStorageStats, clearMessageHistory } from '../services/db';
import { addAllowedEmail, removeAllowedEmail } from '../services/firebase';
import { publicKeyFingerprint, normalizeEmail } from '../services/crypto';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../services/notify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  allowlist,
  contacts,
  preferences,
  onTogglePreference,
  onSendTransfer,
  onVerifyContact,
  onHistoryCleared,
  onClose,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('privacy');
  const [newEmail, setNewEmail] = useState('');
  const [listMsg, setListMsg] = useState('');
  const [storageStats, setStorageStats] = useState({ usageMB: '0.00', quotaMB: 'N/A' });
  const [fingerprint, setFingerprint] = useState('');
  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMsg, setTransferMsg] = useState({ type: '', text: '' });
  const [transferBusy, setTransferBusy] = useState(false);

  const isAdmin = allowlist.admins.includes(me.email);

  useEffect(() => {
    getStorageStats().then(setStorageStats);
    publicKeyFingerprint(identity.publicKey).then(setFingerprint);
  }, [identity.publicKey]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAddEmail = async (e) => {
    e.preventDefault();
    const clean = normalizeEmail(newEmail);
    if (!EMAIL_RE.test(clean)) {
      setListMsg('Geçerli bir e-posta adresi yazın.');
      return;
    }
    if (allowlist.emails.includes(clean)) {
      setListMsg('Bu e-posta zaten listede.');
      return;
    }
    try {
      await addAllowedEmail(clean);
      setNewEmail('');
      setListMsg(`✓ ${clean} eklendi. Artık Google hesabıyla giriş yapabilir.`);
    } catch (err) {
      setListMsg('Eklenemedi: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
    }
  };

  const handleRemoveEmail = async (email) => {
    if (email === me.email) return;
    if (!window.confirm(`${email} izin listesinden çıkarılsın mı? Bu kişi artık sunucuya erişemez.`)) return;
    try {
      await removeAllowedEmail(email);
      setListMsg(`${email} çıkarıldı.`);
    } catch (err) {
      setListMsg('Çıkarılamadı: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
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
    ['allowlist', 'İzin Listesi'],
    ['storage', 'Hafıza'],
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

              <div className="rounded-xl bg-[#182229] p-4 border border-[#2a3942] flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 text-[#00a884] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Bildirimler</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#8696a0]">
                      Uygulama açıkken arka plandayken yeni mesaj bildirimi gösterir. Mesaj içeriği bildirimde
                      görünmez.
                    </p>
                  </div>
                </div>
                {!notificationsSupported() ? (
                  <span className="text-[11px] text-[#8696a0]">Desteklenmiyor</span>
                ) : notifPerm === 'granted' ? (
                  <span className="text-[11px] text-[#00a884]">Açık</span>
                ) : notifPerm === 'denied' ? (
                  <span className="text-[11px] text-red-300 text-right">Tarayıcıda engelli</span>
                ) : (
                  <button
                    onClick={async () => setNotifPerm(await requestNotificationPermission())}
                    className="rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-semibold text-[#111b21] cursor-pointer"
                  >
                    Aç
                  </button>
                )}
              </div>
            </>
          )}

          {/* ---------- GÜVENLİK ---------- */}
          {activeTab === 'security' && (
            <>
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
                        <span className="block text-[#8696a0]">{c.email}</span>
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
          {activeTab === 'allowlist' && (
            <>
              <p className="text-xs leading-relaxed text-[#8696a0]">
                Liste sunucuda tutulur ve güvenlik kurallarıyla korunur. Yalnızca listedeki Google hesapları giriş
                yapabilir. {isAdmin ? 'Yönetici olarak liste üzerinde değişiklik yapabilirsiniz.' : 'Listeyi yalnızca yöneticiler değiştirebilir.'}
              </p>

              {isAdmin && (
                <form onSubmit={handleAddEmail} className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="yeni.kisi@gmail.com"
                    className="flex-1 min-w-0 rounded-lg bg-[#202c33] px-3 py-2 text-sm placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                  <button type="submit" className="flex items-center gap-1 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-[#111b21] cursor-pointer">
                    <UserPlus className="h-4 w-4" /> Ekle
                  </button>
                </form>
              )}
              {listMsg && <p className="text-xs text-[#00a884]">{listMsg}</p>}

              <div className="divide-y divide-[#222d34] rounded-xl border border-[#2a3942] bg-[#182229]">
                {allowlist.emails.map((email) => (
                  <div key={email} className="flex items-center justify-between px-3 py-2.5 text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      {email}
                      {allowlist.admins.includes(email) && <Crown className="h-3 w-3 text-amber-400" aria-label="Yönetici" />}
                      {email === me.email && <span className="text-[#8696a0]">(siz)</span>}
                    </span>
                    {isAdmin && email !== me.email && (
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="rounded p-1 text-[#8696a0] hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                        aria-label="İzni kaldır"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---------- HAFIZA ---------- */}
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
