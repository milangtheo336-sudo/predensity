/**
 * Magic Link Authentication Library
 * 
 * Provides non-custodial authentication using Magic Link.
 * User's private key is managed by Magic's MPC network.
 * Backend never has access to user's private key.
 */

import { ethers } from 'ethers';

// Custom Hedera provider that disables ENS
class HederaProvider extends ethers.providers.JsonRpcProvider {
  async getResolver(name: string): Promise<null> {
    // Hedera doesn't support ENS, always return null
    return null;
  }
  
  async resolveName(name: string): Promise<string | null> {
    // If it's already an address, return it
    if (ethers.utils.isAddress(name)) {
      return name;
    }
    // Otherwise, Hedera doesn't support ENS
    return null;
  }
}

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
      
      // Initialize Magic with default Ethereum provider
      // We'll use Hedera's JSON-RPC separately for contract interactions
      magicInstance = new Magic(publishableKey, {
        extensions: {
          oauth2: new OAuthExtension(),
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
  
  // If publicAddress is not in metadata, get it from eth_accounts
  let publicAddress = (metadata as any).publicAddress;
  if (!publicAddress) {
    try {
      const provider = (magic as any).rpcProvider;
      const accounts = await provider.request({ method: 'eth_accounts' });
      publicAddress = accounts[0];
    } catch (error) {
      console.error('[getUserInfo] Failed to get publicAddress:', error);
    }
  }
  
  return {
    email: (metadata as any).email!,
    publicAddress: publicAddress!,
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
  
  // Remove EIP712Domain from types (not needed in payload)
  const { EIP712Domain, ...typesWithoutDomain } = types;
  
  // Use Magic's direct RPC method for signing typed data
  const provider = (magic as any).rpcProvider;
  
  // Get user's address first
  const accounts = await provider.request({ method: 'eth_accounts' });
  const userAddress = accounts[0];
  
  if (!userAddress) {
    throw new Error('No account found. Please log in.');
  }
  
  // Construct EIP-712 payload
  const payload = {
    domain,
    types: typesWithoutDomain,
    primaryType: Object.keys(typesWithoutDomain)[0],
    message: value,
  };
  
  // Sign using eth_signTypedData_v4
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [userAddress, JSON.stringify(payload)],
  });
  
  return signature;
}

/**
 * Get Magic provider for direct Web3 calls.
 * Returns a custom provider that connects to Hedera testnet.
 */
export function getMagicProvider(): any {
  const magic = getMagic();
  const magicProvider = (magic as any).rpcProvider;
  
  // Wrap Magic's provider to use Hedera RPC
  return new Proxy(magicProvider, {
    get(target, prop) {
      if (prop === 'request') {
        return async (args: any) => {
          // For network-related calls, use Hedera RPC directly
          if (args.method === 'eth_chainId') {
            return '0x128'; // 296 in hex (Hedera testnet)
          }
          if (args.method === 'net_version') {
            return '296';
          }
          // For all other calls, use Magic's provider
          return target.request(args);
        };
      }
      return target[prop];
    },
  });
}

/**
 * Get ethers signer for transactions.
 * Uses Hedera testnet RPC for network calls.
 */
export async function getMagicSigner(): Promise<ethers.Signer> {
  const magic = getMagic();
  const magicProvider = (magic as any).rpcProvider;
  
  // Create a Web3Provider that wraps Magic's provider
  // but intercepts network calls to use Hedera RPC
  const customProvider = new Proxy(magicProvider, {
    get(target, prop) {
      if (prop === 'request') {
        return async (args: any) => {
          // Intercept network-related calls
          if (args.method === 'eth_chainId') {
            return '0x128'; // 296 in hex
          }
          if (args.method === 'net_version') {
            return '296';
          }
          // For contract calls and balance queries, use Hedera RPC
          if (args.method === 'eth_call' || args.method === 'eth_getBalance' || args.method === 'eth_getTransactionCount') {
            const hederaProvider = new HederaProvider('https://testnet.hashio.io/api');
            return await hederaProvider.send(args.method, args.params || []);
          }
          // For all other calls (signing, etc), use Magic's provider
          return target.request(args);
        };
      }
      return target[prop];
    },
  });
  
  const provider = new ethers.providers.Web3Provider(customProvider);
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
  const signer = await getMagicSigner();
  
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
  // Create provider without network config to avoid ENS lookups
  const hederaProvider = new HederaProvider('https://testnet.hashio.io/api');
  return await hederaProvider.waitForTransaction(txHash, confirmations);
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
  const magicProvider = (magic as any).rpcProvider;
  // Create provider without network config to avoid ENS lookups
  const hederaProvider = new HederaProvider('https://testnet.hashio.io/api');
  
  if (!userAddress) {
    // Get user address from Magic provider directly (avoid getAddress() error)
    const accounts = await magicProvider.request({ method: 'eth_accounts' });
    userAddress = accounts[0];
    
    if (!userAddress) {
      throw new Error('No account found. Please log in.');
    }
  }
  
  const tokenAbi = ['function balanceOf(address) view returns (uint256)'];
  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, hederaProvider);
  const balance = await tokenContract.balanceOf(userAddress);
  
  return balance.toString();
}

/**
 * Associate USDC token with user's Magic Link wallet.
 * User must sign this transaction via Magic Link.
 * 
 * On Hedera, accounts must explicitly associate with tokens before receiving them.
 * This transaction MUST be signed by the account owner (Magic Link wallet).
 * 
 * @param tokenId USDC token ID (e.g., '0.0.8229951' for testnet)
 * @returns Transaction hash
 */
export async function associateToken(tokenId: string): Promise<string> {
  const magic = getMagic();
  const provider = (magic as any).rpcProvider;
  
  // Get user's address
  const accounts = await provider.request({ method: 'eth_accounts' });
  const userAddress = accounts[0];
  
  if (!userAddress) {
    throw new Error('No account found. Please log in.');
  }
  
  console.log('[associateToken] Associating token', tokenId, 'with address', userAddress);
  
  // Call backend to handle token association
  // Backend will build the transaction and return it for user to sign
  const didToken = await getDIDToken();
  
  const response = await fetch('/api/wallet/associate-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${didToken}`,
    },
    body: JSON.stringify({
      tokenId,
      userAddress,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Token association failed');
  }
  
  const data = await response.json();
  console.log('[associateToken] Token association successful:', data.transactionId);
  
  return data.transactionId;
}
