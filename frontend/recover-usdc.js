// Recovery script: transfer USDC from the EVM alias account back to the sender
// Run: WALLET_ENCRYPTION_KEY=... node recover-usdc.js
//
// SECURITY: This script decrypts a production wallet private key. NEVER add a
// fallback/default encryption key -- if this script is ever run with the wrong
// key, it will fail loudly instead of silently leaking or mis-decrypting.

const { Client, PrivateKey, TransferTransaction, AccountId, TokenId } = require('@hashgraph/sdk');
const crypto = require('crypto');

// The encrypted private key from Convex managedWallets table (one-off recovery input)
const ENCRYPTED_KEY = 'a2a1d34974d985b8db196728e8d0dd70:2a0b35e7b7b22cbdbe3554c9972e462d:1973ee3f5302bf47cfea4537498ff7f48f75ed4c9dca17e8ac7ab982fae2fcfcc67aa573874911d6e05728ab431790a656e7254fdce20a46e3acd9c92599fdfc';

// Require the real env-provided encryption key. No fallback.
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error(
    'WALLET_ENCRYPTION_KEY env var must be set and at least 32 chars. ' +
    'Refusing to use any fallback.'
  );
}

// The alias account that received the USDC
const ALIAS_ACCOUNT = '0.0.10395866';
// Where to send it back
const DESTINATION = '0.0.10394209';
// USDC token ID on mainnet
const USDC_TOKEN = '0.0.456858';
// Amount in smallest unit (2 USDC = 2000000)
const AMOUNT = 2000000;

function decrypt(encryptedText) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'predensity-salt', 32);
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  // Decrypt the private key
  const rawKey = decrypt(ENCRYPTED_KEY);
  console.log('Decrypted key length:', rawKey.length);

  const privateKey = PrivateKey.fromStringECDSA(rawKey);
  console.log('Public key:', privateKey.publicKey.toStringRaw());

  // The alias account uses the same key
  const client = Client.forMainnet();
  client.setOperator(ALIAS_ACCOUNT, privateKey);

  console.log(`Transferring ${AMOUNT / 1e6} USDC from ${ALIAS_ACCOUNT} to ${DESTINATION}...`);

  const tx = new TransferTransaction()
    .addTokenTransfer(TokenId.fromString(USDC_TOKEN), AccountId.fromString(ALIAS_ACCOUNT), -AMOUNT)
    .addTokenTransfer(TokenId.fromString(USDC_TOKEN), AccountId.fromString(DESTINATION), AMOUNT);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  console.log('Status:', receipt.status.toString());
  console.log('Transaction ID:', response.transactionId.toString());

  client.close();
}

main().catch(console.error);
