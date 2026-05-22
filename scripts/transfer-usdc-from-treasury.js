/**
 * Transfer USDC from treasury account to your main account on Hedera Mainnet
 *
 * Usage:
 *   $env:TREASURY_KEY = "your_treasury_private_key_here"
 *   node scripts\transfer-usdc-from-treasury.js
 */

const { Client, PrivateKey, AccountId, TransferTransaction, TokenId } = require('../frontend/node_modules/@hashgraph/sdk');

const TREASURY_ID  = '0.0.10395866';          // from account
const RECIPIENT_ID = '0.0.10394209';           // to account (yours)
const USDC_TOKEN   = '0.0.456858';             // mainnet USDC
const AMOUNT_UNITS = 2_000_000;                // 2.00 USDC (6 decimals)

const TREASURY_KEY = process.env.TREASURY_KEY || '';

if (!TREASURY_KEY) {
  console.error('ERROR: Set TREASURY_KEY env var to the treasury private key');
  process.exit(1);
}

async function main() {
  const client = Client.forMainnet();
  const keyHex = TREASURY_KEY.startsWith('0x') ? TREASURY_KEY.slice(2) : TREASURY_KEY;
  
  // Try ED25519 first, fall back to ECDSA
  let treasuryKey;
  try {
    treasuryKey = PrivateKey.fromStringED25519(keyHex);
    console.log('Key type: ED25519');
  } catch {
    try {
      treasuryKey = PrivateKey.fromStringECDSA(keyHex);
      console.log('Key type: ECDSA');
    } catch {
      treasuryKey = PrivateKey.fromString(keyHex);
      console.log('Key type: auto-detected');
    }
  }
  client.setOperator(AccountId.fromString(TREASURY_ID), treasuryKey);

  console.log(`From    : ${TREASURY_ID}`);
  console.log(`To      : ${RECIPIENT_ID}`);
  console.log(`Amount  : 2.00 USDC`);
  console.log('');
  console.log('Sending transfer...');

  const tx = await new TransferTransaction()
    .addTokenTransfer(TokenId.fromString(USDC_TOKEN), AccountId.fromString(TREASURY_ID), -AMOUNT_UNITS)
    .addTokenTransfer(TokenId.fromString(USDC_TOKEN), AccountId.fromString(RECIPIENT_ID), AMOUNT_UNITS)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`Status         : ${receipt.status.toString()}`);
  console.log(`Transaction ID : ${tx.transactionId.toString()}`);
  console.log('');
  console.log('Done. Check: https://hashscan.io/mainnet/account/' + RECIPIENT_ID);

  client.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
