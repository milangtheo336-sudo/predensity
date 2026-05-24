const USDC_ADDRESS = '0x0000000000000000000000000000000000068cDa';
const MAGIC_LINK_ADDRESS = '0x1ad2095155d84e1D016E6C1cEb701d6a5F953E88';
const PROXY_WALLET_ADDRESS = '0x3b74a0e9dfc2ee9982d2ee75bfb36bb1b7806b65';
const OLD_MAGIC_LINK_ADDRESS = '0xf9732d94f1c9092EC261797E5f778ce6cCE4dC36';
const HASHPACK_ADDRESS = '0x0000000000000000000000000000000006d5f59'; // Add your HashPack address if you know it

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
  
  await checkBalance(OLD_MAGIC_LINK_ADDRESS, 'OLD Magic Link Wallet (Previous Account)');
  await checkBalance(MAGIC_LINK_ADDRESS, 'NEW Magic Link Wallet (Current Account)');
  await checkBalance(PROXY_WALLET_ADDRESS, 'NEW Proxy Wallet (Current Account)');
  
  console.log('\n' + '='.repeat(60));
  console.log('\nNote: For betting, USDC must be in the Proxy Wallet.');
  console.log('If your 12 USDC is in the OLD account, you need to transfer it.');
}

main().catch(console.error);
