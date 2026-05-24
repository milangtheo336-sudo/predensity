/**
 * Deploy ProxyWalletFactory to Hedera testnet
 * 
 * Run: node smartContracts/scripts/deploy-proxy-factory.js
 */

const {
  Client,
  ContractCreateFlow,
  PrivateKey,
  FileCreateTransaction,
  FileAppendTransaction,
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID;
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY;

async function main() {
  console.log('[deploy-proxy-factory] Starting deployment...');
  console.log('[deploy-proxy-factory] Operator:', OPERATOR_ID);

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

  console.log('[deploy-proxy-factory] Deploying SimpleProxyWallet (master implementation)...');
  console.log('[deploy-proxy-factory] Bytecode size:', simpleProxyWalletBytecode.length / 2, 'bytes');

  // Deploy SimpleProxyWallet (master implementation)
  // Note: This will be deployed by the factory constructor, but we need the bytecode
  
  console.log('[deploy-proxy-factory] Deploying ProxyWalletFactory...');
  console.log('[deploy-proxy-factory] Bytecode size:', proxyWalletFactoryBytecode.length / 2, 'bytes');

  const contractCreate = new ContractCreateFlow()
    .setBytecode(proxyWalletFactoryBytecode)
    .setGas(1000000)
    .setConstructorParameters(Buffer.from([]));

  const txResponse = await contractCreate.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const contractId = receipt.contractId;

  console.log('[deploy-proxy-factory] ProxyWalletFactory deployed!');
  console.log('[deploy-proxy-factory] Contract ID:', contractId.toString());
  console.log('[deploy-proxy-factory] EVM Address:', `0x${contractId.toSolidityAddress()}`);
  console.log('');
  console.log('Add this to your .env.local:');
  console.log(`PROXY_WALLET_FACTORY_CONTRACT_ID=${contractId.toString()}`);
  console.log('');

  client.close();
}

main().catch((error) => {
  console.error('[deploy-proxy-factory] Error:', error);
  process.exit(1);
});
