// napisen - Sol Kenar Çubuğu (Sohbet Listesi & Profil)
import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Settings,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Lock,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  contacts,
  activeContact,
  onSelectContact,
  onOpenSettings,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter((c) => {
    // Kendi hesabını listede gösterme
    if (c.email.toLowerCase() === currentUser.email.toLowerCase()) return false;
    const q = searchQuery.toLowerCase();
    return c.email.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q));
  });

  return (
    <aside className="flex flex-col h-full w-full md:w-[380px] lg:w-[420px] bg-[#111b21] border-r border-[#222d34] shrink-0 select-none">
      {/* Üst Profil Başlığı */}
      <div className="flex h-16 items-center justify-between bg-[#202c33] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] font-bold text-[#111b21] shadow">
            {currentUser.name ? currentUser.name[0].toUpperCase() : 'N'}
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#202c33] bg-[#25d366]" />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold text-[#e9edef] truncate leading-tight">
              {currentUser.name || currentUser.email.split('@')[0]}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#00a884] font-mono truncate">
              <Lock className="h-2.5 w-2.5" />
              {currentUser.email}
            </span>
          </div>
        </div>

        {/* Aksiyon İkonları */}
        <div className="flex items-center gap-1 text-[#aebac1]">
          <button
            onClick={onOpenSettings}
            title="Ayarlar & Whitelist"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#374248] active:bg-[#202c33] transition cursor-pointer"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Arama Çubuğu */}
      <div className="p-2 border-b border-[#222d34]">
        <div className="relative flex items-center rounded-lg bg-[#202c33] px-3 py-1.5">
          <Search className="h-4 w-4 text-[#8696a0] shrink-0 mr-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İzinli kişilerde ara..."
            className="w-full bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
          />
        </div>
      </div>

      {/* E2EE Bildirim Şeridi */}
      <div className="flex items-center gap-2 bg-[#182229] px-4 py-2 text-[11px] text-[#8696a0] border-b border-[#222d34]">
        <Shield className="h-3.5 w-3.5 text-[#00a884] shrink-0" />
        <span className="truncate">Tüm sohbetler uçtan uca şifrelenir (E2EE)</span>
      </div>

      {/* İzinli Kişiler / Sohbet Listesi */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/40">
        {filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8696a0]">
            Eşleşen izinli kişi bulunamadı.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isActive = activeContact?.email === contact.email;
            const initial = contact.name ? contact.name[0].toUpperCase() : contact.email[0].toUpperCase();

            return (
              <div
                key={contact.email}
                onClick={() => onSelectContact(contact)}
                className={`flex items-center gap-3.5 px-4 py-3 cursor-pointer transition select-none ${
                  isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#53bdeb] text-lg font-bold text-[#111b21]">
                  {initial}
                </div>

                {/* Bilgiler */}
                <div className="flex flex-1 flex-col truncate">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#e9edef] truncate">
                      {contact.name || contact.email.split('@')[0]}
                    </span>
                    <span className="text-[11px] text-[#8696a0] font-mono">
                      {contact.lastMessageTime || ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="flex items-center gap-1 text-xs text-[#8696a0] truncate">
                      {contact.lastMessageType === 'audio' && (
                        <>
                          <Mic className="h-3.5 w-3.5 text-[#00a884]" />
                          <span>Sesli Mesaj</span>
                        </>
                      )}
                      {contact.lastMessageType === 'image' && (
                        <>
                          <ImageIcon className="h-3.5 w-3.5 text-[#00a884]" />
                          <span>Fotoğraf</span>
                        </>
                      )}
                      {(!contact.lastMessageType || contact.lastMessageType === 'text') && (
                        <span className="truncate">
                          {contact.lastMessageText || contact.email}
                        </span>
                      )}
                    </p>

                    {contact.unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00a884] text-[11px] font-bold text-[#111b21]">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

