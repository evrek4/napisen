// napisen - Uygulama geneli sabitler

// Uygulama sahibi (admin). firestore.rules içindeki owner() ile AYNI olmalıdır.
export const OWNER_EMAIL = 'achartave@gmail.com';

// Kullanım Koşulları / Gizlilik metinleri değiştiğinde bu sürümü güncelleyin:
// kullanıcılardan bir sonraki girişte yeniden onay istenir.
export const TERMS_VERSION = '2026-11-05';

export const MIN_AGE = 13;

// Veri sorumlusu bilgileri (KVKK). Gerçek ad/unvan ve adresle güncelleyin.
export const LEGAL = {
  appName: 'napisen',
  controllerName: 'napisen uygulama yöneticisi',
  controllerAddress: '',
  contactEmail: 'achartave@gmail.com',
  lastUpdated: '5 Kasım 2026',
  jurisdiction: 'Türkiye Cumhuriyeti',
};
