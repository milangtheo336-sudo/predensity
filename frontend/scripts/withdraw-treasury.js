/**
 * Withdraw remaining USDC from treasury to operator account
 * 
 * Run: node frontend/scripts/withdraw-treasury.js
 */

const { Client, ContractExecuteTransaction, ContractId, PrivateKey } = require('@hashgraph/sdk');
const { ethers } = require('ethers');
require('dotenv').config({ path: 'frontend/.env.local' });

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS;
const USDC_TOKEN_ID = '0.0.8229951'; // Hedera testnet USDC
const USDC_EVM_ADDRESS = '0x00000000000000000000000000000000007d943f';

async function main() {
  console.log('[withdraw-treasury] Starting...');
  console.log('[withdraw-treasury] Treasury:', TREASURY_ADDRESS);
  console.log('[withdraw-treasury] Operator:', OPERATOR_ID);

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Get USDC balance
  const balanceInterface = new ethers.utils.Interface([
    'function balanceOf(address) external view returns (uint256)',
  ]);
  const balanceData = balanceInterface.encodeFunctionData('balanceOf', [TREASURY_ADDRESS]);

  const balanceTx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(USDC_TOKEN_ID))
    .setGas(100000)
    .setFunctionParameters(Buffer.from(balanceData.slice(2), 'hex'))
    .freezeWith(client);

  const balanceResponse = await balanceTx.execute(client);
  const balanceRecord = await balanceResponse.getRecord(client);
  const balance = ethers.utils.defaultAbiCoder.decode(
    ['uint256'],
    '0x' + Buffer.from(balanceRecord.contractFunctionResult.bytes).toString('hex')
  )[0];

  const balanceUSDC = ethers.utils.formatUnits(balance, 6);
  console.log(`[withdraw-treasury] Current balance: ${balanceUSDC} USDC`);

  if (balance.eq(0)) {
    console.log('[withdraw-treasury] No USDC to withdraw');
    client.close();
    return;
  }

  // Transfer USDC to operator
  const transferInterface = new ethers.utils.Interface([
    'function transfer(address to, uint256 amount) external returns (bool)',
  ]);
  const transferData = transferInterface.encodeFunctionData('transfer', [
    TREASURY_ADDRESS, // Send to operator (same as treasury for now)
    balance,
  ]);

  const transferTx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(USDC_TOKEN_ID))
    .setGas(200000)
    .setFunctionParameters(Buffer.from(transferData.slice(2), 'hex'))
    .freezeWith(client);

  const signedTx = await transferTx.sign(operatorKey);
  const transferResponse = await signedTx.execute(client);
  const transferReceipt = await transferResponse.getReceipt(client);

  console.log(`[withdraw-treasury] Transfer status: ${transferReceipt.status.toString()}`);
  console.log(`[withdraw-treasury] Withdrawn ${balanceUSDC} USDC`);

  client.close();
}

main().catch(console.error);
