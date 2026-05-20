/**
 * Magic Link Authentication Library
 * 
 * Provides non-custodial authentication using Magic Link.
 * User's private key is managed by Magic's MPC network.
 * Backend never has access to user's private key.
 */

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
    const publishableKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      throw new Error('NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is not set');
    }

    try {
      // Dynamic imports to avoid SSR issues
      const { Magic } = require('magic-sdk');
      const { OAuthExtension } = require('@magic-ext/oauth2');
      const { HederaExtension } = require('@magic-ext/hedera');
      
      // Initialize Magic with extensions as an object (not array)
      magicInstance = new Magic(publishableKey, {
        extensions: {
          oauth2: new OAuthExtension(),
          hedera: new HederaExtension({ 
            network: 'testnet',
            rpcUrl: 'https://testnet.hashio.io/api'
          }),
        },
      });
      
      if (!magicInstance.oauth2) {
        throw new Error('OAuth2 extension not initialized');
      }
    } catch (error) {
      throw error;
    }
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

/**
 * Send a transaction using Magic Link wallet.
 * User signs the transaction with their private key (via Magic MPC).
 * 
 * @param to Contract address
 * @param data Encoded function call data
 * @param value Amount of native token to send (in wei)
 * @param gasLimit Gas limit for the transaction
 * @returns Transaction hash
 */
export async function sendTransaction(
  to: string,
  data: string,
  value?: string,
  gasLimit?: number
): Promise<string> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  const signer = provider.getSigner();
  
  const tx = await signer.sendTransaction({
    to,
    data,
    value: value ? ethers.BigNumber.from(value) : undefined,
    gasLimit: gasLimit || 1500000,
  });
  
  return tx.hash;
}

/**
 * Wait for transaction confirmation.
 * 
 * @param txHash Transaction hash
 * @param confirmations Number of confirmations to wait for (default: 1)
 * @returns Transaction receipt
 */
export async function waitForTransaction(
  txHash: string,
  confirmations: number = 1
): Promise<any> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  return await provider.waitForTransaction(txHash, confirmations);
}

/**
 * Get user's token balance.
 * 
 * @param tokenAddress ERC-20 token address
 * @param userAddress User's address (optional, uses current user if not provided)
 * @returns Balance in smallest unit (e.g., 6 decimals for USDC)
 */
export async function getTokenBalance(
  tokenAddress: string,
  userAddress?: string
): Promise<string> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  
  if (!userAddress) {
    const signer = provider.getSigner();
    userAddress = await signer.getAddress();
  }
  
  const tokenAbi = ['function balanceOf(address) view returns (uint256)'];
  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
  const balance = await tokenContract.balanceOf(userAddress);
  
  return balance.toString();
}

/**
 * Approve token spending for a contract.
 * 
 * @param tokenAddress ERC-20 token address
 * @param spenderAddress Contract address to approve
 * @param amount Amount to approve (in smallest unit)
 * @returns Transaction hash
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<string> {
  const magic = getMagic();
  const provider = new ethers.providers.Web3Provider((magic as any).rpcProvider);
  const signer = provider.getSigner();
  
  const tokenAbi = ['function approve(address spender, uint256 amount) returns (bool)'];
  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);
  
  const tx = await tokenContract.approve(spenderAddress, amount);
  return tx.hash;
}
