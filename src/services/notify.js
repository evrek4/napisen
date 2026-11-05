// napisen - Bildirimler (uygulama açıkken / arka plandaki sekmede)
// Not: Uygulama tamamen kapalıyken bildirim için FCM + sunucu gerekir; bu sürümde yoktur.

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

// İçerik gizliliği için mesaj metni bildirimde gösterilmez
export async function showMessageNotification(senderName) {
  if (notificationPermission() !== 'granted' || !document.hidden) return;
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
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('Bildirim gösterilemedi:', err);
  }
}
