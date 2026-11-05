// napisen - Bildirimler
// - Uygulama arka plandaysa: sistem bildirimi (mesaj içeriği gösterilmez)
// - Uygulama açıksa ama başka sohbetteyse: uygulama içi uyarı + ses (MessengerApp gösterir)
// Not: Uygulama tamamen kapalıyken bildirim için FCM + sunucu gerekir; bu sürümde yoktur.

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showSystemNotification(senderName) {
  if (notificationPermission() !== 'granted') return;
  const title = 'napisen';
  const options = {
    body: `${senderName} size yeni bir mesaj gönderdi`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'napisen-message',
    renotify: true,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch (err) {
    console.warn('Bildirim gösterilemedi:', err);
  }
}

// Kısa, yumuşak bir "dıt" sesi (ses dosyası gerektirmez)
let audioCtx = null;
export function playMessageSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    /* ses çalınamadı */
  }
}
