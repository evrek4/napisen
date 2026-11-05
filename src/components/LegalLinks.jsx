// napisen - Yasal metin bağlantıları
import React from 'react';
import { TERMS, PRIVACY } from '../legal/texts';

export function openLegal(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function LegalLinks({ className = '' }) {
  const link = (page) => (
    <a
      href={page.path}
      onClick={(e) => {
        e.preventDefault();
        openLegal(page.path);
      }}
      className="underline decoration-dotted underline-offset-2 hover:text-[#e9edef]"
    >
      {page.title}
    </a>
  );
  return (
    <p className={`text-[11px] leading-relaxed text-[#8696a0] ${className}`}>
      {link(TERMS)} · {link(PRIVACY)}
    </p>
  );
}
