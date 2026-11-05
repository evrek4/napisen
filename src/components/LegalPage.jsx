// napisen - Yasal metin sayfası (giriş yapmadan da açılabilir)
import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '../config/app';

export default function LegalPage({ page, onBack }) {
  useEffect(() => {
    document.title = `${page.title} | ${LEGAL.appName}`;
    return () => {
      document.title = 'napisen | Güvenli Mesajlaşma';
    };
  }, [page.title]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0b141a] text-[#e9edef]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-sm text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="mt-1 text-xs text-[#8696a0]">Son güncelleme: {LEGAL.lastUpdated}</p>

        <div className="mt-6 space-y-6">
          {page.sections.map((sec) => (
            <section key={sec.title}>
              <h2 className="text-base font-semibold text-[#e9edef]">{sec.title}</h2>
              {sec.body?.map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-[#c5cdd2]">
                  {p}
                </p>
              ))}
              {sec.list && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#c5cdd2]">
                  {sec.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
