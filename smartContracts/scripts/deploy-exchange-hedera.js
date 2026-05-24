/**
 * Deploy ExchangeSettlement to Hedera testnet using Hedera SDK
 * Run: node smartContracts/scripts/deploy-exchange-hedera.js
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
  console.log('[deploy-exchange] Starting deployment...');
  console.log('[deploy-exchange] Operator:', OPERATOR_ID);
  console.log('');

  if (!OPERATOR_ID || !OPERATOR_KEY) {
    console.error('[deploy-exchange] Error: TESTNET_OPERATOR_ID and TESTNET_OPERATOR_PRIVATE_KEY must be set');
    process.exit(1);
  }

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Get operator EVM address
  const operatorEvmAddress = `0x${client.operatorAccountId.toSolidityAddress()}`;

  // Read compiled bytecode
  const contractPath = path.join(
    __dirname,
    '../artifacts/contracts/ExchangeSettlement.sol/ExchangeSettlement.json'
  );

  if (!fs.existsSync(contractPath)) {
    console.error('[deploy-exchange] Contract not compiled. Run: npx hardhat compile');
    process.exit(1);
  }

  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const bytecode = contractJson.bytecode;

  console.log('[deploy-exchange] Deploying ExchangeSettlement...');
  console.log('[deploy-exchange] Bytecode size:', bytecode.length / 2, 'bytes');
  console.log('[deploy-exchange] Constructor params: usdcToken=' + USDC_ADDRESS + ', operator=' + operatorEvmAddress);

  // Encode constructor parameters
  const { ethers } = require('ethers');
  const constructorParams = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address'],
    [USDC_ADDRESS, operatorEvmAddress]
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(4000000)
    .setMaxAutomaticTokenAssociations(-1) // Unlimited auto associations
    .setConstructorParameters(Buffer.from(constructorParams.slice(2), 'hex'));

  const response = await contractCreate.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;

  console.log('[deploy-exchange] ExchangeSettlement deployed!');
  console.log('[deploy-exchange] Contract ID:', contractId.toString());
  console.log('[deploy-exchange] EVM Address:', `0x${contractId.toSolidityAddress()}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('DEPLOYMENT SUCCESSFUL!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Add these to your frontend/.env.local:');
  console.log('');
  console.log(`NEXT_PUBLIC_CLOB_EXCHANGE_ADDRESS=0x${contractId.toSolidityAddress()}`);
  console.log(`NEXT_PUBLIC_CLOB_EXCHANGE_CONTRACT_ID=${contractId.toString()}`);
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[deploy-exchange] Error:', error);
  process.exit(1);
});
