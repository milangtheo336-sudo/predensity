/**
 * Test proxy wallet deployment
 * 
 * This script:
 * 1. Creates a proxy wallet for a test user
 * 2. Verifies the wallet was created correctly
 * 3. Checks ownership
 * 
 * Run: node smartContracts/scripts/test-proxy-wallet.js
 */

const {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  PrivateKey,
} = require('@hashgraph/sdk');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY;
const FACTORY_ID = '0.0.8543693';

// Test user address (your Magic Link wallet)
const TEST_USER_ADDRESS = '0x5100AdEd6a83394d7fbbd35974977BdCaDEc2541';

async function main() {
  console.log('[test-proxy-wallet] Starting test...');
  console.log('[test-proxy-wallet] Factory:', FACTORY_ID);
  console.log('[test-proxy-wallet] Test user:', TEST_USER_ADDRESS);
  console.log('');

  if (!OPERATOR_ID || !OPERATOR_KEY) {
    console.error('[test-proxy-wallet] Error: Operator credentials not set');
    process.exit(1);
  }

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Step 1: Check if wallet already exists
  console.log('[test-proxy-wallet] Step 1: Checking if wallet exists...');
  
  const { ethers } = require('ethers');
  const checkParams = new ContractFunctionParameters()
    .addAddress(TEST_USER_ADDRESS);

  const checkQuery = new ContractCallQuery()
    .setContractId(FACTORY_ID)
    .setGas(100000)
    .setFunction('ownerToWallet', checkParams);

  const checkResult = await checkQuery.execute(client);
  const existingWallet = checkResult.getAddress(0);

  if (existingWallet !== '0x0000000000000000000000000000000000000000') {
    console.log('[test-proxy-wallet] Wallet already exists:', existingWallet);
    console.log('[test-proxy-wallet] Test passed!');
    client.close();
    return;
  }

  console.log('[test-proxy-wallet] No existing wallet found');
  console.log('');

  // Step 2: Create proxy wallet
  console.log('[test-proxy-wallet] Step 2: Creating proxy wallet...');

  const createParams = new ContractFunctionParameters()
    .addAddress(TEST_USER_ADDRESS);

  const createTx = new ContractExecuteTransaction()
    .setContractId(FACTORY_ID)
    .setGas(500000)
    .setFunction('createWallet', createParams);

  const createResponse = await createTx.execute(client);
  const createReceipt = await createResponse.getReceipt(client);

  console.log('[test-proxy-wallet] Transaction status:', createReceipt.status.toString());
  console.log('[test-proxy-wallet] Transaction ID:', createResponse.transactionId.toString());
  console.log('');

  // Step 3: Verify wallet was created
  console.log('[test-proxy-wallet] Step 3: Verifying wallet creation...');

  const verifyQuery = new ContractCallQuery()
    .setContractId(FACTORY_ID)
    .setGas(100000)
    .setFunction('ownerToWallet', checkParams);

  const verifyResult = await verifyQuery.execute(client);
  const proxyWalletAddress = verifyResult.getAddress(0);

  console.log('[test-proxy-wallet] Proxy wallet address:', proxyWalletAddress);
  console.log('');

  if (proxyWalletAddress === '0x0000000000000000000000000000000000000000') {
    console.error('[test-proxy-wallet] ERROR: Wallet creation failed!');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('TEST PASSED!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Proxy wallet created successfully:');
  console.log('User:', TEST_USER_ADDRESS);
  console.log('Proxy Wallet:', proxyWalletAddress);
  console.log('');
  console.log('Next steps:');
  console.log('1. User deposits USDC to their Magic Link wallet');
  console.log('2. User approves proxy wallet to spend USDC (one-time)');
  console.log('3. User can now place bets seamlessly');
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[test-proxy-wallet] Error:', error);
  process.exit(1);
});
