'use client';

import { useEffect } from 'react';

/**
 * Silences benign browser-extension and WalletConnect errors that pollute
 * the console and trigger the Next.js dev error overlay:
 *
 * 1. WalletConnect IndexedDB race-condition errors
 * 2. "Suspense boundary / server could not finish" — thrown by crypto wallet
 *    extensions (Rabby, MetaMask inpage.js) injecting into the page
 *    during React hydration. React already recovers automatically; this just
 *    prevents the red dev overlay from appearing.
 */
export function WalletErrorSuppressor() {
  useEffect(() => {
    const isSuspenseBoundaryError = (msg?: string) =>
      !!msg && (
        msg.includes('Suspense boundary') ||
        msg.includes('server could not finish') ||
        msg.includes('Switched to client rendering')
      );

    const onError = (e: ErrorEvent) => {
      if (
        e.message?.includes('IDBDatabase') ||
        (e.message?.includes('transaction') && e.message?.includes('closing')) ||
        isSuspenseBoundaryError(e.message)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (
        e.reason?.message?.includes('IDBDatabase') ||
        e.reason?.name === 'InvalidStateError' ||
        isSuspenseBoundaryError(e.reason?.message)
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);
  return null;
}
