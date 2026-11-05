// napisen - Kullanıcı Gizlilik ve Depolama Tercihleri
// 1. Sunucuda Sakla (Bulut Yedekleme)
// 2. Yazılar Cihazda Tutulmasın (Hayalet / Ephemeral Mod)

const PREFS_KEY = 'napisen_user_preferences';

export const DEFAULT_PREFERENCES = {
  serverStorageEnabled: false, // Varsayılan: Sunucuda saklanmaz (0 Bayt, Burn-after-delivery)
  dontStoreOnDevice: false,    // Varsayılan: Cihaz yerel veritabanında saklanır
  sendTyping: true,            // "Yazıyor..." bilgisini karşı tarafa gönder
  notifications: true,         // Yeni mesaj bildirimleri
  notificationSound: true,     // Bildirim sesi
  allowCopy: true,             // Karşı taraf mesajlarımı kopyalayabilir / iletebilir
};

export function getPreferences() {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Tercihler okunamadı:', e);
  }
  return DEFAULT_PREFERENCES;
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    // Değişikliği tüm bileşenlere bildir
    window.dispatchEvent(new CustomEvent('napisen_prefs_changed', { detail: prefs }));
  } catch (e) {
    console.error('Tercihler kaydedilemedi:', e);
  }
}

