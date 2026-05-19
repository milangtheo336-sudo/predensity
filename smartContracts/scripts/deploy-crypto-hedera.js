/**
 * Deploy CryptoPredictionMarket to Hedera testnet using Hedera SDK
 * Run: node smartContracts/scripts/deploy-crypto-hedera.js
 */

const {
  Client,
  ContractCreateFlow,
  PrivateKey,
  AccountId,
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../frontend/.env.local') });

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || process.env.TESTNET_OPERATOR_PRIVATE_KEY;
const USDC_ADDRESS = '0x00000000000000000000000000000000007d943f'; // Testnet USDC

async function main() {
  console.log('[deploy-crypto] Starting deployment...');
  console.log('[deploy-crypto] Operator:', OPERATOR_ID);
  console.log('');

  if (!OPERATOR_ID || !OPERATOR_KEY) {
    console.error('[deploy-crypto] Error: TESTNET_OPERATOR_ID and TESTNET_OPERATOR_PRIVATE_KEY must be set');
    process.exit(1);
  }

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Read compiled bytecode
  const contractPath = path.join(
    __dirname,
    '../artifacts/contracts/CryptoPredictionMarket.sol/CryptoPredictionMarket.json'
  );

  if (!fs.existsSync(contractPath)) {
    console.error('[deploy-crypto] Contract not compiled. Run: npx hardhat compile');
    process.exit(1);
  }

  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const bytecode = contractJson.bytecode;

  console.log('[deploy-crypto] Deploying CryptoPredictionMarket...');
  console.log('[deploy-crypto] Bytecode size:', bytecode.length / 2, 'bytes');
  console.log('[deploy-crypto] Constructor params: assetSymbol=HBAR, priceDecimals=8, stakingToken=' + USDC_ADDRESS);

  // Encode constructor parameters
  const { ethers } = require('ethers');
  const constructorParams = ethers.utils.defaultAbiCoder.encode(
    ['string', 'uint8', 'address'],
    ['HBAR', 8, USDC_ADDRESS]
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(8000000) // Increased gas for large contract
    .setMaxAutomaticTokenAssociations(-1) // Unlimited auto associations
    .setConstructorParameters(Buffer.from(constructorParams.slice(2), 'hex'));

  const response = await contractCreate.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;

  console.log('[deploy-crypto] CryptoPredictionMarket deployed!');
  console.log('[deploy-crypto] Contract ID:', contractId.toString());
  console.log('[deploy-crypto] EVM Address:', `0x${contractId.toSolidityAddress()}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('DEPLOYMENT SUCCESSFUL!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Add these to your frontend/.env.local:');
  console.log('');
  console.log(`NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS=0x${contractId.toSolidityAddress()}`);
  console.log(`NEXT_PUBLIC_CRYPTO_CONTRACT_ID=${contractId.toString()}`);
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[deploy-crypto] Error:', error);
  process.exit(1);
});
