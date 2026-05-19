/**
 * Deploy MarketManager to Hedera testnet using Hedera SDK
 * Run: node smartContracts/scripts/deploy-market-manager-hedera.js
 */

const {
  Client,
  ContractCreateFlow,
  PrivateKey,
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../frontend/.env.local') });

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || process.env.TESTNET_OPERATOR_PRIVATE_KEY;
const USDC_ADDRESS = '0x00000000000000000000000000000000007d943f'; // Testnet USDC

async function main() {
  console.log('[deploy-market-manager] Starting deployment...');
  console.log('[deploy-market-manager] Operator:', OPERATOR_ID);
  console.log('');

  if (!OPERATOR_ID || !OPERATOR_KEY) {
    console.error('[deploy-market-manager] Error: TESTNET_OPERATOR_ID and TESTNET_OPERATOR_PRIVATE_KEY must be set');
    process.exit(1);
  }

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Read compiled bytecode
  const contractPath = path.join(
    __dirname,
    '../artifacts/contracts/MarketManager.sol/MarketManager.json'
  );

  if (!fs.existsSync(contractPath)) {
    console.error('[deploy-market-manager] Contract not compiled. Run: npx hardhat compile');
    process.exit(1);
  }

  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const bytecode = contractJson.bytecode;

  console.log('[deploy-market-manager] Deploying MarketManager...');
  console.log('[deploy-market-manager] Bytecode size:', bytecode.length / 2, 'bytes');
  console.log('[deploy-market-manager] Constructor params: usdcToken=' + USDC_ADDRESS);

  // Encode constructor parameters
  const { ethers } = require('ethers');
  const constructorParams = ethers.utils.defaultAbiCoder.encode(
    ['address'],
    [USDC_ADDRESS]
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(4000000)
    .setMaxAutomaticTokenAssociations(-1) // Unlimited auto associations
    .setConstructorParameters(Buffer.from(constructorParams.slice(2), 'hex'));

  const response = await contractCreate.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;

  console.log('[deploy-market-manager] MarketManager deployed!');
  console.log('[deploy-market-manager] Contract ID:', contractId.toString());
  console.log('[deploy-market-manager] EVM Address:', `0x${contractId.toSolidityAddress()}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('DEPLOYMENT SUCCESSFUL!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Add these to your frontend/.env.local:');
  console.log('');
  console.log(`NEXT_PUBLIC_CLOB_MARKET_MANAGER_ADDRESS=0x${contractId.toSolidityAddress()}`);
  console.log(`NEXT_PUBLIC_CLOB_MARKET_MANAGER_CONTRACT_ID=${contractId.toString()}`);
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[deploy-market-manager] Error:', error);
  process.exit(1);
});
