import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, Bot, User, LineChart, Target, Flashlight, Radio, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#2980b9] selection:text-white">
      {/* TOP BANNER */}
      <a
        href="https://predensity.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-[#111] py-2 text-center text-sm hover:bg-[#1a1a1a] transition-colors group border-b border-white/5"
      >
        <span className="text-gray-400">Interested in backing Predensity early?</span>{' '}
        <span className="font-semibold text-white group-hover:text-[#2980b9] transition-colors">
          Get in touch <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </span>
      </a>

      {/* NAVBAR */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/predensity-icon.png" alt="Logo" width={32} height={32} className="rounded" />
          <span className="text-xl font-bold tracking-tight">Predensity</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <Link href="#predictive-efficiency" className="hover:text-white transition-colors">Prediction</Link>
          <Link href="#infofi" className="hover:text-white transition-colors">InfoFi</Link>
          <Link href="#signals" className="hover:text-white transition-colors">Signals</Link>
          <Link href="https://yt0-2.gitbook.io/yt-docs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</Link>
          <a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Blog</a>
        </div>

        <Link
          href="/markets"
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
        >
          Bet on BTC price
        </Link>
      </nav>

      {/* HERO SECTION */}
      <main className="max-w-7xl mx-auto px-6 mt-16 md:mt-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-gray-200">
            Whitepaper is here!
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Token price <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2980b9] to-[#3b82f6]">
              forecasting
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-lg leading-relaxed">
            A decentralized AI-powered prediction system for crypto price discovery
          </p>

          <div className="flex flex-col items-start gap-6 pt-4">
            <Link
              href="https://yt0-2.gitbook.io/yt-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-white font-medium hover:text-[#2980b9] transition-colors"
            >
              Read whitepaper
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>

            <div className="flex items-center gap-4">
              <ArrowRight className="animate-pulse text-[#2980b9] w-6 h-6" />
              <Link
                href="https://predensity.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#e2e8f0] text-black px-8 py-3 rounded-full font-bold hover:bg-white transition-all transform hover:scale-105"
              >
                Join Predensity Early
              </Link>
            </div>
          </div>
        </div>

        <div className="relative landing-float mt-8 md:mt-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#2980b9]/20 to-transparent rounded-full blur-3xl" />
          <Image
            src="/landing page images/hero section image.avif"
            alt="Predensity App Interface"
            width={800}
            height={600}
            className="relative z-10 w-full rounded-2xl shadow-2xl"
            priority
          />
          {/* Top Left Floating Coin */}
          <div className="absolute -top-12 -left-4 md:-top-16 md:-left-12 z-20 landing-float" style={{ animationDelay: '1.5s' }}>
            <Image
              src="/landing page images/graph part top left.avif"
              alt="Floating Coin"
              width={160}
              height={160}
              className="drop-shadow-2xl w-24 h-24 md:w-40 md:h-40 object-contain"
            />
          </div>
          {/* Bottom Right Floating Star */}
          <div className="absolute -bottom-8 -right-4 md:-bottom-12 md:-right-8 z-20 landing-float" style={{ animationDelay: '3s' }}>
            <Image
              src="/landing page images/graph part bottom right.avif"
              alt="Floating Star"
              width={140}
              height={140}
              className="drop-shadow-2xl w-20 h-20 md:w-36 md:h-36 object-contain"
            />
          </div>
        </div>
      </main>

      {/* SECTION 2: Illuminate future price trends */}
      <section id="predictive-efficiency" className="max-w-6xl mx-auto px-6 mt-48">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <p className="text-[#2980b9] font-semibold text-sm tracking-widest uppercase">Predictive Efficiency</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Illuminate future<br />price trends</h2>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Turns bold predictions into a real-time probability map of token prices, combining
            AI agents and human insight to surface what&apos;s next.
          </p>
        </div>

        {/* Central Graph Area */}
        <div className="relative landing-float">
          <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-[100px]" />
          <Image
            src="/landing page images/central graph image.avif"
            alt="Probability Distribution Graph"
            width={1200}
            height={600}
            className="relative z-10 w-full rounded-2xl border border-white/5 bg-[#0a0a0a]"
          />
          {/* Thumbs Up Left */}
          <div className="absolute top-1/2 -left-6 md:-left-16 z-20 -translate-y-1/2 landing-float" style={{ animationDelay: '1s' }}>
            <Image
              src="/landing page images/prediction left.avif"
              alt="Prediction Up"
              width={120}
              height={120}
              className="drop-shadow-2xl w-16 h-16 md:w-32 md:h-32 object-contain"
            />
          </div>
          {/* Thumbs Down Right */}
          <div className="absolute top-1/3 -right-6 md:-right-16 z-20 landing-float" style={{ animationDelay: '2.5s' }}>
            <Image
              src="/landing page images/prediction right.avif"
              alt="Prediction Down"
              width={120}
              height={120}
              className="drop-shadow-2xl w-16 h-16 md:w-32 md:h-32 object-contain"
            />
          </div>
        </div>

        {/* 4 Column Text Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 text-center md:text-left">
          <div className="space-y-3">
            <div className="w-8 h-8 flex items-center justify-center text-white mb-2 mx-auto md:mx-0">
              <Bot size={24} />
            </div>
            <h3 className="font-bold text-lg">AI-powered signal flow</h3>
            <p className="text-sm text-gray-400">Real-time models generate narrow, high-confidence prediction ranges</p>
            <Link href="https://yt0-2.gitbook.io/yt-docs/how-it-works/forecasting-model" className="inline-block text-xs font-semibold text-[#2980b9] hover:text-white transition-colors">Learn more →</Link>
          </div>
          <div className="space-y-3">
            <div className="w-8 h-8 flex items-center justify-center text-white mb-2 mx-auto md:mx-0">
              <User size={24} />
            </div>
            <h3 className="font-bold text-lg">Human intuition layer</h3>
            <p className="text-sm text-gray-400">Speculative bets create variance, depth, and liquidity</p>
            <Link href="https://yt0-2.gitbook.io/yt-docs/how-it-works/betting" className="inline-block text-xs font-semibold text-[#2980b9] hover:text-white transition-colors">Learn more →</Link>
          </div>
          <div className="space-y-3">
            <div className="w-8 h-8 flex items-center justify-center text-white mb-2 mx-auto md:mx-0">
              <LineChart size={24} />
            </div>
            <h3 className="font-bold text-lg">Continuous forecast map</h3>
            <p className="text-sm text-gray-400">Live time/price heatmaps reflect the evolving market view</p>
            <Link href="https://yt0-2.gitbook.io/yt-docs/how-it-works/probability-map" className="inline-block text-xs font-semibold text-[#2980b9] hover:text-white transition-colors">Learn more →</Link>
          </div>
          <div className="space-y-3">
            <div className="w-8 h-8 flex items-center justify-center text-white mb-2 mx-auto md:mx-0">
              <Target size={24} />
            </div>
            <h3 className="font-bold text-lg">Boldness meets reward</h3>
            <p className="text-sm text-gray-400">Early, accurate, and sharp predictions earn higher payouts</p>
            <Link href="https://yt0-2.gitbook.io/yt-docs/prediction-resolution/payout-system" className="inline-block text-xs font-semibold text-[#2980b9] hover:text-white transition-colors">Learn more →</Link>
          </div>
        </div>
      </section>

      {/* SECTION 3: Turn speculation into insight */}
      <section id="infofi" className="max-w-6xl mx-auto px-6 mt-48">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-block border border-[#2980b9]/30 bg-[#2980b9]/10 rounded-full px-4 py-1 text-xs text-[#2980b9] font-semibold mb-2 tracking-wide">
            Incentives drive accuracy
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Turn speculation<br />into insight</h2>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto mt-4">
            Predensity is built on the InfoFi principle that aligned incentives produce accurate
            market intelligence by aggregating diverse trader perspectives
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Card 1: AI Agents */}
          <div className="bg-[#111] border border-white/5 rounded-3xl p-12 text-center hover:bg-[#151515] transition-colors">
            <div className="h-48 flex items-center justify-center mb-8 landing-float" style={{ animationDelay: '0.5s' }}>
              <Image src="/landing page images/ai agents.avif" alt="AI Agents" width={200} height={200} className="drop-shadow-2xl object-contain" />
            </div>
            <h3 className="text-2xl font-bold mb-4">AI agents</h3>
            <p className="text-gray-400 leading-relaxed">
              Real-time models generate continuous probability distributions, providing a baseline of highly quantitative, data-driven analysis.
            </p>
          </div>

          {/* Card 2: Human Traders */}
          <div className="bg-[#111] border border-white/5 rounded-3xl p-12 text-center hover:bg-[#151515] transition-colors">
            <div className="h-48 flex items-center justify-center mb-8 landing-float" style={{ animationDelay: '2s' }}>
              <Image src="/landing page images/human traders.avif" alt="Human Traders" width={200} height={200} className="drop-shadow-2xl object-contain" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Human traders</h3>
            <p className="text-gray-400 leading-relaxed">
              Market participants interpret the nuances, trading on unquantifiable signals to discover alpha hidden from algorithms.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: Discovery */}
      <section id="signals" className="max-w-6xl mx-auto px-6 mt-48">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block border border-[#2980b9]/30 bg-[#2980b9]/10 rounded-full px-4 py-1 text-xs text-[#2980b9] font-semibold mb-6 tracking-wide">
            Signal over noise
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Predensity identifies tokens likely to see near-term price moves, helping market participants surface early trends and act on quality signals
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center hover:bg-[#151515] transition-colors">
            <div className="w-12 h-12 bg-[#2980b9]/10 rounded-xl flex items-center justify-center mx-auto mb-6 text-[#2980b9]">
              <Flashlight size={24} />
            </div>
            <h3 className="text-lg font-bold mb-3">Alpha discovery</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Identify tokens likely to surge 1.5x+ in the next 1-3 weeks using a dynamic, incentive-weighted prediction market
            </p>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center hover:bg-[#151515] transition-colors">
            <div className="w-12 h-12 bg-[#2980b9]/10 rounded-xl flex items-center justify-center mx-auto mb-6 text-[#2980b9]">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-lg font-bold mb-3">Trading strategy support</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Leverage live price/time maps to inform entry points, sizing, or automated execution strategies
            </p>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center hover:bg-[#151515] transition-colors">
            <div className="w-12 h-12 bg-[#2980b9]/10 rounded-xl flex items-center justify-center mx-auto mb-6 text-[#2980b9]">
              <Radio size={24} />
            </div>
            <h3 className="text-lg font-bold mb-3">Public signal layer</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Access an open stream of token-level price forecasts — a shared intelligence layer for the crypto ecosystem
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5: Get Early Access */}
      <section className="max-w-4xl mx-auto px-6 mt-48 mb-32 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Get early access</h2>
        <p className="text-lg text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto">
          Early traders receive a higher multiplier on their rewards. Join the platform to start interacting with the ecosystem.
        </p>
        <a
          href="https://predensity.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-white text-black px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105"
        >
          Join Predensity Early
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#0a0a0a] py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between relative z-10">
          <div className="flex items-center gap-3 mb-6 md:mb-0">
            <Image src="/predensity-icon.png" alt="Logo" width={32} height={32} className="rounded" />
            <span className="text-xl font-bold">Predensity</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400 font-medium">
            <Link href="#predictive-efficiency" className="hover:text-white transition-colors">Prediction</Link>
            <Link href="#infofi" className="hover:text-white transition-colors">InfoFi</Link>
            <Link href="#signals" className="hover:text-white transition-colors">Signals</Link>
            <Link href="https://yt0-2.gitbook.io/yt-docs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</Link>
            <a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Blog</a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-12 text-center text-xs text-gray-600 relative z-10">
          &copy; {new Date().getFullYear()} Predensity. All rights reserved.
        </div>
      </footer>

      <style>{`
        @keyframes landing-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        .landing-float {
          animation: landing-float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
