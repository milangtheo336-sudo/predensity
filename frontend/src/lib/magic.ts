/**
 * Magic Link Authentication Library
 * 
 * Provides non-custodial authentication using Magic Link.
 * User's private key is managed by Magic's MPC network.
 * Backend never has access to user's private key.
 */

import { ethers } from 'ethers';

// Custom Arc provider that disables ENS (Arc doesn't support ENS)
class ArcProvider extends ethers.providers.JsonRpcProvider {
  async getResolver(name: string): Promise<null> {
    // Arc doesn't support ENS, always return null
    return null;
  }
  
  async resolveName(name: string): Promise<string | null> {
    // If it's already an address, return it
    if (ethers.utils.isAddress(name)) {
      return name;
    }
    // Otherwise, Arc doesn't support ENS
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

      // Detect system theme
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Initialize Magic with OAuth2 extension (standard EVM, no Arc extension needed)
      magicInstance = new Magic(publishableKey, {
        extensions: [
          new OAuthExtension(),
        ],
        network: {
          rpcUrl: '/api/rpc-proxy',
          chainId: 5042002, // Arc chain ID
        },
        locale: 'en_US',
        theme: isDarkMode ? 'dark' : 'light',
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
  console.log('[getUserInfo] Raw metadata:', metadata);
  
  // If publicAddress is not in metadata, get it from eth_accounts
  let publicAddress = (metadata as any).publicAddress;
  console.log('[getUserInfo] publicAddress from metadata:', publicAddress);
  
  if (!publicAddress) {
    try {
      const provider = (magic as any).rpcProvider;
      const accounts = await provider.request({ method: 'eth_accounts' });
      console.log('[getUserInfo] eth_accounts response:', accounts);
      publicAddress = accounts[0];
    } catch (error) {
      console.error('[getUserInfo] Failed to get publicAddress from eth_accounts:', error);
    }
  }
  
  // If still no address, extract from issuer DID
  if (!publicAddress) {
    const issuer = (metadata as any).issuer;
    console.log('[getUserInfo] Trying to extract from issuer:', issuer);
    if (issuer && issuer.startsWith('did:ethr:')) {
      publicAddress = issuer.replace('did:ethr:', '');
      console.log('[getUserInfo] Extracted address from issuer:', publicAddress);
    }
  }
  
  if (!publicAddress) {
    console.error('[getUserInfo] Could not determine publicAddress');
    return null;
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
  
  // Use Magic's direct RPC method for personal_sign
  const provider = (magic as any).rpcProvider;
  
  // Get user's address
  const userInfo = await getUserInfo();
  if (!userInfo?.publicAddress) {
    throw new Error('User not logged in');
  }
  
  // Sign using personal_sign
  const signature = await provider.request({
    method: 'personal_sign',
    params: [
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message)),
      userInfo.publicAddress,
    ],
  });
  
  return signature;
}

/**
 * Sign typed data (EIP-712) for order placement.
 * 
 * Example domain:
 * {
 *   name: 'Predensity Exchange',
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
 * Returns a custom provider that connects to Arc testnet.
 */
export function getMagicProvider(): any {
  const magic = getMagic();
  const magicProvider = (magic as any).rpcProvider;
  
  // Wrap Magic's provider to use Arc RPC
  return new Proxy(magicProvider, {
    get(target, prop) {
      if (prop === 'request') {
        return async (args: any) => {
          // For network-related calls, use Arc RPC directly
          if (args.method === 'eth_chainId') {
            return '0x4CF5F2'; // 5042002 in hex (Arc)
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
 * Uses Arc testnet RPC for network calls.
 */
export async function getMagicSigner(): Promise<ethers.Signer> {
  const magic = getMagic();
  const magicProvider = (magic as any).rpcProvider;
  
  // Create a Web3Provider that wraps Magic's provider
  // but intercepts network calls to use Arc RPC
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
          // For contract calls and balance queries, use Arc RPC
          if (args.method === 'eth_call' || args.method === 'eth_getBalance' || args.method === 'eth_getTransactionCount') {
            const arcProvider = new ArcProvider('/api/rpc-proxy');
            return await arcProvider.send(args.method, args.params || []);
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
  const magic = getMagic();
  const magicProvider = (magic as any).rpcProvider;
  
  // Get user address
  const userInfo = await getUserInfo();
  const from = userInfo?.publicAddress;
  
  if (!from) {
    throw new Error('No account found. Please log in.');
  }
  
  console.log('[sendTransaction] Building transaction...', { from, to, data: data.slice(0, 10) + '...', value, gasLimit });
  
  // Get nonce
  const nonce = await magicProvider.request({
    method: 'eth_getTransactionCount',
    params: [from, 'latest'],
  });
  
  console.log('[sendTransaction] Nonce:', nonce);
  
  // Get gas price
  const gasPrice = await magicProvider.request({
    method: 'eth_gasPrice',
    params: [],
  });
  
  console.log('[sendTransaction] Gas price:', gasPrice);
  
  // Build transaction object
  const tx: any = {
    from,
    to,
    data,
    nonce,
    gasPrice,
    gas: `0x${(gasLimit || 1500000).toString(16)}`,
  };
  
  if (value) {
    tx.value = `0x${ethers.BigNumber.from(value).toHexString().slice(2)}`;
  }
  
  console.log('[sendTransaction] Sending transaction...', tx);
  
  // Send transaction via Magic's RPC
  const txHash = await magicProvider.request({
    method: 'eth_sendTransaction',
    params: [tx],
  });
  
  console.log('[sendTransaction] Transaction sent:', txHash);
  
  return txHash;
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
  const arcProvider = new ArcProvider('/api/rpc-proxy');
  return await arcProvider.waitForTransaction(txHash, confirmations);
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
  const arcProvider = new ArcProvider('/api/rpc-proxy');
  
  if (!userAddress) {
    // Get user address from Magic provider directly (avoid getAddress() error)
    const accounts = await magicProvider.request({ method: 'eth_accounts' });
    userAddress = accounts[0];
    
    if (!userAddress) {
      throw new Error('No account found. Please log in.');
    }
  }
  
  const tokenAbi = ['function balanceOf(address) view returns (uint256)'];
  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, arcProvider);
  const balance = await tokenContract.balanceOf(userAddress);
  
  return balance.toString();
}

/**
 * Associate USDC token with user's Magic Link wallet.
 * 
 * IMPORTANT: On Arc, token association MUST be signed by the account owner.
 * The operator cannot do this on behalf of the user, even during initial setup.
 * 
 * This function is a placeholder. Token association will happen automatically
 * when the user first tries to deposit USDC - the deposit transaction will
 * trigger the association if needed.
 * 
 * @param tokenId USDC token ID (e.g., '0.0.8229951' for testnet)
 * @returns Transaction hash
 */
export async function associateToken(tokenId: string): Promise<string> {
  console.log('[associateToken] Token association will happen on first deposit for token:', tokenId);
  
  // This is a placeholder - actual association happens during first deposit
  // when user signs the transaction via Magic Link
  return 'pending-first-deposit';
}

/**
 * Associate a token with user's Magic Link wallet.
 * 
 * Simplified approach:
 * 1. User signs a consent message
 * 2. Backend verifies signature and handles token association
 * 3. Operator pays all fees
 * 
 * This is still non-custodial - user controls their funds via Magic Link.
 * Token association is just a one-time setup step.
 * 
 * @param tokenId Arc token ID (e.g., '0.0.8229951')
 * @returns Transaction hash
 */
export async function associateTokenViaMagic(tokenId: string): Promise<string> {
  console.log('[associateTokenViaMagic] Associating token', tokenId);
  
  try {
    // Step 1: Get user info
    const userInfo = await getUserInfo();
    if (!userInfo?.publicAddress) {
      throw new Error('User not logged in');
    }
    
    // Step 2: User signs consent message
    const consentMessage = `I authorize token association for ${tokenId} on my Arc account ${userInfo.publicAddress}`;
    console.log('[associateTokenViaMagic] Requesting user signature for consent...');
    
    const signature = await signMessage(consentMessage);
    console.log('[associateTokenViaMagic] User signed consent');
    
    // Step 3: Get DID token for backend authentication
    const didToken = await getDIDToken();
    
    // Step 4: Send to backend to handle token association
    const response = await fetch('/api/wallet/associate-token-with-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${didToken}`,
      },
      body: JSON.stringify({
        tokenId,
        userAddress: userInfo.publicAddress,
        consentMessage,
        signature,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token association failed');
    }
    
    const data = await response.json();
    console.log('[associateTokenViaMagic] Association successful:', data.transactionId);
    
    // Check if auto-association is enabled
    if (data.transactionId === 'auto-association-enabled') {
      console.log('[associateTokenViaMagic] Account has unlimited auto associations');
      return 'auto-association-enabled';
    }
    
    return data.transactionId;
  } catch (error: any) {
    console.error('[associateTokenViaMagic] Error:', error);
    
    // Check if token is already associated
    if (error.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
      console.log('[associateTokenViaMagic] Token already associated');
      return 'already-associated';
    }
    
    throw new Error(`Token association failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Approve token spending for a contract using personal_sign (works with Magic Link).
 * User signs a message, backend submits the approval transaction.
 * 
 * @param tokenAddress Token contract address (EVM format)
 * @param spenderAddress Contract address to approve
 * @param amount Amount to approve (in smallest unit, e.g., 6 decimals for USDC)
 * @returns Transaction hash
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<string> {
  console.log('[approveToken] Requesting approval signature...');
  
  // Get user info
  const userInfo = await getUserInfo();
  if (!userInfo?.publicAddress) {
    throw new Error('No account found');
  }
  
  // Create approval message
  const message = JSON.stringify({
    action: 'approve',
    token: tokenAddress,
    spender: spenderAddress,
    amount,
    timestamp: Date.now(),
  });
  
  console.log('[approveToken] Message:', message);
  
  // Sign message with personal_sign (works with Magic Link)
  const signature = await signMessage(message);
  
  console.log('[approveToken] Signature obtained, sending to backend...');
  
  // Send to backend for execution
  const response = await fetch('/api/bet/approve-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: userInfo.publicAddress,
      tokenAddress,
      spenderAddress,
      amount,
      message,
      signature,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Approval failed');
  }
  
  const result = await response.json();
  console.log('[approveToken] Approval successful:', result.txHash);
  
  return result.txHash;
}
