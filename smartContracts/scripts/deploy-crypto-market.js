/**
 * Deploy CryptoPredictionMarket with security fixes
 */

const {
  Client,
  AccountId,
  PrivateKey,
  ContractCreateFlow,
  ContractFunctionParameters,
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../frontend/.env.local') });

const USDC_TOKEN_ADDRESS = '0x00000000000000000000000000000000007d943f'; // 0.0.8229951

async function main() {
  const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);
  
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  console.log('='.repeat(60));
  console.log('DEPLOYING CRYPTO PREDICTION MARKET');
  console.log('='.repeat(60));
  console.log('Operator:', operatorId.toString());
  console.log('USDC Token:', USDC_TOKEN_ADDRESS);
  
  // Read compiled bytecode
  const bytecode = JSON.parse(
    fs.readFileSync('./artifacts/contracts/CryptoPredictionMarket.sol/CryptoPredictionMarket.json')
  ).bytecode;
  
  console.log('\nBytecode size:', bytecode.length / 2, 'bytes');
  
  // Deploy contract
  console.log('\nDeploying contract...');
  const contractTx = await new ContractCreateFlow()
    .setGas(5000000)  // Increased gas for large contract
    .setMaxAutomaticTokenAssociations(-1)  // Unlimited auto-associations
    .setBytecode(bytecode)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addString('HBAR')        // assetSymbol
        .addUint8(8)              // priceDecimals
        .addAddress(USDC_TOKEN_ADDRESS)  // stakingToken
    )
    .execute(client);
  
  const receipt = await contractTx.getReceipt(client);
  const contractId = receipt.contractId;
  const contractAddress = '0x' + contractId.toSolidityAddress();
  
  console.log('\n✓ Contract deployed!');
  console.log('  Contract ID:', contractId.toString());
  console.log('  EVM Address:', contractAddress);
  console.log('  Auto-associations: Unlimited (USDC will auto-associate on first transfer)');
  
  client.close();
  
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nUpdate your .env.local:');
  console.log(`NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`NEXT_PUBLIC_CRYPTO_CONTRACT_ID=${contractId.toString()}`);
}

main().catch(console.error);
