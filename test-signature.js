const ethers = require('ethers');

// Test signature verification
const message = "Bet 12 USDC on BTC for 4/15/2026, 12:00:00 PM";
const signature = "0x0ed238bbf9dc0c30084a4140e0399e28600b9019df2b284fe85962dffce013d24c98b20296992d15e3bf04ff76ae71f0508ed6caf300bd3e322908236097f90c1c";
const expectedSigner = "0xF281C88525D15c7913782db841D66F1E82125738";

console.log('Message:', message);
console.log('Signature:', signature);
console.log('Expected signer:', expectedSigner);

// Verify using ethers.js (same as Magic Link personal_sign)
const recoveredAddress = ethers.utils.verifyMessage(message, signature);
console.log('Recovered address:', recoveredAddress);
console.log('Match:', recoveredAddress.toLowerCase() === expectedSigner.toLowerCase());

// Show how the contract should verify
const messageHash = ethers.utils.hashMessage(message);
console.log('\nMessage hash (with EIP-191 prefix):', messageHash);

// Show raw message hash
const rawHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));
console.log('Raw message hash (no prefix):', rawHash);
