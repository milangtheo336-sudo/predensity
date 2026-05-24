/**
 * WalletConnect Modal singleton
 *
 * Lazily initialised on first use (browser-only).
 * Provides the QR code + wallet search UI that sits on top of HWCConnector.
 */

let modalInstance: any = null;

export function getWalletConnectModal() {
  if (typeof window === 'undefined') return null;
  if (modalInstance) return modalInstance;

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    || process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
    || '';

  if (!projectId) {
    console.warn('[WalletConnectModal] No project ID found in env');
    return null;
  }

  try {
    const { WalletConnectModal } = require('@walletconnect/modal');
    modalInstance = new WalletConnectModal({
      projectId,
      themeMode: 'dark',
    });
  } catch (e) {
    console.error('[WalletConnectModal] Failed to initialise:', e);
    return null;
  }

  return modalInstance;
}
