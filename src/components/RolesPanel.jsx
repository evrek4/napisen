// napisen - Admin: moderatör yetkisi verme / kaldırma
import React, { useEffect, useState } from 'react';
import { Shield, Trash2, Crown } from 'lucide-react';
import { subscribeRoles, grantModerator, revokeRole } from '../services/firebase';
import { normalizeEmail } from '../services/crypto';
import { OWNER_EMAIL } from '../config/app';

export default function RolesPanel({ me }) {
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => subscribeRoles(setRoles, () => setMsg('Liste yüklenemedi.')), []);

  const add = async (e) => {
    e.preventDefault();
    const clean = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMsg('Geçerli bir e-posta adresi yazın.');
      return;
    }
    if (clean === OWNER_EMAIL) {
      setMsg('Bu hesap zaten admin.');
      return;
    }
    try {
      await grantModerator(clean, me.email);
      setEmail('');
      setMsg(`✓ ${clean} artık moderatör.`);
    } catch (err) {
      setMsg('Eklenemedi: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#8696a0]">
        Moderatörler şikâyetleri inceleyebilir ve hesapları askıya alabilir. Mesaj içeriklerini göremezler; yalnızca
        şikâyet eden kişinin eklediği delil mesajları görürler.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="moderator@gmail.com"
          className="min-w-0 flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-sm placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-[#111b21] cursor-pointer">
          <Shield className="h-4 w-4" /> Moderatör yap
        </button>
      </form>
      {msg && <p className="text-xs text-[#00a884]">{msg}</p>}
      <div className="divide-y divide-[#222d34] rounded-xl border border-[#2a3942] bg-[#182229]">
        <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs">
          <Crown className="h-3.5 w-3.5 text-amber-400" /> {OWNER_EMAIL} <span className="text-[#8696a0]">(admin)</span>
        </div>
        {roles.map((r) => (
          <div key={r.email} className="flex items-center justify-between px-3 py-2.5 text-xs">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[#53bdeb]" /> {r.email}
            </span>
            <button
              onClick={async () => {
                if (!window.confirm(`${r.email} kişisinin moderatör yetkisi kaldırılsın mı?`)) return;
                try {
                  await revokeRole(r.email);
                  setMsg('Yetki kaldırıldı.');
                } catch (err) {
                  setMsg('Kaldırılamadı: ' + err.message);
                }
              }}
              aria-label="Yetkiyi kaldır"
              className="rounded p-1 text-[#8696a0] hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
