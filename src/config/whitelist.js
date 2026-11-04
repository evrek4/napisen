// napisen - Yetkili E-posta Listesi (Whitelist)
// Sadece bu listedeki e-posta adresleri uygulamaya giriş yapabilir ve mesajlaşabilir.

export const DEFAULT_WHITELIST = [
  'fthtrgl@gmail.com',
  'mehmetbacar@gmail.com',
  'urfahibe@gmail.com',
];

const STORAGE_KEY = 'napisen_whitelist';

export function getWhitelist() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure default addresses are always included
      const merged = Array.from(new Set([...DEFAULT_WHITELIST, ...parsed]));
      return merged;
    }
  } catch (e) {
    console.error('Whitelist okuma hatası:', e);
  }
  return DEFAULT_WHITELIST;
}

export function isEmailWhitelisted(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = getWhitelist().map(e => e.trim().toLowerCase());
  return list.includes(normalized);
}

export function addToWhitelist(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = getWhitelist();
  if (!list.includes(normalized)) {
    const updated = [...list, normalized];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  }
  return false;
}

export function removeFromWhitelist(email) {
  const normalized = email.trim().toLowerCase();
  // Don't allow removing if it's the current user or down to 0
  const list = getWhitelist();
  const updated = list.filter(e => e.trim().toLowerCase() !== normalized);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

