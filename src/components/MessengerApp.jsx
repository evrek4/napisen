// napisen - Giriş ve kurulum sonrası ana mesajlaşma ekranı
import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import SettingsModal from './SettingsModal';
import ImageLightbox from './ImageLightbox';
import VerifyContactModal from './VerifyContactModal';
import NewChatModal from './NewChatModal';
import ReportModal from './ReportModal';
import useMessenger from '../hooks/useMessenger';
import { getPreferences, savePreferences } from '../config/preferences';
import { clearMessageHistory } from '../services/db';

export default function MessengerApp({ me, role, identityState, onLogout }) {
  const identity = identityState.identity;
  const [preferences, setPreferences] = useState(getPreferences);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [reportEmail, setReportEmail] = useState(null);
  const [toast, setToast] = useState('');

  const myCode = identityState.profile?.code || null;
  const messenger = useMessenger({ me, identity, myCode, preferences });
  const { contacts, activeEmail, openConversation } = messenger;
  const activeContact = contacts.find((c) => c.email === activeEmail) || null;

  useEffect(() => {
    const onChange = (e) => setPreferences(e.detail);
    window.addEventListener('napisen_prefs_changed', onChange);
    return () => window.removeEventListener('napisen_prefs_changed', onChange);
  }, []);

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
          onSendText={guard((text) => messenger.sendText(activeContact.email, text))}
          onSendAudio={guard((blob, duration) => messenger.sendAudio(activeContact.email, blob, duration))}
          onSendImage={guard((blob) => messenger.sendImage(activeContact.email, blob))}
          onRetry={guard(messenger.retry)}
          onImageClick={(blob, mimeType) => setLightbox({ blob, mimeType })}
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

      {lightbox && <ImageLightbox blob={lightbox.blob} mimeType={lightbox.mimeType} onClose={() => setLightbox(null)} />}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 max-w-[90vw] rounded-xl bg-red-900/95 px-4 py-2.5 text-xs text-red-50 shadow-xl border border-red-700">
          {toast}
        </div>
      )}
    </div>
  );
}
