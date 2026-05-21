/**
 * Turnkey MPC Wallet Infrastructure
 * 
 * Replaces the custodial managed wallet system with non-custodial MPC wallets.
 * Each user gets their own Turnkey sub-organization with an HD wallet.
 * Private keys are never stored on our servers -- they're sharded via MPC.
 * 
 * Flow:
 * 1. User signs up via Clerk
 * 2. Server creates a Turnkey sub-org with a wallet for the user
 * 3. Convex stores only the public address (no private keys)
 * 4. When signing is needed, Turnkey's API signs on behalf of the user
 */

import { Turnkey } from '@turnkey/sdk-server';

let turnkeyClient: Turnkey | null = null;

export function getTurnkeyClient(): Turnkey {
  if (!turnkeyClient) {
    const orgId = process.env.TURNKEY_ORGANIZATION_ID;
    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

    if (!orgId || !apiPublicKey || !apiPrivateKey) {
      throw new Error('Turnkey environment variables not configured');
    }

    turnkeyClient = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      defaultOrganizationId: orgId,
      apiPublicKey,
      apiPrivateKey,
    });
  }
  return turnkeyClient;
}

/**
 * Create a new sub-organization with an Ethereum wallet for a user.
 * Returns the sub-org ID and the wallet's EVM address.
 */
export async function createUserWallet(userName: string, userEmail?: string) {
  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  // Create a sub-organization with a wallet
  const result = await apiClient.createSubOrganization({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    subOrganizationName: `user-${Date.now()}`,
    rootUsers: [{
      userName: userName || 'user',
      userEmail: userEmail || undefined,
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
    }],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: 'Default Wallet',
      accounts: [{
        curve: 'CURVE_SECP256K1',
        pathFormat: 'PATH_FORMAT_BIP32',
        path: "m/44'/60'/0'/0/0", // Standard Ethereum derivation path
        addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
      }],
    },
  });

  const subOrgId = result.subOrganizationId;
  const walletId = result.wallet?.walletId;
  const addresses = result.wallet?.addresses || [];
  const evmAddress = addresses[0] || '';

  return {
    subOrgId,
    walletId,
    evmAddress,
  };
}

/**
 * Sign an EVM transaction using Turnkey's MPC infrastructure.
 * The private key is never reconstructed on our server.
 */
export async function signTransaction(
  subOrgId: string,
  walletAddress: string,
  unsignedTransaction: string
): Promise<string> {
  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  const result = await apiClient.signTransaction({
    organizationId: subOrgId,
    signWith: walletAddress,
    unsignedTransaction,
    type: 'TRANSACTION_TYPE_ETHEREUM',
  });

  return result.signedTransaction;
}

/**
 * Sign a raw payload (for EIP-712 typed data signing).
 * Used for signing trade intents for the ExchangeSettlement contract.
 */
export async function signRawPayload(
  subOrgId: string,
  walletAddress: string,
  payload: string,
  encoding: 'PAYLOAD_ENCODING_HEXADECIMAL' | 'PAYLOAD_ENCODING_TEXT_UTF8' = 'PAYLOAD_ENCODING_HEXADECIMAL'
): Promise<{ r: string; s: string; v: string }> {
  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  const result = await apiClient.signRawPayload({
    organizationId: subOrgId,
    signWith: walletAddress,
    payload,
    encoding,
    hashFunction: 'HASH_FUNCTION_NO_OP', // payload is already hashed
  });

  return {
    r: result.r,
    s: result.s,
    v: result.v,
  };
}
