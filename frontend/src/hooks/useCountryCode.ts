'use client';

import { useState, useEffect } from 'react';

export function useCountryCode(): string | null {
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    // Check cache first so we don't hit the API on every page load
    const cached = sessionStorage.getItem('predensity-country');
    if (cached) { setCountryCode(cached); return; }

    fetch('https://ipapi.co/country/')
      .then((res) => res.text())
      .then((code) => {
        const trimmed = code.trim().toUpperCase();
        // Basic sanity check — country codes are 2 letters
        if (/^[A-Z]{2}$/.test(trimmed)) {
          sessionStorage.setItem('predensity-country', trimmed);
          setCountryCode(trimmed);
        }
      })
      .catch(() => {
        // Silently fail — no country badge if lookup fails
      });
  }, []);

  return countryCode;
}
