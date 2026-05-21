'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES, LangCode } from '@/lib/i18n/translations';

export function LanguageSwitcher({ onClose }: { onClose: () => void }) {
  const { lang, setLang, t } = useLanguage();
  const [selected, setSelected] = useState<LangCode>(lang);

  const apply = () => {
    setLang(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-neutral-950 border border-white/10 rounded-2xl w-[340px] max-w-[92vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-semibold text-white">{t.selectLanguage}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language list */}
        <div className="p-3 space-y-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setSelected(l.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                selected === l.code
                  ? 'bg-vibrant-purple/20 border border-vibrant-purple/40'
                  : 'hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              <span className="text-2xl leading-none">{l.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{l.nativeName}</div>
                <div className="text-xs text-gray-500">{l.name}</div>
              </div>
              {selected === l.code && (
                <svg className="w-4 h-4 text-vibrant-purple flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all"
          >
            {t.cancel}
          </button>
          <button
            onClick={apply}
            className="flex-1 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white text-sm font-medium transition-all"
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
