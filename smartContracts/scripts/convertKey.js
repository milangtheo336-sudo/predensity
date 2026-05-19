// Converts a Hedera DER-encoded ECDSA private key to raw hex format for Hardhat
// Usage: node scripts/convertKey.js <your-DER-key>

const derKey = process.argv[2];
if (!derKey) {
  console.error("Usage: node scripts/convertKey.js <DER-encoded-private-key>");
  process.exit(1);
}

// ECDSA DER-encoded keys from HashPack have a fixed prefix.
// The raw 32-byte private key is the last 32 bytes (64 hex chars).
// DER prefix for ECDSA secp256k1: 3030020100300706052b8104000a04220420 (36 bytes = 72 hex chars)
// So the raw key starts at position 72 in the hex string.

const hex = derKey.replace(/^0x/, "");

if (hex.length === 64) {
  // Already raw hex
  console.log("Key is already in raw hex format:");
  console.log("0x" + hex);
} else if (hex.length > 64) {
  // DER-encoded, extract last 32 bytes
  const rawKey = hex.slice(-64);
  console.log("Raw private key (use this in .env.local):");
  console.log("0x" + rawKey);
} else {
  console.error("Unexpected key length:", hex.length, "hex chars. Expected 64 or longer.");
  process.exit(1);
}
