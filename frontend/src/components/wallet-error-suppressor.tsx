'use client';

import { useEffect } from 'react';

/** Silences benign WalletConnect IndexedDB race-condition errors in the browser console. */
export function WalletErrorSuppressor() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (
        e.message?.includes('IDBDatabase') ||
        (e.message?.includes('transaction') && e.message?.includes('closing'))
      ) {
        e.preventDefault();
      }
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (
        e.reason?.message?.includes('IDBDatabase') ||
        e.reason?.name === 'InvalidStateError'
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
