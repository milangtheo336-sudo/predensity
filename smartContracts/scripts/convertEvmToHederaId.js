const { ContractId } = require('@hashgraph/sdk');

// Convert EVM addresses to Hedera Contract IDs using Hedera SDK
const contracts = {
  Crypto: '0x0DE38B6eCBb09eF05584C9607EE941D4938D1da8',
  Politics: '0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8',
  Sports: '0x8f62C698a26888424b5170a11610Fa5Fd7DF540b',
  Technology: '0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8',
};

console.log('EVM Address to Hedera Contract ID Conversion:');
console.log('='.repeat(60));

for (const [name, address] of Object.entries(contracts)) {
  try {
    const contractId = ContractId.fromEvmAddress(0, 0, address);
    console.log(`${name}:`);
    console.log(`  EVM: ${address}`);
    console.log(`  Hedera ID: ${contractId.toString()}`);
    console.log('');
  } catch (error) {
    console.log(`${name}: Error converting - ${error.message}`);
  }
}
