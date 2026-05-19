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
              <p className="mb-3">
                This Cookie Policy explains how Predensity ("Predensity," "we," "us," or "our") uses cookies and similar
                tracking technologies on our website: https://www.predensity.com and any subdomains or mobile applications
                under Predensity's control (collectively, the "Site"). This Cookie Policy should be read together with our{' '}
                <Link href="/privacy" className="text-vibrant-purple hover:underline">Privacy Policy</Link> and{' '}
                <Link href="/terms" className="text-vibrant-purple hover:underline">Terms of Use</Link>. By continuing to
                browse or use our Site, you agree that we can store and access cookies and other tracking technologies as
                described in this Policy. If you do not agree, please disable cookies in your browser settings or refrain
                from using our Site.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">What Are Cookies?</h2>
              <p className="mb-3">
                Cookies are small text files that websites place on your device's browser to store data about your
                preferences and interactions. They help websites remember information about your visit (e.g., your language
                settings or login status) and enable certain functionality. We also use similar technologies, such as web
                beacons (pixel tags), local storage objects, or scripts, to collect additional information about how you
                interact with our Site and Services.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Why We Use Cookies and Tracking Technologies</h2>
              <p className="mb-2">We use cookies and similar technologies for various purposes, including but not limited to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Site Functionality:</span> Enable core features (e.g., user authentication, wallet session management, market interactions).</li>
                <li><span className="font-medium">Preferences and Personalization:</span> Remember your theme, language, and other customizations to improve your experience.</li>
                <li><span className="font-medium">Analytics and Performance:</span> Track usage patterns, page views, clicks, and other metrics to better understand how users access and utilize our Site.</li>
                <li><span className="font-medium">Security:</span> Protect user accounts, detect unauthorized activity, and maintain site integrity.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Types of Cookies We Use</h2>
              <p className="mb-3">We may use different types of cookies and similar technologies on our Site:</p>

              <h3 className="font-semibold mb-1">Strictly Necessary Cookies</h3>
              <p className="mb-1">These are essential for the Site to function. They enable features like user logins and wallet session management.</p>
              <p className="mb-3 text-muted-foreground italic">Example: Session cookies that manage your login state or wallet session keys.</p>

              <h3 className="font-semibold mb-1">Performance Cookies</h3>
              <p className="mb-1">These cookies collect information about how you use our Site, such as which pages are visited most frequently, and help us improve performance.</p>
              <p className="mb-3 text-muted-foreground italic">Example: Analytics cookies that track page views and site navigation. Predensity is solely responsible for the data collected through these analytics.</p>

              <h3 className="font-semibold mb-1">Functionality Cookies</h3>
              <p className="mb-1">These remember your preferences and choices (e.g., theme, language settings) to personalize your experience.</p>
              <p className="mb-3 text-muted-foreground italic">Example: A cookie storing your dark/light mode preference so you don't have to choose it each visit.</p>

              <h3 className="font-semibold mb-1">Third-Party Cookies</h3>
              <p className="mb-3">
                Our Site integrates features or content from third parties (e.g., authentication providers). These third
                parties may place their own cookies on your device to collect information about your online activities. We
                do not control these third-party cookies; their use is governed by the third party's privacy or cookie policy.
              </p>
              <p className="mb-2">Examples of third-party services we use include:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Magic Link:</span> Manages email-based authentication sessions.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">How to Control Cookies</h2>
              <p className="mb-3">
                You can accept, reject, or remove cookies by adjusting your browser settings. The steps vary depending on
                the browser you use (e.g., Chrome, Firefox, Safari, Edge). You can typically find instructions in the
                "Help" menu or settings of your browser.
              </p>
              <p className="mb-3">
                Please note: Disabling certain cookies may limit the functionality or performance of our Site. Strictly
                necessary cookies are required for you to navigate and access certain features (e.g., wallet authentication
                and market access).
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Do Not Track Signals</h2>
              <p className="mb-3">
                Some browsers have a "Do Not Track" (DNT) feature that informs websites that you do not want to have your
                online activities tracked. We currently do not respond to DNT signals, as there is no industry-accepted
                standard for such requests.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Changes to This Cookie Policy</h2>
              <p className="mb-3">
                We may update this Cookie Policy from time to time. If we make material changes, we will update the
                "Last Updated" date at the top of this page. Your continued use of our Site after changes have been posted
                will constitute your acceptance of the revised Cookie Policy.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Contact Us</h2>
              <p className="mb-3">
                If you have any questions or concerns about this Cookie Policy or our use of cookies, please contact us
                at:{' '}
                <a href="mailto:legal@predensity.com" className="text-vibrant-purple hover:underline">
                  legal@predensity.com
                </a>.
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground">
                By using our Site and Services, you acknowledge that you have read and understood this Cookie Policy.
                If you do not agree to our use of cookies, please discontinue your use of the Site or adjust your browser
                settings accordingly.
              </p>
              <p className="mt-3 text-muted-foreground">Effective Date: May 3, 2026</p>
            </div>

          </section>
        </div>
      </main>
    </div>
  );
}
