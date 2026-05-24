/**
 * Magic Link Authentication Library
 * 
 * Provides non-custodial authentication using Magic Link.
 * User's private key is managed by Magic's MPC network.
 * Backend never has access to user's private key.
 */

import { Magic } from 'magic-sdk';
import { OAuthExtension } from '@magic-ext/oauth2';
import { HederaExtension } from '@magic-ext/hedera';
import { ethers } from 'ethers';

// Singleton instance
let magicInstance: any = null;

/**
 * Get Magic instance (singleton).
 */
export function getMagic(): any {
  if (typeof window === 'undefined') {
    throw new Error('Magic can only be used in browser');
  }

  if (!magicInstance) {
    magicInstance = new Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY!, {
      extensions: [
        new OAuthExtension(),
        new HederaExtension({
          network: 'testnet',
        }),
      ],
    });
  }

  return magicInstance;
}

/**
 * Login with email (Magic Link).
 * Returns user's EOA address.
 */
export async function loginWithEmail(email: string): Promise<string> {
  const magic = getMagic();
  await magic.auth.loginWithEmailOTP({ email });
  
  const metadata = await magic.user.getInfo();
  const publicAddress = (metadata as any).publicAddress;
  if (!publicAddress) {
    throw new Error('Failed to get user address');
  }
  
  return publicAddress;
}

/**
 * Logout current user.
 */
export async function logout(): Promise<void> {
  const magic = getMagic();
  await magic.user.logout();
}

/**
 * Check if user is logged in.
 */
export async function isLoggedIn(): Promise<boolean> {
  const magic = getMagic();
  return await magic.user.isLoggedIn();
}

/**
 * Get current user info.
 */
export async function getUserInfo(): Promise<{
  email: string;
  publicAddress: string;
  issuer: string;
} | null> {
  const magic = getMagic();
  const loggedIn = await magic.user.isLoggedIn();
  
  if (!loggedIn) return null;
  
  const metadata = await magic.user.getInfo();
  return {
    email: (metadata as any).email!,
    publicAddress: (metadata as any).publicAddress!,
    issuer: (metadata as any).issuer!,
  };
}

/**
 * Get DID token for backend authentication.
 * Token is valid for 15 minutes.
 */
export async function getDIDToken(): Promise<string> {
  const magic = getMagic();
  return await magic.user.getIdToken();
}

/**
 * Sign a message with user's private key (via Magic MPC).
 */
export async function signMessage(message: string): Promise<string> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  const signer = provider.getSigner();
  return await signer.signMessage(message);
}

/**
 * Sign typed data (EIP-712) for order placement.
 * 
 * Example domain:
 * {
 *   name: 'Predensity CLOB',
 *   version: '1',
 *   chainId: 296,
 *   verifyingContract: '0x...'
 * }
 * 
 * Example types:
 * {
 *   Order: [
 *     { name: 'marketId', type: 'string' },
 *     { name: 'outcome', type: 'uint8' },
 *     { name: 'side', type: 'string' },
 *     { name: 'price', type: 'uint256' },
 *     { name: 'size', type: 'uint256' },
 *     { name: 'nonce', type: 'uint256' },
 *   ]
 * }
 */
export async function signTypedData(
  domain: any,
  types: any,
  value: any
): Promise<string> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  const signer = provider.getSigner();
  
  // Remove EIP712Domain from types (ethers adds it automatically)
  const { EIP712Domain, ...typesWithoutDomain } = types;
  
  return await signer._signTypedData(domain, typesWithoutDomain, value);
}

/**
 * Get Magic provider for direct Web3 calls.
 */
export function getMagicProvider(): any {
  const magic = getMagic();
  return (magic as any).rpcProvider;
}

/**
 * Get ethers signer for transactions.
 */
export async function getMagicSigner(): Promise<ethers.Signer> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  return provider.getSigner();
}
