'use client';

import { Header } from '@/components/header';
import Link from 'next/link';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-card border border-border rounded-xl p-8 sm:p-12 shadow-sm">
          <h1 className="text-2xl font-bold text-center mb-2">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">Last Updated: May 3, 2026</p>

          <section className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <div>
              <h2 className="text-lg font-semibold mb-3">Introduction</h2>
              <p className="mb-3">
                This Cookie Policy explains how Predensity ("Predensity," "we," "us," or "our") uses cookies and similar
                tracking technologies on our website: https://www.predensity.com and any subdomains under Predensity's
                control (collectively, the "Site").
              </p>
              <p className="mb-3">
                This Cookie Policy should be read together with our{' '}
                <Link href="/privacy" className="text-vibrant-purple hover:underline">Privacy Policy</Link> and{' '}
                <Link href="/terms" className="text-vibrant-purple hover:underline">Terms of Use</Link>. By continuing
                to browse or use our Site, you agree that we can store and access cookies and other tracking technologies
                as described in this Policy. If you do not agree, please disable cookies in your browser settings or
                refrain from using our Site.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">What Are Cookies?</h2>
              <p className="mb-3">
                Cookies are small text files that websites place on your device's browser to store data about your
                preferences and interactions. They help websites remember information about your visit and enable certain
                functionality. We also use similar technologies such as web beacons, local storage objects, and scripts
                to collect information about how you interact with our Site.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Why We Use Cookies</h2>
              <p className="mb-2">We use cookies and similar technologies for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Site Functionality:</span> Enable core features including wallet authentication, session management, and market interactions.</li>
                <li><span className="font-medium">Preferences:</span> Remember your theme settings, language preferences, and other customizations.</li>
                <li><span className="font-medium">Analytics and Performance:</span> Understand how users navigate the platform, which markets are viewed most, and how to improve the experience.</li>
                <li><span className="font-medium">Security:</span> Protect user sessions, detect unauthorized activity, and maintain platform integrity.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Types of Cookies We Use</h2>

              <h3 className="font-semibold mb-2">Strictly Necessary Cookies</h3>
              <p className="mb-3">
                Essential for the Site to function. These include session cookies that manage your login state and wallet
                session keys. The Site cannot function properly without these cookies.
              </p>

              <h3 className="font-semibold mb-2">Performance Cookies</h3>
              <p className="mb-3">
                Collect information about how you use the Site — pages visited, time spent, navigation patterns — to help
                us improve performance. We use Vercel Analytics for this purpose. As the site operator, Predensity is
                solely responsible for the data collected through these analytics.
              </p>

              <h3 className="font-semibold mb-2">Functionality Cookies</h3>
              <p className="mb-3">
                Remember your preferences such as theme (light/dark) and language selection so you do not have to
                reconfigure them on each visit.
              </p>

              <h3 className="font-semibold mb-2">Third-Party Cookies</h3>
              <p className="mb-3">
                Our Site integrates third-party services that may set their own cookies. These include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Vercel Analytics:</span> Tracks page views and performance metrics.</li>
                <li><span className="font-medium">Magic Link:</span> Manages email-based authentication sessions.</li>
              </ul>
              <p className="mb-3">
                We do not control third-party cookies. Their use is governed by the respective third party's privacy policy.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">How to Control Cookies</h2>
              <p className="mb-3">
                You can accept, reject, or remove cookies by adjusting your browser settings. Instructions are typically
                found in the "Help" menu of your browser (Chrome, Firefox, Safari, Edge).
              </p>
              <p className="mb-3">
                Please note: disabling certain cookies may limit the functionality of our Site. Strictly necessary cookies
                are required for authentication and market access.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Do Not Track</h2>
              <p className="mb-3">
                Some browsers send a "Do Not Track" (DNT) signal to websites. We currently do not respond to DNT signals
                as there is no industry-accepted standard for such requests. You can enable or disable DNT by visiting the
                preferences or settings page of your web browser.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Changes to This Policy</h2>
              <p className="mb-3">
                We may update this Cookie Policy from time to time. Material changes will be reflected in the "Last Updated"
                date at the top of this page. Your continued use of the Site after changes are posted constitutes your
                acceptance of the revised Policy.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Contact Us</h2>
              <p className="mb-3">
                If you have any questions about this Cookie Policy, please contact us at{' '}
                <a href="mailto:legal@predensity.com" className="text-vibrant-purple hover:underline">
                  legal@predensity.com
                </a>.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
