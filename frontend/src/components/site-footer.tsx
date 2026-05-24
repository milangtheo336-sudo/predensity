'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const SOCIAL_LINKS = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>,
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@predensity.com',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  },
];

export function FloatingBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 450);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 right-4 z-40 md:hidden px-3.5 py-1.5 rounded-full bg-[#1c2028] text-[11px] font-medium text-gray-300 shadow-md border border-white/[0.08] transition-opacity"
    >
      Back to top &uarr;
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-[#0a0a0a] pb-32 md:pb-10">

      {/* Show more markets CTA */}
      <div className="flex justify-center pt-8 pb-2">
        <Link
          href="/markets"
          className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-white/15 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          Show more markets
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-10">

        {/* Logo + tagline */}
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="200 90 180 255" className="w-5 h-6 fill-black dark:fill-white flex-shrink-0" aria-hidden="true">
            <path d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C374.05 146.213 373.601 159.985 373.584 164.447L373.599 192.072L373.666 224.482C373.675 228.554 373.952 237.838 373.375 241.468C372.011 242.877 356.932 251.166 354.389 252.641L312.721 276.986C305.815 281.054 296.401 286.354 289.839 290.686C289.619 293.215 289.809 298.382 289.787 301.124C289.68 308.606 289.635 316.088 289.65 323.571C289.677 327.425 289.803 331.289 289.773 335.141C289.76 336.729 290.036 338.935 288.436 339.585C285.705 339.087 266.579 327.47 262.978 325.348C256.514 321.661 205.572 292.495 203.898 290.536C202.619 285.701 203.257 273.352 203.253 267.959L203.291 227.886L203.283 208.302C203.274 203.72 203.011 195.982 204.029 191.795C204.596 191.052 205.617 190.334 206.416 189.853C216.455 183.811 226.692 178.14 236.617 171.904C238.963 170.431 241.711 168.701 244.2 167.533C233.649 160.849 222.762 154.845 212.098 148.347C210.214 147.2 204.232 144.393 204.061 142.411C205.58 140.802 223.805 130.547 227.161 128.575L268.583 104.477C273.179 101.79 283.771 94.5567 288.289 93.2865ZM247.704 167.249C251.307 169.147 259.609 174.058 262.892 176.452C267.007 179.454 285.565 188.818 287.402 191.793C287.326 195.313 248.867 214.553 247.719 216.891C246.292 219.797 246.788 262.35 247.109 265.393C250.027 267.759 259.326 272.583 263.319 275.135C270.475 279.293 279.997 285.139 287.341 288.503C287.106 283.644 287.176 276.102 287.23 271.171C287.314 263.464 286.416 249.288 287.765 242.115C287.826 242.038 287.885 241.96 287.946 241.883C290.411 238.785 297.09 235.818 300.681 233.748C304.516 231.536 328.516 218.126 329.342 216.452C329.822 215.477 329.886 213.906 329.933 212.838C330.273 205.147 329.94 197.29 329.972 189.585C330.001 182.722 330.477 175.471 329.855 168.642C329.828 168.342 329.795 168.043 329.755 167.745C327.161 165.663 317.302 159.764 314.154 158.202C309.988 156.134 291.173 143.866 288.497 143.705C284.455 144.985 279.89 148.051 276.196 150.299L258.871 160.833C255.22 163.048 251.567 165.464 247.704 167.249Z" />
          </svg>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Predensity</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">The prediction market for everyone.</p>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">

          {/* Support & Social col */}
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">Support &amp; Social</div>
            <ul className="space-y-2.5">
              <li><a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Blog</a></li>
              <li><a href="https://x.com/predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">X (Twitter)</a></li>
              <li><a href="https://instagram.com/predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Instagram</a></li>
              <li><a href="https://tiktok.com/@predensity.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">TikTok</a></li>
              <li><a href="https://youtube.com/@predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">YouTube</a></li>
              <li><a href="mailto:support@predensity.com" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Contact us</a></li>
            </ul>
          </div>

          {/* Predensity col */}
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">Predensity</div>
            <ul className="space-y-2.5">
              <li><a href="https://predensity.gitbook.io/predensity-whitepaper" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Whitepaper</a></li>
              <li><Link href="/privacy" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link href="/cookies" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>

        </div>

        {/* Social icons row */}
        <div className="flex items-center gap-4 mb-4">
          {SOCIAL_LINKS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {s.icon}
            </a>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center py-4 border-t border-gray-200 dark:border-white/[0.06]">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} Predensity. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
