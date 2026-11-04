// napisen - Ayarlar, Gizlilik ve Whitelist Yönetim Modalı
import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Trash2,
  HardDrive,
  Cloud,
  LogOut,
  Key,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Server,
} from 'lucide-react';
import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
} from '../config/whitelist';
import {
  getStorageStats,
  clearAllLocalData,
} from '../services/db';
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  isFirebaseConfigured,
} from '../services/firebase';

export default function SettingsModal({
  currentUser,
  preferences,
  onTogglePreference,
  onClose,
  onLogout,
}) {
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [whitelistMsg, setWhitelistMsg] = useState('');
  const [storageStats, setStorageStats] = useState({ usageMB: '0.00', quotaMB: 'N/A' });
  const [firebaseConfig, setFirebaseConfig] = useState(getFirebaseConfig());
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'whitelist' | 'storage' | 'firebase'
  const [savedConfigMsg, setSavedConfigMsg] = useState('');

  useEffect(() => {
    setWhitelist(getWhitelist());
    getStorageStats().then(setStorageStats);
  }, []);

  const handleAddEmail = (e) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setWhitelistMsg('Geçerli bir e-posta adresi yazın.');
      return;
    }

    if (addToWhitelist(clean)) {
      setWhitelist(getWhitelist());
      setNewEmail('');
      setWhitelistMsg(`✓ ${clean} izin listesine eklendi.`);
      setTimeout(() => setWhitelistMsg(''), 3000);
    } else {
      setWhitelistMsg('Bu e-posta zaten listede var.');
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    if (whitelist.length <= 1) {
      alert('İzin listesinde en az bir adres bulunmalıdır.');
      return;
    }
    const updated = removeFromWhitelist(emailToRemove);
    setWhitelist(updated);
  };

  const handleSaveFirebase = (e) => {
    e.preventDefault();
    saveFirebaseConfig(firebaseConfig);
    setSavedConfigMsg('✓ Firebase ayarları kaydedildi. Sayfayı yenilediğinizde devreye girer.');
    setTimeout(() => setSavedConfigMsg(''), 4000);
  };

  const handleClearData = async () => {
    if (window.confirm('Bu cihazdaki tüm mesaj geçmişi ve medyalar silinecektir. Emin misiniz?')) {
      await clearAllLocalData();
      alert('Cihazdaki yerel veriler temizlendi.');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs select-none">
      <div className="relative flex flex-col h-[90vh] max-h-[660px] w-full max-w-xl rounded-2xl bg-[#111b21] border border-[#202c33] shadow-2xl overflow-hidden text-[#e9edef]">
        {/* Üst Başlık */}
        <div className="flex h-16 items-center justify-between border-b border-[#202c33] px-6 bg-[#202c33]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#00a884]" />
            <h2 className="text-base font-bold text-[#e9edef]">napisen Gizlilik & Ayarlar</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-[#202c33] bg-[#182229] px-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            Gizlilik Seçenekleri
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'whitelist'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            İzin Listesi (Whitelist)
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'storage'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            Hafıza & Temizlik
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'firebase'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            Google Firebase
          </button>
        </div>

        {/* İçerik Alanı */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 0: GİZLİLİK SEÇENEKLERİ (KULLANICININ İSTEDİĞİ İKİ ANA SEÇENEK) */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[#e9edef]">Mesaj ve Medya Depolama Tercihleri</h3>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  İletişiminizin nerede ve nasıl saklanacağını tam olarak siz belirlersiniz.
                </p>
              </div>

              {/* 1. SEÇENEK: SUNUCUDA SAKLA */}
              <div className="rounded-xl border border-[#202c33] bg-[#182229] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-[#53bdeb]">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#e9edef]">Sunucuda Sakla (Bulut Yedekleme)</h4>
                      <p className="text-xs text-[#8696a0] mt-1 leading-relaxed">
                        <strong>Kapalıyken:</strong> Teslim edilen mesaj ve dosyalar sunucudan (Google Firebase) <u>anında kalıcı olarak silinir</u> (0 Bayt).
                        <br />
                        <strong>Açıkken:</strong> Uçtan uca şifreli mesajlar teslim edildikten sonra da sunucuda tutulur, böylece başka cihazdan girildiğinde geri yüklenebilir.
                      </p>
                    </div>
                  </div>

                  {/* Anahtar Switch */}
                  <button
                    type="button"
                    onClick={() => onTogglePreference('serverStorageEnabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                      preferences.serverStorageEnabled ? 'bg-[#00a884]' : 'bg-[#374248]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ${
                        preferences.serverStorageEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 2. SEÇENEK: YAZILAR CİHAZDA TUTULMASIN */}
              <div className="rounded-xl border border-[#202c33] bg-[#182229] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                      <EyeOff className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#e9edef]">Yazılar Cihazda Tutulmasın (Hayalet Mod)</h4>
                      <p className="text-xs text-[#8696a0] mt-1 leading-relaxed">
                        <strong>Açıkken:</strong> Yazışmalar telefonun/cihazın hafızasına (IndexedDB) <u>kesinlikle kaydedilmez</u>. 
                        Yalnızca sohbet açık olduğu sürece ekranda görünür; sayfa yenilendiğinde, sekme veya uygulama kapatıldığında cihazdan iz bırakmadan tamamen yok olur.
                      </p>
                    </div>
                  </div>

                  {/* Anahtar Switch */}
                  <button
                    type="button"
                    onClick={() => onTogglePreference('dontStoreOnDevice')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                      preferences.dontStoreOnDevice ? 'bg-[#00a884]' : 'bg-[#374248]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ${
                        preferences.dontStoreOnDevice ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#182229] p-3 text-xs text-[#8696a0] border border-[#202c33] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00a884] shrink-0" />
                <span>Tercihleriniz anında uygulanır, ayrıca sohbet başlığından da tek tıkla değiştirebilirsiniz.</span>
              </div>
            </div>
          )}

          {/* TAB 1: WHITELIST YÖNETİMİ */}
          {activeTab === 'whitelist' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#e9edef]">Yetkili E-posta Adresleri</h3>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  Yalnızca bu listede yer alan adres sahipleri uygulamaya giriş yapabilir ve sizinle şifreli haberleşebilir.
                </p>
              </div>

              <form onSubmit={handleAddEmail} className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="yeni.kullanici@gmail.com"
                  className="flex-1 rounded-xl bg-[#202c33] py-2 px-3 text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#00a884] px-4 py-2 text-xs font-semibold text-[#111b21] hover:bg-[#02906f] cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  Ekle
                </button>
              </form>

              {whitelistMsg && (
                <p className="text-xs text-[#00a884] font-medium">{whitelistMsg}</p>
              )}

              <div className="divide-y divide-[#202c33] rounded-xl border border-[#202c33] bg-[#182229]">
                {whitelist.map((wEmail) => (
                  <div
                    key={wEmail}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-mono text-[#e9edef]">{wEmail}</span>
                    <button
                      onClick={() => handleRemoveEmail(wEmail)}
                      className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                      title="İzni Kaldır"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CİHAZ DEPOLAMASI */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#e9edef]">Cihaz İçi Hafıza Durumu</h3>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  Fotoğraf ve ses kayıtları bu cihazın yerel hafızasında (IndexedDB) saklanır.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#202c33] bg-[#182229] p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#8696a0] mb-1">
                    <HardDrive className="h-3.5 w-3.5 text-[#00a884]" />
                    <span>Cihazdaki Kullanım</span>
                  </div>
                  <span className="text-lg font-bold font-mono text-[#e9edef]">
                    {storageStats.usageMB} MB
                  </span>
                </div>

                <div className="rounded-xl border border-[#202c33] bg-[#182229] p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#8696a0] mb-1">
                    <Cloud className="h-3.5 w-3.5 text-[#53bdeb]" />
                    <span>Sunucu Depolama</span>
                  </div>
                  <span className="text-lg font-bold font-mono text-[#00a884]">
                    {preferences.serverStorageEnabled ? 'Yedekleme Aktif' : '0 Bayt (Burn-after-delivery)'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleClearData}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-950/30 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-900/40 cursor-pointer transition"
              >
                <Trash2 className="h-4 w-4" />
                Bu Cihazdaki Tüm Geçmişi ve Medyayı Sil
              </button>
            </div>
          )}

          {/* TAB 3: GOOGLE FIREBASE BAĞLANTISI */}
          {activeTab === 'firebase' && (
            <form onSubmit={handleSaveFirebase} className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#e9edef]">Google Firebase (Ücretsiz Altyapı)</h3>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  İki cihazın birbirine şifreli paketleri anında ulaştırması için Firebase projenizi bağlayabilirsiniz.
                </p>
              </div>

              <div className="rounded-xl bg-[#182229] p-3 border border-[#202c33] text-xs">
                <div className="flex items-center gap-2 text-[#00a884] font-medium mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {isFirebaseConfigured()
                      ? 'Canlı Firebase Projesi Bağlı'
                      : 'Akıllı Köprü Modu Aktif (Sekmeler arası test)'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[#8696a0] block mb-1">apiKey</label>
                  <input
                    type="text"
                    value={firebaseConfig.apiKey}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full rounded-lg bg-[#202c33] p-2 text-xs text-[#e9edef] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>
                <div>
                  <label className="text-[#8696a0] block mb-1">projectId</label>
                  <input
                    type="text"
                    value={firebaseConfig.projectId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
                    placeholder="napisen-app"
                    className="w-full rounded-lg bg-[#202c33] p-2 text-xs text-[#e9edef] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>
              </div>

              {savedConfigMsg && (
                <p className="text-xs text-[#00a884] font-medium">{savedConfigMsg}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#00a884] py-2.5 text-xs font-semibold text-[#111b21] hover:bg-[#02906f] cursor-pointer transition shadow"
              >
                Firebase Ayarlarını Kaydet
              </button>
            </form>
          )}
        </div>

        {/* Alt Kısım: Çıkış Yap */}
        <div className="border-t border-[#202c33] bg-[#182229] p-4 flex items-center justify-between">
          <div className="text-xs text-[#8696a0]">
            Aktif Giriş: <strong className="text-[#e9edef]">{currentUser.email}</strong>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer transition"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
