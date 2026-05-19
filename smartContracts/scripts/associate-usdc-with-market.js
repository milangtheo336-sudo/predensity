/**
 * Associate USDC token with prediction market contracts
 * Required for HTS transfers to work
 */

const {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractId,
} = require('@hashgraph/sdk');
require('dotenv').config({ path: '../frontend/.env.local' });

const USDC_TOKEN_ID = '0.0.8229951'; // Testnet USDC
const HTS_PRECOMPILE = '0x0000000000000000000000000000000000000167';

async function associateToken(contractId, tokenId) {
  const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);
  
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  console.log(`\nAssociating token ${tokenId} with contract ${contractId}...`);
  
  try {
    // Call HTS associateToken(address contractAddress, address tokenAddress)
    // Function selector: 0x49146bde
    const contractAddress = ContractId.fromString(contractId).toSolidityAddress();
    const tokenAddress = ContractId.fromString(tokenId).toSolidityAddress();
    
    const functionCallData = Buffer.concat([
      Buffer.from('49146bde', 'hex'), // associateToken selector
      Buffer.from(contractAddress.replace('0x', '').padStart(64, '0'), 'hex'),
      Buffer.from(tokenAddress.replace('0x', '').padStart(64, '0'), 'hex'),
    ]);
    
    const tx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100000)
      .setFunctionParameters(functionCallData)
      .execute(client);
    
    const receipt = await tx.getReceipt(client);
    console.log(`✓ Association successful! Status: ${receipt.status.toString()}`);
    console.log(`  Transaction: ${tx.transactionId.toString()}`);
    
    return true;
  } catch (error) {
    if (error.message && error.message.includes('TOKEN_ALREADY_ASSOCIATED')) {
      console.log(`✓ Token already associated`);
      return true;
    }
    console.error(`✗ Association failed:`, error.message);
    return false;
  } finally {
    client.close();
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('ASSOCIATING USDC WITH PREDICTION MARKETS');
  console.log('='.repeat(60));
  
  const contracts = {
    'CryptoPredictionMarket': process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ID,
    'PoliticsPredictionMarket': '0.0.8232724',
    'SportsPredictionMarket': '0.0.8232726',
    'TechnologyPredictionMarket': '0.0.8232727',
  };
  
  for (const [name, contractId] of Object.entries(contracts)) {
    if (!contractId) {
      console.log(`\nSkipping ${name} (not configured)`);
      continue;
    }
    console.log(`\n${name} (${contractId}):`);
    await associateToken(contractId, USDC_TOKEN_ID);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('DONE!');
  console.log('='.repeat(60));
}

main().catch(console.error);
