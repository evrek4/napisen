// napisen - Admin: admin / moderatör yetkisi verme ve kaldırma
import React, { useEffect, useState } from 'react';
import { Shield, Trash2, Crown } from 'lucide-react';
import { subscribeRoles, grantRole, revokeRole } from '../services/firebase';
import { normalizeEmail } from '../services/crypto';

const ROLE_LABEL = { admin: 'Admin', moderator: 'Moderatör' };

export default function RolesPanel({ me }) {
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('moderator');
  const [msg, setMsg] = useState('');

  useEffect(() => subscribeRoles(setRoles, () => setMsg('Liste yüklenemedi.')), []);

  const add = async (e) => {
    e.preventDefault();
    const clean = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMsg('Geçerli bir e-posta adresi yazın.');
      return;
    }
    if (clean === me.email) {
      setMsg('Kendi rolünüzü değiştiremezsiniz.');
      return;
    }
    if (role === 'admin' && !window.confirm(`${clean} admin yapılsın mı? Adminler başka admin ve moderatör atayabilir.`)) {
      return;
    }
    try {
      await grantRole(clean, role, me.email);
      setEmail('');
      setMsg(`✓ ${clean} artık ${ROLE_LABEL[role].toLocaleLowerCase('tr-TR')}.`);
    } catch (err) {
      setMsg('Eklenemedi: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
    }
  };

  const sorted = [...roles].sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1));

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#8696a0]">
        <strong className="text-[#e9edef]">Moderatörler</strong> şikâyetleri inceler ve hesapları askıya alabilir.{' '}
        <strong className="text-[#e9edef]">Adminler</strong> ayrıca admin ve moderatör atayabilir. Hiçbiri mesaj
        içeriklerini göremez; yalnızca şikâyet eden kişinin eklediği delil mesajları görürler.
      </p>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kisi@gmail.com"
          className="min-w-0 flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-sm placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Rol"
          className="rounded-lg bg-[#202c33] px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        >
          <option value="moderator">Moderatör</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-[#111b21] cursor-pointer">
          <Shield className="h-4 w-4" /> Yetki ver
        </button>
      </form>
      {msg && <p className="text-xs text-[#00a884]">{msg}</p>}
      <div className="divide-y divide-[#222d34] rounded-xl border border-[#2a3942] bg-[#182229]">
        {sorted.length === 0 && <p className="p-3 text-xs text-[#8696a0]">Yükleniyor...</p>}
        {sorted.map((r) => (
          <div key={r.email} className="flex items-center justify-between px-3 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              {r.role === 'admin' ? (
                <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              ) : (
                <Shield className="h-3.5 w-3.5 shrink-0 text-[#53bdeb]" />
              )}
              <span className="truncate">{r.email}</span>
              <span className="shrink-0 text-[#8696a0]">({ROLE_LABEL[r.role] || r.role})</span>
              {r.email === me.email && <span className="shrink-0 text-[#8696a0]">· siz</span>}
            </span>
            {r.email !== me.email && (
              <button
                onClick={async () => {
                  if (!window.confirm(`${r.email} kişisinin ${ROLE_LABEL[r.role] || ''} yetkisi kaldırılsın mı?`)) return;
                  try {
                    await revokeRole(r.email);
                    setMsg('Yetki kaldırıldı.');
                  } catch (err) {
                    setMsg('Kaldırılamadı: ' + (err.code === 'permission-denied' ? 'yetkiniz yok.' : err.message));
                  }
                }}
                aria-label="Yetkiyi kaldır"
                className="rounded p-1 text-[#8696a0] hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
