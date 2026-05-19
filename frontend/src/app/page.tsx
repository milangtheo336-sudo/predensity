'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { WaitlistHeader } from '@/components/waitlist-header';

// ─── Confetti Canvas ───────────────────────────────────────────────
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#c8ff00', '#00ff88', '#ff006e', '#3a86ff', '#ffbe0b', '#fb5607', '#8338ec'];
    const particles: Array<{
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number; rot: number; vr: number; opacity: number;
    }> = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.05;
        if (p.y > canvas.height) p.opacity -= 0.02;
        if (p.opacity <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

// ─── Turnstile Widget ──────────────────────────────────────────────
function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !containerRef.current) return;

    // Load Turnstile script if not loaded
    if (!(window as any).turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => renderWidget();
      document.head.appendChild(script);
    } else {
      renderWidget();
    }

    function renderWidget() {
      if (!containerRef.current) return;
      (window as any).turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => onVerify(token),
      });
    }
  }, [onVerify]);

  return <div ref={containerRef} className="flex justify-center mt-4" />;
}

// ─── Social Proof Avatars ──────────────────────────────────────────
function SocialProofAvatars({ count }: { count: number }) {
  const avatarColors = ['#c8ff00', '#3a86ff', '#ff006e', '#ffbe0b', '#8338ec'];
  const initials = ['A', 'M', 'K', 'J', 'S'];

  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <div className="flex -space-x-2">
        {avatarColors.map((color, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center text-xs font-bold text-black"
            style={{ backgroundColor: color, zIndex: 5 - i }}
          >
            {initials[i]}
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-400">
        Join {count > 0 ? count.toLocaleString() : ''}
        {count > 0 ? '+' : ''} others on the waitlist
      </span>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────
function WaitlistFooter() {
  return (
    <footer className="w-full border-t border-white/[0.06] mt-12 md:mt-20">
      <div className="max-w-5xl mx-auto px-5 pt-10 pb-8">
        {/* Logo + tagline */}
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="200 90 180 255" className="w-5 h-6 fill-white flex-shrink-0" aria-hidden="true">
            <path d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C374.05 146.213 373.601 159.985 373.584 164.447L373.599 192.072L373.666 224.482C373.675 228.554 373.952 237.838 373.375 241.468C372.011 242.877 356.932 251.166 354.389 252.641L312.721 276.986C305.815 281.054 296.401 286.354 289.839 290.686C289.619 293.215 289.809 298.382 289.787 301.124C289.68 308.606 289.635 316.088 289.65 323.571C289.677 327.425 289.803 331.289 289.773 335.141C289.76 336.729 290.036 338.935 288.436 339.585C285.705 339.087 266.579 327.47 262.978 325.348C256.514 321.661 205.572 292.495 203.898 290.536C202.619 285.701 203.257 273.352 203.253 267.959L203.291 227.886L203.283 208.302C203.274 203.72 203.011 195.982 204.029 191.795C204.596 191.052 205.617 190.334 206.416 189.853C216.455 183.811 226.692 178.14 236.617 171.904C238.963 170.431 241.711 168.701 244.2 167.533C233.649 160.849 222.762 154.845 212.098 148.347C210.214 147.2 204.232 144.393 204.061 142.411C205.58 140.802 223.805 130.547 227.161 128.575L268.583 104.477C273.179 101.79 283.771 94.5567 288.289 93.2865ZM247.704 167.249C251.307 169.147 259.609 174.058 262.892 176.452C267.007 179.454 285.565 188.818 287.402 191.793C287.326 195.313 248.867 214.553 247.719 216.891C246.292 219.797 246.788 262.35 247.109 265.393C250.027 267.759 259.326 272.583 263.319 275.135C270.475 279.293 279.997 285.139 287.341 288.503C287.106 283.644 287.176 276.102 287.23 271.171C287.314 263.464 286.416 249.288 287.765 242.115C287.826 242.038 287.885 241.96 287.946 241.883C290.411 238.785 297.09 235.818 300.681 233.748C304.516 231.536 328.516 218.126 329.342 216.452C329.822 215.477 329.886 213.906 329.933 212.838C330.273 205.147 329.94 197.29 329.972 189.585C330.001 182.722 330.477 175.471 329.855 168.642C329.828 168.342 329.795 168.043 329.755 167.745C327.161 165.663 317.302 159.764 314.154 158.202C309.988 156.134 291.173 143.866 288.497 143.705C284.455 144.985 279.89 148.051 276.196 150.299L258.871 160.833C255.22 163.048 251.567 165.464 247.704 167.249Z" />
          </svg>
          <span className="text-lg font-bold text-white">Predensity</span>
        </div>
        <p className="text-sm text-gray-500 mb-8">Monetize your boldness on Predensity.</p>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-3">Support &amp; Social</div>
            <ul className="space-y-2.5">
              <li><a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition-colors">Blog</a></li>
              <li><a href="https://x.com/predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition-colors">X (Twitter)</a></li>
              <li><a href="https://tiktok.com/@predensity.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition-colors">TikTok</a></li>
              <li><a href="mailto:support@predensity.com" className="text-sm text-gray-300 hover:text-white transition-colors">Contact us</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-3">Predensity</div>
            <ul className="space-y-2.5">
              <li><a href="https://predensity.gitbook.io/predensity-whitepaper" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition-colors">Whitepaper</a></li>
              <li><Link href="/privacy" className="text-sm text-gray-300 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-300 hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link href="/cookies" className="text-sm text-gray-300 hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Social icons */}
        <div className="flex items-center gap-4 mb-4">
          <a href="https://x.com/predensity" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
          </a>
          <a href="https://tiktok.com/@predensity.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
          </a>
        </div>

        {/* Bottom */}
        <div className="pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Predensity. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Success Screen ────────────────────────────────────────────────
function SuccessScreen({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = 'https://predensity.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <ConfettiCanvas />
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <svg viewBox="200 90 180 255" className="w-6 h-7 fill-white" aria-hidden="true">
              <path d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C374.05 146.213 373.601 159.985 373.584 164.447L373.599 192.072L373.666 224.482C373.675 228.554 373.952 237.838 373.375 241.468C372.011 242.877 356.932 251.166 354.389 252.641L312.721 276.986C305.815 281.054 296.401 286.354 289.839 290.686C289.619 293.215 289.809 298.382 289.787 301.124C289.68 308.606 289.635 316.088 289.65 323.571C289.677 327.425 289.803 331.289 289.773 335.141C289.76 336.729 290.036 338.935 288.436 339.585C285.705 339.087 266.579 327.47 262.978 325.348C256.514 321.661 205.572 292.495 203.898 290.536C202.619 285.701 203.257 273.352 203.253 267.959L203.291 227.886L203.283 208.302C203.274 203.72 203.011 195.982 204.029 191.795C204.596 191.052 205.617 190.334 206.416 189.853C216.455 183.811 226.692 178.14 236.617 171.904C238.963 170.431 241.711 168.701 244.2 167.533C233.649 160.849 222.762 154.845 212.098 148.347C210.214 147.2 204.232 144.393 204.061 142.411C205.58 140.802 223.805 130.547 227.161 128.575L268.583 104.477C273.179 101.79 283.771 94.5567 288.289 93.2865ZM247.704 167.249C251.307 169.147 259.609 174.058 262.892 176.452C267.007 179.454 285.565 188.818 287.402 191.793C287.326 195.313 248.867 214.553 247.719 216.891C246.292 219.797 246.788 262.35 247.109 265.393C250.027 267.759 259.326 272.583 263.319 275.135C270.475 279.293 279.997 285.139 287.341 288.503C287.106 283.644 287.176 276.102 287.23 271.171C287.314 263.464 286.416 249.288 287.765 242.115C287.826 242.038 287.885 241.96 287.946 241.883C290.411 238.785 297.09 235.818 300.681 233.748C304.516 231.536 328.516 218.126 329.342 216.452C329.822 215.477 329.886 213.906 329.933 212.838C330.273 205.147 329.94 197.29 329.972 189.585C330.001 182.722 330.477 175.471 329.855 168.642C329.828 168.342 329.795 168.043 329.755 167.745C327.161 165.663 317.302 159.764 314.154 158.202C309.988 156.134 291.173 143.866 288.497 143.705C284.455 144.985 279.89 148.051 276.196 150.299L258.871 160.833C255.22 163.048 251.567 165.464 247.704 167.249Z" />
            </svg>
            <span className="text-xl font-bold text-white">Predensity</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            You&apos;re on the waitlist!
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-md mb-2">
            You&apos;ve successfully secured your spot. Excited?
          </p>
          <p className="text-gray-400 text-sm md:text-base max-w-md mb-8">
            Feel free to refer your friends!
          </p>

          {/* Share URL */}
          <div className="w-full max-w-md mb-6">
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3">
              <span className="flex-1 text-sm text-gray-400 truncate">{shareUrl}</span>
              <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Copy link"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-[#c8ff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">or</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I just joined the Predensity waitlist! The prediction market that doesn't care if you're right or wrong. Monetize your boldness. " + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
              Share
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent("I just joined the Predensity waitlist! The prediction market that doesn't care if you're right or wrong. Monetize your boldness. " + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1877F2] hover:bg-[#166ada] text-white text-sm font-medium transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Share
            </a>
          </div>
        </div>

        <WaitlistFooter />
      </div>
    </>
  );
}

// ─── Main Waitlist Page ────────────────────────────────────────────
export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!turnstileToken) {
      setErrorMsg('Please complete the verification first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), turnstileToken }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to join waitlist');
      }

      if (result.success) {
        setStatus('success');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return <SuccessScreen email={email} />;
  }

  return (
    <div className="bg-[#0a0a0a]">
      {/* Header */}
      <WaitlistHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* Main content */}
      <div className="flex flex-col items-center px-4 pt-12 md:pt-24 pb-16">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-300 tracking-wide uppercase">{t.comingSoon}</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white text-center max-w-3xl leading-tight mb-4">
          {t.getEarlyAccess}
        </h1>

        {/* Subheadline */}
        <p className="text-gray-400 text-center text-sm md:text-lg max-w-md md:max-w-xl mb-3 leading-relaxed">
          {t.waitlistTagline}
        </p>

        {/* Tagline */}
        <p className="text-white font-medium text-sm md:text-base text-center mb-8">
          {t.waitlistSubtagline}
        </p>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="relative rounded-lg p-[1px] overflow-hidden">
            {/* Animated glow border */}
            <div className="absolute inset-0 rounded-lg" style={{
              background: 'conic-gradient(from var(--glow-angle, 0deg), transparent 0%, rgba(255,255,255,0.8) 10%, transparent 20%, transparent 80%, rgba(255,255,255,0.8) 90%, transparent 100%)',
              animation: 'glowSpin 3s linear infinite',
            }} />
            {/* Inner container */}
            <div className="relative flex items-center gap-2 bg-[#111111] rounded-lg px-2 py-1.5">
              <input
                id="waitlist-email"
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-2.5 rounded-md bg-white hover:bg-gray-200 text-black font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t.joining}
                  </span>
                ) : t.joinWaitlist}
              </button>
            </div>
          </div>

          {/* Turnstile */}
          <TurnstileWidget onVerify={handleTurnstileVerify} />

          {/* Error message */}
          {status === 'error' && errorMsg && (
            <p className="mt-3 text-sm text-red-400 text-center">{errorMsg}</p>
          )}
        </form>

      </div>

      {/* Footer */}
      <WaitlistFooter />
    </div>
  );
}
