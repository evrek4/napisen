// napisen - Giriş ve kurulum sonrası ana mesajlaşma ekranı
import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import SettingsModal from './SettingsModal';
import ImageLightbox from './ImageLightbox';
import VerifyContactModal from './VerifyContactModal';
import NewChatModal from './NewChatModal';
import ReportModal from './ReportModal';
import ForwardModal from './ForwardModal';
import useMessenger from '../hooks/useMessenger';
import { getPreferences, savePreferences } from '../config/preferences';
import { clearMessageHistory } from '../services/db';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  showSystemNotification,
  playMessageSound,
} from '../services/notify';
import { Bell, X } from 'lucide-react';

export default function MessengerApp({ me, role, identityState, onLogout }) {
  const identity = identityState.identity;
  const [preferences, setPreferences] = useState(getPreferences);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [reportEmail, setReportEmail] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState('');
  useEffect(() => {
    if (!info) return undefined;
    const t = setTimeout(() => setInfo(''), 2500);
    return () => clearTimeout(t);
  }, [info]);

  const myCode = identityState.profile?.code || null;
  const [inAppAlert, setInAppAlert] = useState(null);
  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(() => {
    try {
      return localStorage.getItem('napisen_notif_prompt_dismissed') === '1';
    } catch {
      return false;
    }
  });

  // Yeni mesaj: arka plandaysa sistem bildirimi, açıksa uygulama içi uyarı + ses
  const prefsRef = React.useRef(preferences);
  prefsRef.current = preferences;
  const onIncoming = useCallback(({ sender, name }) => {
    const prefs = prefsRef.current;
    if (prefs.notifications === false) return;
    if (document.hidden) {
      showSystemNotification(name);
    } else {
      setInAppAlert({ sender, name, at: Date.now() });
    }
    if (prefs.notificationSound !== false) playMessageSound();
  }, []);

  const messenger = useMessenger({ me, identity, myCode, preferences, onIncoming });
  const { contacts, activeEmail, openConversation } = messenger;
  const activeContact = contacts.find((c) => c.email === activeEmail) || null;

  useEffect(() => {
    const onChange = (e) => setPreferences(e.detail);
    window.addEventListener('napisen_prefs_changed', onChange);
    return () => window.removeEventListener('napisen_prefs_changed', onChange);
  }, []);

  // Uygulama içi uyarıyı birkaç saniye sonra kapat
  useEffect(() => {
    if (!inAppAlert) return undefined;
    const t = setTimeout(() => setInAppAlert(null), 5000);
    return () => clearTimeout(t);
  }, [inAppAlert]);

  // Sekme başlığında okunmamış mesaj sayısı
  const totalUnread = contacts.reduce((n, c) => n + (c.unreadCount || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) napisen` : 'napisen | Güvenli Mesajlaşma';
  }, [totalUnread]);
  useEffect(() => () => {
    document.title = 'napisen | Güvenli Mesajlaşma';
  }, []);

  const enableSystemNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifPerm(result);
  };

  const dismissNotifPrompt = () => {
    setNotifPromptDismissed(true);
    try {
      localStorage.setItem('napisen_notif_prompt_dismissed', '1');
    } catch {
      /* yok say */
    }
  };

  const showNotifPrompt =
    preferences.notifications !== false && notificationsSupported() && notifPerm === 'default' && !notifPromptDismissed;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleTogglePreference = useCallback(
    async (key) => {
      const turningOn = !preferences[key];
      if (key === 'dontStoreOnDevice' && turningOn) {
        const wipe = window.confirm(
          'Hayalet Mod açılıyor. Bundan sonraki mesajlar cihaza kaydedilmeyecek.\n\nBu cihazda daha önce kaydedilmiş sohbet geçmişi de silinsin mi?'
        );
        if (wipe) {
          await clearMessageHistory();
          messenger.clearMemory();
          if (activeEmail) openConversation(activeEmail);
        }
      }
      const updated = { ...preferences, [key]: turningOn };
      setPreferences(updated);
      savePreferences(updated);
    },
    [preferences, messenger, activeEmail, openConversation]
  );

  const guard = (fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      setToast(err.message || 'İşlem başarısız.');
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0b141a]">
      <div className={`${activeContact ? 'hidden md:flex' : 'flex'} h-full w-full md:w-auto shrink-0`}>
        <Sidebar
          currentUser={me}
          myCode={myCode}
          contacts={contacts}
          activeContact={activeContact}
          syncError={messenger.syncError}
          onSelectContact={(c) => openConversation(c.email)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={() => setNewChatOpen(true)}
        />
      </div>

      <div className={`${!activeContact ? 'hidden md:flex' : 'flex'} flex-1 h-full overflow-hidden`}>
        <ChatArea
          activeContact={activeContact}
          messages={messenger.messages}
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
          onBack={() => openConversation(null)}
          onVerify={() => setVerifyEmail(activeContact.email)}
          onAcceptKey={guard(() => messenger.acceptNewKey(activeContact.email))}
          onBlock={guard(async () => {
            if (window.confirm(`${activeContact.name} engellensin mi? Size mesaj gönderemeyecek.`)) {
              await messenger.block(activeContact.email);
            }
          })}
          onUnblock={guard(() => messenger.unblock(activeContact.email))}
          onReport={() => setReportEmail(activeContact.email)}
          onTyping={(active) => activeContact && messenger.notifyTyping(activeContact.email, active)}
          onSendText={guard((text) => messenger.sendText(activeContact.email, text))}
          onSendAudio={guard((blob, duration) => messenger.sendAudio(activeContact.email, blob, duration))}
          onSendImage={guard((blob) => messenger.sendImage(activeContact.email, blob))}
          onRetry={guard(messenger.retry)}
          onImageClick={(blob, mimeType, protect) => setLightbox({ blob, mimeType, protect })}
          onCopyMessage={async (msg) => {
            try {
              await navigator.clipboard.writeText(msg.text || '');
              setInfo('Mesaj kopyalandı.');
            } catch {
              setToast('Kopyalanamadı. Tarayıcı pano erişimine izin vermedi.');
            }
          }}
          onForwardMessage={(msg) => setForwardMsg(msg)}
          onError={setToast}
        />
      </div>

      {isSettingsOpen && (
        <SettingsModal
          me={me}
          identity={identity}
          myCode={myCode}
          discoverable={Boolean(identityState.profile?.discoverable)}
          onSetDiscoverable={identityState.setDiscoverable}
          onRegenerateCode={identityState.regenerateCode}
          role={role}
          contacts={contacts}
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
          onSendTransfer={identityState.sendTransfer}
          onVerifyContact={(email) => {
            setIsSettingsOpen(false);
            setVerifyEmail(email);
          }}
          notifPerm={notifPerm}
          onRequestNotifications={enableSystemNotifications}
          onHistoryCleared={() => {
            messenger.clearMemory();
            if (activeEmail) openConversation(activeEmail);
          }}
          onClose={() => setIsSettingsOpen(false)}
          onLogout={onLogout}
        />
      )}

      {verifyEmail && (
        <VerifyContactModal
          me={me}
          identity={identity}
          myCode={myCode}
          contact={contacts.find((c) => c.email === verifyEmail)}
          trusted={messenger.trusted[verifyEmail]}
          onVerifyByCode={messenger.verifyByCode}
          onVerifyBySafetyNumber={messenger.verifyBySafetyNumber}
          onUnverify={messenger.unverifyContact}
          onAcceptKey={messenger.acceptNewKey}
          onRemoveContact={messenger.removeContact}
          onClose={() => setVerifyEmail(null)}
        />
      )}

      {reportEmail && (
        <ReportModal
          contact={contacts.find((c) => c.email === reportEmail) || { name: 'Kişi' }}
          onSubmit={async ({ reason, details, evidence, alsoBlock }) => {
            await messenger.report(reportEmail, reason, details, evidence);
            if (alsoBlock) await messenger.block(reportEmail);
          }}
          onClose={() => setReportEmail(null)}
        />
      )}

      {newChatOpen && (
        <NewChatModal
          myCode={myCode}
          onAdd={async (email) => {
            const added = await messenger.addContact(email);
            setNewChatOpen(false);
            openConversation(added);
          }}
          onClose={() => setNewChatOpen(false)}
        />
      )}

      {lightbox && (
        <ImageLightbox blob={lightbox.blob} mimeType={lightbox.mimeType} protect={lightbox.protect} onClose={() => setLightbox(null)} />
      )}

      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          contacts={contacts}
          onForward={async (to) => {
            await messenger.forward(forwardMsg, to);
            setInfo('Mesaj iletildi.');
          }}
          onClose={() => setForwardMsg(null)}
        />
      )}

      {info && (
        <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[#202c33] px-4 py-2.5 text-xs text-[#e9edef] shadow-xl border border-[#2a3942]">
          {info}
        </div>
      )}

      {showNotifPrompt && (
        <div className="fixed bottom-3 left-1/2 z-[55] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#2a3942] bg-[#202c33] px-3 py-2.5 text-xs text-[#e9edef] shadow-xl">
          <Bell className="h-4 w-4 shrink-0 text-[#00a884]" />
          <span className="flex-1 leading-snug">Uygulama arka plandayken yeni mesajlardan haberdar olmak için bildirimlere izin verin.</span>
          <button onClick={enableSystemNotifications} className="shrink-0 rounded-lg bg-[#00a884] px-2.5 py-1.5 font-semibold text-[#111b21] cursor-pointer">
            İzin ver
          </button>
          <button onClick={dismissNotifPrompt} aria-label="Şimdi değil" className="shrink-0 text-[#8696a0] hover:text-[#e9edef] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {inAppAlert && (
        <button
          onClick={() => {
            openConversation(inAppAlert.sender);
            setInAppAlert(null);
          }}
          className="fixed right-3 top-[72px] z-[60] flex max-w-[90vw] items-center gap-2.5 rounded-xl border border-[#00a884]/40 bg-[#202c33] px-3.5 py-2.5 text-left text-xs text-[#e9edef] shadow-xl cursor-pointer"
        >
          <Bell className="h-4 w-4 shrink-0 text-[#00a884]" />
          <span>
            <strong>{inAppAlert.name}</strong> size yeni bir mesaj gönderdi
          </span>
        </button>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 max-w-[90vw] rounded-xl bg-red-900/95 px-4 py-2.5 text-xs text-red-50 shadow-xl border border-red-700">
          {toast}
        </div>
      )}
    </div>
  );
}
