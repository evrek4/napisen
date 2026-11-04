// napisen - Ana Uygulama Çerçevesi
import React, { useState, useEffect, useCallback } from 'react';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import ImageLightbox from './components/ImageLightbox';
import { getWhitelist } from './config/whitelist';
import { getPreferences, savePreferences } from './config/preferences';
import {
  saveMessage,
  getMessagesByConversation,
  updateMessageStatus,
  saveMediaBlob,
  getMediaBlob,
} from './services/db';
import {
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
  encryptMediaBlob,
  decryptMediaBlob,
} from './services/crypto';
import {
  sendEncryptedToQueue,
  listenForIncomingQueue,
  listenForDeliveryAcks,
} from './services/firebase';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('napisen_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [preferences, setPreferences] = useState(getPreferences());
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Tercih değişikliklerini dinle
  useEffect(() => {
    const handlePrefsChange = (e) => {
      setPreferences(e.detail);
    };
    window.addEventListener('napisen_prefs_changed', handlePrefsChange);
    return () => window.removeEventListener('napisen_prefs_changed', handlePrefsChange);
  }, []);

  // İzinli kişileri (Whitelist) rehbere yükleme
  const reloadContacts = useCallback(() => {
    const list = getWhitelist();
    const formatted = list.map((email) => {
      let name = email.split('@')[0];
      if (email.toLowerCase().includes('fthtrgl')) name = 'Fatih Tuğrul';
      else if (email.toLowerCase().includes('mehmetbacar')) name = 'Mehmet Bacar';
      else if (email.toLowerCase().includes('urfahibe')) name = 'Urfa Hibe Danışmanlık';

      return {
        email,
        name,
        unreadCount: 0,
        lastMessageText: '',
        lastMessageType: 'text',
        lastMessageTime: '',
      };
    });
    setContacts(formatted);
  }, []);

  useEffect(() => {
    reloadContacts();
  }, [reloadContacts]);

  // Aktif konuşmanın mesajlarını cihaz içi veritabanından yükleme
  const loadConversationMessages = useCallback(async (contactEmail) => {
    if (!currentUser || !contactEmail) return;

    // Eğer kullanıcı "Yazılar cihazda tutulmasın" modundaysa cihaz veritabanından okuma yapmaz (RAM'deki mesajlar korunur)
    if (preferences.dontStoreOnDevice) {
      return;
    }

    const emails = [currentUser.email.toLowerCase(), contactEmail.toLowerCase()].sort();
    const conversationId = `${emails[0]}_${emails[1]}`;

    const rawMsgs = await getMessagesByConversation(conversationId);

    const populated = await Promise.all(
      rawMsgs.map(async (m) => {
        if ((m.type === 'audio' || m.type === 'image') && !m.mediaBlob) {
          const blob = await getMediaBlob(m.id);
          return { ...m, mediaBlob: blob };
        }
        return m;
      })
    );

    setMessages(populated);
  }, [currentUser, preferences.dontStoreOnDevice]);

  useEffect(() => {
    if (activeContact) {
      loadConversationMessages(activeContact.email);
    } else {
      setMessages([]);
    }
  }, [activeContact, loadConversationMessages]);

  // GELEN MESAJLARI DİNLEME
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeQueue = listenForIncomingQueue(currentUser.email, async (data) => {
      try {
        const senderEmail = data.from;
        const key = await deriveSharedKey(currentUser.email, senderEmail);

        let decryptedText = '';
        let mediaBlob = null;
        let duration = null;

        if (data.type === 'text') {
          const payload = await decryptPayload(key, data.payload);
          decryptedText = typeof payload === 'object' ? payload.text : payload;
        } else if (data.type === 'audio') {
          mediaBlob = await decryptMediaBlob(key, data.payload.media);
          duration = data.payload.duration || 1;
          if (!preferences.dontStoreOnDevice) {
            await saveMediaBlob(data.id, mediaBlob);
          }
        } else if (data.type === 'image') {
          mediaBlob = await decryptMediaBlob(key, data.payload.media);
          if (!preferences.dontStoreOnDevice) {
            await saveMediaBlob(data.id, mediaBlob);
          }
        }

        const emails = [currentUser.email.toLowerCase(), senderEmail.toLowerCase()].sort();
        const conversationId = `${emails[0]}_${emails[1]}`;

        const newMsg = {
          id: data.id,
          conversationId,
          sender: senderEmail,
          receiver: currentUser.email,
          text: decryptedText,
          type: data.type,
          mediaBlob,
          duration,
          timestamp: data.createdAt || Date.now(),
          status: 'read',
          isOutgoing: false,
        };

        // YAZILAR CİHAZDA TUTULMASIN SEÇENEĞİ KONTROLÜ
        // Eğer tercih aktif değilse yerel veritabanına kaydet; aktifse yalnızca oturum süresince ekranda tut
        if (!preferences.dontStoreOnDevice) {
          await saveMessage(newMsg);
        }

        // Aktif sohbet açıksa arayüzde göster
        setActiveContact((prevActive) => {
          if (prevActive && prevActive.email.toLowerCase() === senderEmail.toLowerCase()) {
            setMessages((prev) => [...prev, newMsg]);
          }
          return prevActive;
        });

        // Sol listedeki son mesajı güncelle
        setContacts((prevContacts) =>
          prevContacts.map((c) => {
            if (c.email.toLowerCase() === senderEmail.toLowerCase()) {
              return {
                ...c,
                lastMessageText: decryptedText || (data.type === 'audio' ? 'Sesli Mesaj' : 'Fotoğraf'),
                lastMessageType: data.type,
                lastMessageTime: new Date(newMsg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                unreadCount: (c.unreadCount || 0) + 1,
              };
            }
            return c;
          })
        );
      } catch (err) {
        console.error('Gelen şifreli mesaj işlenemedi:', err);
      }
    });

    const unsubscribeAcks = listenForDeliveryAcks(async (messageId) => {
      if (!preferences.dontStoreOnDevice) {
        await updateMessageStatus(messageId, 'delivered');
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    });

    return () => {
      unsubscribeQueue();
      unsubscribeAcks();
    };
  }, [currentUser, preferences.dontStoreOnDevice]);

  // METİN MESAJI GÖNDERME
  const handleSendText = async (text) => {
    if (!currentUser || !activeContact) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const emails = [currentUser.email.toLowerCase(), activeContact.email.toLowerCase()].sort();
    const conversationId = `${emails[0]}_${emails[1]}`;

    // 1. Cihazda E2EE ile şifrele
    const key = await deriveSharedKey(currentUser.email, activeContact.email);
    const encryptedPayload = await encryptPayload(key, { text, timestamp: Date.now() });

    const localMsg = {
      id: messageId,
      conversationId,
      sender: currentUser.email,
      receiver: activeContact.email,
      text,
      type: 'text',
      timestamp: Date.now(),
      status: 'sent',
      isOutgoing: true,
    };

    // 2. Cihazda saklama tercihi kontrolü
    if (!preferences.dontStoreOnDevice) {
      await saveMessage(localMsg);
    }
    setMessages((prev) => [...prev, localMsg]);

    // 3. Şifreli paketi geçici kuyruğa ilet (Sunucuda saklama tercihiyle)
    await sendEncryptedToQueue({
      from: currentUser.email,
      to: activeContact.email,
      payload: encryptedPayload,
      type: 'text',
      keepOnServer: preferences.serverStorageEnabled,
    });
  };

  // SESLİ MESAJ GÖNDERME
  const handleSendAudio = async (audioBlob, duration) => {
    if (!currentUser || !activeContact) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const emails = [currentUser.email.toLowerCase(), activeContact.email.toLowerCase()].sort();
    const conversationId = `${emails[0]}_${emails[1]}`;

    if (!preferences.dontStoreOnDevice) {
      await saveMediaBlob(messageId, audioBlob);
    }

    const key = await deriveSharedKey(currentUser.email, activeContact.email);
    const encryptedMedia = await encryptMediaBlob(key, audioBlob);

    const localMsg = {
      id: messageId,
      conversationId,
      sender: currentUser.email,
      receiver: activeContact.email,
      mediaBlob: audioBlob,
      duration,
      type: 'audio',
      timestamp: Date.now(),
      status: 'sent',
      isOutgoing: true,
    };

    if (!preferences.dontStoreOnDevice) {
      await saveMessage(localMsg);
    }
    setMessages((prev) => [...prev, localMsg]);

    await sendEncryptedToQueue({
      from: currentUser.email,
      to: activeContact.email,
      payload: { media: encryptedMedia, duration },
      type: 'audio',
      keepOnServer: preferences.serverStorageEnabled,
    });
  };

  // FOTOĞRAF / GÖRSEL GÖNDERME
  const handleSendImage = async (imageFile) => {
    if (!currentUser || !activeContact) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const emails = [currentUser.email.toLowerCase(), activeContact.email.toLowerCase()].sort();
    const conversationId = `${emails[0]}_${emails[1]}`;

    if (!preferences.dontStoreOnDevice) {
      await saveMediaBlob(messageId, imageFile);
    }

    const key = await deriveSharedKey(currentUser.email, activeContact.email);
    const encryptedMedia = await encryptMediaBlob(key, imageFile);

    const localMsg = {
      id: messageId,
      conversationId,
      sender: currentUser.email,
      receiver: activeContact.email,
      mediaBlob: imageFile,
      type: 'image',
      timestamp: Date.now(),
      status: 'sent',
      isOutgoing: true,
    };

    if (!preferences.dontStoreOnDevice) {
      await saveMessage(localMsg);
    }
    setMessages((prev) => [...prev, localMsg]);

    await sendEncryptedToQueue({
      from: currentUser.email,
      to: activeContact.email,
      payload: { media: encryptedMedia },
      type: 'image',
      keepOnServer: preferences.serverStorageEnabled,
    });
  };

  const handleTogglePreference = (key) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    savePreferences(updated);
  };

  const handleLogout = () => {
    localStorage.removeItem('napisen_current_user');
    setCurrentUser(null);
    setActiveContact(null);
    setIsSettingsOpen(false);
  };

  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          reloadContacts();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b141a]">
      {/* Sol Kenar Çubuğu */}
      <div
        className={`${
          activeContact ? 'hidden md:flex' : 'flex'
        } h-full w-full md:w-auto shrink-0`}
      >
        <Sidebar
          currentUser={currentUser}
          contacts={contacts}
          activeContact={activeContact}
          onSelectContact={(c) => {
            setActiveContact(c);
            setContacts((prev) =>
              prev.map((item) => (item.email === c.email ? { ...item, unreadCount: 0 } : item))
            );
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Sağ Aktif Sohbet Alanı */}
      <div
        className={`${
          !activeContact ? 'hidden md:flex' : 'flex'
        } flex-1 h-full overflow-hidden`}
      >
        <ChatArea
          activeContact={activeContact}
          currentUser={currentUser}
          messages={messages}
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
          onBack={() => setActiveContact(null)}
          onSendText={handleSendText}
          onSendAudio={handleSendAudio}
          onSendImage={handleSendImage}
          onImageClick={(url) => setLightboxImage(url)}
        />
      </div>

      {/* Ayarlar ve Whitelist Modalı */}
      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
          onClose={() => {
            setIsSettingsOpen(false);
            reloadContacts();
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Tam Ekran Görsel İnceleyici */}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
