// napisen - Kayıt / koşul onayı
import React, { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { TERMS, PRIVACY } from '../legal/texts';
import { MIN_AGE } from '../config/app';
import { openLegal } from './LegalLinks';

export default function ConsentScreen({ email, isUpdate, onAccept, onLogout }) {
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = (page) => (
    <a
      href={page.path}
      onClick={(e) => {
        e.preventDefault();
        openLegal(page.path);
      }}
      className="text-[#00a884] underline underline-offset-2"
    >
      {page.title}
    </a>
  );

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#0b141a] p-4 text-[#e9edef]">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-[#202c33] bg-[#111b21] p-6 shadow-2xl">
        <div className="text-center">
          <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-3 text-lg font-bold">{isUpdate ? 'Koşullar güncellendi' : 'napisen’e hoş geldiniz'}</h1>
          <p className="mt-1 text-xs text-[#8696a0]">{email}</p>
        </div>

        <p className="text-xs leading-relaxed text-[#8696a0]">
          {isUpdate
            ? 'Devam etmek için güncellenen metinleri okuyup onaylamanız gerekiyor.'
            : 'Üyeliğinizi tamamlamak için lütfen aşağıdaki metinleri okuyup onaylayın.'}
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2a3942] bg-[#182229] p-3 text-xs leading-relaxed">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#00a884]" />
          <span>
            {link(TERMS)}’nı okudum ve kabul ediyorum. {link(PRIVACY)}’nı okudum; kişisel verilerimin bu metinde
            açıklandığı şekilde işleneceğini biliyorum.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2a3942] bg-[#182229] p-3 text-xs leading-relaxed">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#00a884]" />
          <span>
            {MIN_AGE} yaşından büyüğüm. (18 yaşından küçüksem uygulamayı veli/vasimin izniyle kullanıyorum.)
          </span>
        </label>

        <button
          disabled={!terms || !age || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onAccept();
            } finally {
              setBusy(false);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-[#111b21] disabled:opacity-40 cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" /> {isUpdate ? 'Onayla ve devam et' : 'Kabul et ve üye ol'}
        </button>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-[#8696a0] hover:text-red-300 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" /> Vazgeç ve çıkış yap
        </button>
      </div>
    </div>
  );
}
