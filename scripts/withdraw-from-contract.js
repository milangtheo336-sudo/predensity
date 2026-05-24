/**
 * Withdraw funds from CryptoPredictionMarket contract on Hedera Mainnet
 *
 * Calls:
 *   1. withdrawFees()      — pulls accumulated protocol fees to the owner
 *   2. emergencyWithdraw() — pulls all remaining USDC from the contract to the owner
 *
 * Requirements:
 *   - Node.js + npm install @hashgraph/sdk
 *   - You must be the contract owner
 *   - Set OPERATOR_ID and OPERATOR_KEY below (or via env vars)
 *
 * Usage:
 *   node scripts/withdraw-from-contract.js
 */

const { Client, PrivateKey, AccountId, ContractExecuteTransaction, ContractId } = require('../frontend/node_modules/@hashgraph/sdk');

// ─── CONFIG — fill these in or set as environment variables ──────────────────
const OPERATOR_ID  = process.env.OPERATOR_ID  || '0.0.10394209';   // your account
const OPERATOR_KEY = process.env.OPERATOR_KEY || '';                // your ECDSA private key (hex, with or without 0x)
const CONTRACT_ID  = process.env.CONTRACT_ID  || '0.0.10394249';   // the crypto contract
// ─────────────────────────────────────────────────────────────────────────────

if (!OPERATOR_KEY) {
  console.error('ERROR: Set OPERATOR_KEY env var to your ECDSA private key');
  process.exit(1);
}

async function main() {
  const client = Client.forMainnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(AccountId.fromString(OPERATOR_ID), operatorKey);

  console.log(`Operator : ${OPERATOR_ID}`);
  console.log(`Contract : ${CONTRACT_ID}`);
  console.log('');

  // ── Step 1: withdrawFees() ──────────────────────────────────────────────────
  console.log('Calling withdrawFees()...');
  try {
    const feesTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(CONTRACT_ID))
      .setGas(300_000)
      .setFunction('withdrawFees')
      .execute(client);

    const feesReceipt = await feesTx.getReceipt(client);
    console.log(`  withdrawFees status : ${feesReceipt.status.toString()}`);
    console.log(`  Transaction ID      : ${feesTx.transactionId.toString()}`);
  } catch (err) {
    console.warn(`  withdrawFees failed (may be zero fees): ${err.message}`);
  }

  console.log('');

  // ── Step 2: emergencyWithdraw() ─────────────────────────────────────────────
  console.log('Calling emergencyWithdraw()...');
  try {
    const emergencyTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(CONTRACT_ID))
      .setGas(500_000)
      .setFunction('emergencyWithdraw')
      .execute(client);

    const emergencyReceipt = await emergencyTx.getReceipt(client);
    console.log(`  emergencyWithdraw status : ${emergencyReceipt.status.toString()}`);
    console.log(`  Transaction ID           : ${emergencyTx.transactionId.toString()}`);
  } catch (err) {
    console.error(`  emergencyWithdraw failed: ${err.message}`);
  }

  console.log('');
  console.log('Done. Check your account on https://hashscan.io/mainnet/account/' + OPERATOR_ID);

  client.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
