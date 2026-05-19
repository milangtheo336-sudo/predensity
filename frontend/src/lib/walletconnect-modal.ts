/**
 * WalletConnect Modal v2 singleton
 *
 * Uses @walletconnect/modal (already installed) to provide:
 * - QR code for mobile wallets
 * - Wallet search (WalletConnect explorer)
 * - Direct connection for browser extensions via WalletConnect protocol
 *
 * This is the "WalletConnect" button in the wallet selector — separate from
 * EIP-6963 which handles browser extensions directly.
 */

import { SignClient } from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';

const PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ||
  '';

// Hedera testnet chain in CAIP-2 format
const HEDERA_TESTNET_CHAIN = 'eip155:296';
const HEDERA_MAINNET_CHAIN = 'eip155:295';

function getChain() {
  const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  return network === 'mainnet' ? HEDERA_MAINNET_CHAIN : HEDERA_TESTNET_CHAIN;
}

let signClient: any = null;
let modal: WalletConnectModal | null = null;

export async function getSignClient() {
  if (signClient) return signClient;
  signClient = await SignClient.init({
    projectId: PROJECT_ID,
    metadata: {
      name: 'Predensity',
      description: 'Decentralized Prediction Market on Hedera',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://predensity.com',
      icons: [typeof window !== 'undefined' ? `${window.location.origin}/predensity-logo.png` : ''],
    },
  });
  return signClient;
}

export function getModal(): WalletConnectModal {
  if (modal) return modal;
  modal = new WalletConnectModal({
    projectId: PROJECT_ID,
    themeMode: 'dark',
    themeVariables: {
      '--wcm-background-color': '#0a0a0a',
      '--wcm-accent-color': '#3b82f6',
    },
  });
  return modal;
}

export interface WCSession {
  address: string;
  topic: string;
  signClient: any;
}

/**
 * Opens the WalletConnect modal and waits for the user to connect.
 * Returns the connected EVM address and session topic for signing.
 */
export async function connectWithWalletConnect(): Promise<WCSession> {
  if (!PROJECT_ID) throw new Error('WalletConnect project ID not configured');

  const client = await getSignClient();
  const wcModal = getModal();
  const chain = getChain();

  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      eip155: {
        methods: ['eth_sign', 'personal_sign', 'eth_signTypedData_v4'],
        chains: [chain],
        events: ['accountsChanged', 'chainChanged'],
      },
    },
  });

  if (!uri) throw new Error('Failed to generate WalletConnect URI');

  // Open the QR code modal
  await wcModal.openModal({ uri });

  // Wait for user to approve in their wallet
  const session = await approval();
  wcModal.closeModal();

  // Extract the EVM address from the session
  const accounts = session.namespaces?.eip155?.accounts || [];
  if (!accounts.length) throw new Error('No accounts in WalletConnect session');

  // Format: "eip155:296:0xabc123..."
  const address = accounts[0].split(':')[2];
  if (!address) throw new Error('Could not parse address from WalletConnect session');

  return { address, topic: session.topic, signClient: client };
}

/**
 * Signs a message using an active WalletConnect session.
 */
export async function signWithWalletConnect(
  session: WCSession,
  message: string,
): Promise<string> {
  const chain = getChain();
  const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');

  const result = await session.signClient.request({
    topic: session.topic,
    chainId: chain,
    request: {
      method: 'personal_sign',
      params: [hexMessage, session.address],
    },
  });

  return result as string;
}

/**
 * Disconnects a WalletConnect session.
 */
export async function disconnectWalletConnect(topic: string) {
  try {
    const client = await getSignClient();
    await client.disconnect({ topic, reason: { code: 6000, message: 'User disconnected' } });
  } catch {
    // Ignore disconnect errors
  }
}
