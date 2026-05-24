const USDC_ADDRESS = '0x00000000000000000000000000000000007d943F'; // Correct USDC testnet
const MAGIC_LINK_ADDRESS = '0xEa027e87107f3031311fD2cB1775b1934EFFECAb'; // New account
const PROXY_WALLET_ADDRESS = '0x3dbec8efbe6231abdd126d004675b0e418b130bd'; // New proxy wallet
const PREDICTION_MARKET_ADDRESS = '0x0DE38B6eCBb09eF05584C9607EE941D4938D1da8'; // Crypto market

async function checkBalance(address, label) {
  try {
    const callData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: USDC_ADDRESS,
          data: '0x70a08231' + address.slice(2).padStart(64, '0'), // balanceOf(address)
        },
        'latest',
      ],
    };

    const response = await fetch('https://testnet.hashio.io/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callData),
    });

    const result = await response.json();
    
    if (result.error) {
      console.log(`\n${label}:`);
      console.log(`  Address: ${address}`);
      console.log(`  Error: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }
    
    const balance = parseInt(result.result, 16);
    const balanceUsdc = balance / 1000000; // 6 decimals

    console.log(`\n${label}:`);
    console.log(`  Address: ${address}`);
    console.log(`  USDC Balance: ${balanceUsdc} USDC`);
    console.log(`  Raw Balance: ${balance}`);
  } catch (error) {
    console.log(`\n${label}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Error: ${error.message}`);
  }
}

async function main() {
  console.log('Checking USDC balances on Hedera Testnet...\n');
  console.log('='.repeat(60));
  
  await checkBalance(MAGIC_LINK_ADDRESS, 'Magic Link Wallet (Identity Key)');
  await checkBalance(PROXY_WALLET_ADDRESS, 'Proxy Wallet (Vault - NEW)');
  await checkBalance(PREDICTION_MARKET_ADDRESS, 'Prediction Market Contract');
  
  console.log('\n' + '='.repeat(60));
  console.log('\nNote: For betting, USDC must be in the Proxy Wallet.');
  console.log('Proxy wallet contract ID: 0.0.8553552');
  console.log('Check transaction: https://hashscan.io/testnet/transaction/0.0.5792828@1775647686.064174550');
}

main().catch(console.error);
