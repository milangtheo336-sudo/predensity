/**
 * Deploy ProxyWalletFactory and SimpleProxyWallet to Hedera testnet
 * 
 * This deploys:
 * 1. SimpleProxyWallet (master implementation contract)
 * 2. ProxyWalletFactory (factory that clones SimpleProxyWallet for each user)
 * 
 * Run: node smartContracts/scripts/deploy-proxy-factory.js
 */

const {
  Client,
  ContractCreateFlow,
  PrivateKey,
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY;

async function main() {
  console.log('[deploy-proxy-factory] Starting deployment...');
  console.log('[deploy-proxy-factory] Operator:', OPERATOR_ID);
  console.log('');

  if (!OPERATOR_ID || !OPERATOR_KEY) {
    console.error('[deploy-proxy-factory] Error: TESTNET_OPERATOR_ID and TESTNET_OPERATOR_PRIVATE_KEY must be set in .env.local');
    process.exit(1);
  }

  const client = Client.forTestnet();
  const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
  const operatorKey = PrivateKey.fromStringECDSA(keyHex);
  client.setOperator(OPERATOR_ID, operatorKey);

  // Read compiled bytecode
  const simpleProxyWalletPath = path.join(
    __dirname,
    '../artifacts/contracts/SimpleProxyWallet.sol/SimpleProxyWallet.json'
  );
  const proxyWalletFactoryPath = path.join(
    __dirname,
    '../artifacts/contracts/ProxyWalletFactory.sol/ProxyWalletFactory.json'
  );

  if (!fs.existsSync(simpleProxyWalletPath) || !fs.existsSync(proxyWalletFactoryPath)) {
    console.error('[deploy-proxy-factory] Contracts not compiled. Run: npx hardhat compile');
    process.exit(1);
  }

  const simpleProxyWalletJson = JSON.parse(fs.readFileSync(simpleProxyWalletPath, 'utf8'));
  const proxyWalletFactoryJson = JSON.parse(fs.readFileSync(proxyWalletFactoryPath, 'utf8'));

  const simpleProxyWalletBytecode = simpleProxyWalletJson.bytecode;
  const proxyWalletFactoryBytecode = proxyWalletFactoryJson.bytecode;

  // Step 1: Deploy SimpleProxyWallet (master implementation)
  console.log('[deploy-proxy-factory] Step 1: Deploying SimpleProxyWallet (master implementation)...');
  console.log('[deploy-proxy-factory] Bytecode size:', simpleProxyWalletBytecode.length / 2, 'bytes');

  // Encode constructor parameter (use operator address as dummy owner for master implementation)
  const { ethers } = require('ethers');
  const operatorEvmAddress = `0x${client.operatorAccountId.toSolidityAddress()}`;
  const masterConstructorParams = ethers.utils.defaultAbiCoder.encode(
    ['address'],
    [operatorEvmAddress]
  );

  const simpleWalletCreate = new ContractCreateFlow()
    .setBytecode(simpleProxyWalletBytecode)
    .setGas(3000000)
    .setConstructorParameters(Buffer.from(masterConstructorParams.slice(2), 'hex'));

  const simpleWalletResponse = await simpleWalletCreate.execute(client);
  const simpleWalletReceipt = await simpleWalletResponse.getReceipt(client);
  const simpleWalletId = simpleWalletReceipt.contractId;

  console.log('[deploy-proxy-factory] SimpleProxyWallet deployed!');
  console.log('[deploy-proxy-factory] Contract ID:', simpleWalletId.toString());
  console.log('[deploy-proxy-factory] EVM Address:', `0x${simpleWalletId.toSolidityAddress()}`);
  console.log('');

  // Step 2: Deploy ProxyWalletFactory with SimpleProxyWallet address
  console.log('[deploy-proxy-factory] Step 2: Deploying ProxyWalletFactory...');
  console.log('[deploy-proxy-factory] Bytecode size:', proxyWalletFactoryBytecode.length / 2, 'bytes');

  // Encode constructor parameter (address of SimpleProxyWallet)
  const implementationAddress = `0x${simpleWalletId.toSolidityAddress()}`;
  const constructorParams = ethers.utils.defaultAbiCoder.encode(
    ['address'],
    [implementationAddress]
  );

  const factoryCreate = new ContractCreateFlow()
    .setBytecode(proxyWalletFactoryBytecode)
    .setGas(2000000)
    .setConstructorParameters(Buffer.from(constructorParams.slice(2), 'hex'));

  const factoryResponse = await factoryCreate.execute(client);
  const factoryReceipt = await factoryResponse.getReceipt(client);
  const factoryId = factoryReceipt.contractId;

  console.log('[deploy-proxy-factory] ProxyWalletFactory deployed!');
  console.log('[deploy-proxy-factory] Contract ID:', factoryId.toString());
  console.log('[deploy-proxy-factory] EVM Address:', `0x${factoryId.toSolidityAddress()}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('DEPLOYMENT SUCCESSFUL!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Add these to your frontend/.env.local:');
  console.log('');
  console.log(`PROXY_WALLET_FACTORY_CONTRACT_ID=${factoryId.toString()}`);
  console.log(`SIMPLE_PROXY_WALLET_IMPLEMENTATION=${simpleWalletId.toString()}`);
  console.log('');
  console.log('Cost Summary:');
  console.log('- SimpleProxyWallet deployment: ~0.5 HBAR');
  console.log('- ProxyWalletFactory deployment: ~1.0 HBAR');
  console.log('- Total: ~1.5 HBAR');
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[deploy-proxy-factory] Error:', error);
  process.exit(1);
});
