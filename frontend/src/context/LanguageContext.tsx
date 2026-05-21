'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import T, { LangCode, Translations, LANGUAGES, suggestLanguage } from '@/lib/i18n/translations';

interface LanguageContextType {
  lang: LangCode;
  t: Translations;
  setLang: (lang: LangCode) => void;
  suggestedLang: LangCode | null;
  countryCode: string | null;
  countryName: string | null;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  t: T['en'],
  setLang: () => {},
  suggestedLang: null,
  countryCode: null,
  countryName: null,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [suggestedLang, setSuggestedLang] = useState<LangCode | null>(null);

  useEffect(() => {
    // Restore saved language
    const saved = localStorage.getItem('predensity-lang') as LangCode | null;
    if (saved && T[saved]) setLangState(saved);

    // Detect country — use cached value first
    const cachedCountry = sessionStorage.getItem('predensity-country');
    const cachedCountryName = sessionStorage.getItem('predensity-country-name');
    if (cachedCountry) {
      setCountryCode(cachedCountry);
      setCountryName(cachedCountryName);
      if (!saved) {
        const suggested = suggestLanguage(cachedCountry);
        if (suggested !== 'en') setSuggestedLang(suggested);
      }
      return;
    }

    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((data) => {
        const code = (data.country_code ?? '').toUpperCase();
        const name = data.country_name ?? null;
        if (/^[A-Z]{2}$/.test(code)) {
          sessionStorage.setItem('predensity-country', code);
          if (name) sessionStorage.setItem('predensity-country-name', name);
          setCountryCode(code);
          setCountryName(name);
          if (!saved) {
            const suggested = suggestLanguage(code);
            if (suggested !== 'en') setSuggestedLang(suggested);
          }
        }
      })
      .catch(() => {});
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    localStorage.setItem('predensity-lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: T[lang], setLang, suggestedLang, countryCode, countryName }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
