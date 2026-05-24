'use client';

import { Component, ReactNode } from 'react';

/**
 * Silently catches the "Suspense boundary" error thrown by crypto wallet
 * browser extensions (HashPack, Blade, MetaMask inpage.js) during hydration.
 * React already recovers by switching to client rendering — this just
 * prevents the red error overlay from showing in development.
 */
export class HydrationErrorBoundary extends Component<
  { children: ReactNode },
  { ok: boolean }
> {
  state = { ok: true };

  static getDerivedStateFromError(error: Error) {
    // Only suppress the known extension-caused Suspense boundary error
    if (error?.message?.includes('Suspense boundary') || error?.message?.includes('server could not finish')) {
      return { ok: true }; // suppress — React already handled it by switching to CSR
    }
    return { ok: false };
  }

  componentDidCatch(error: Error) {
    // Rethrow real errors so they still surface
    if (!error?.message?.includes('Suspense boundary') && !error?.message?.includes('server could not finish')) {
      throw error;
    }
  }

  render() {
    if (!this.state.ok) throw new Error('Unhandled render error');
    return this.props.children;
  }
}
