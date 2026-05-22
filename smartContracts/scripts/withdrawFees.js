const { ethers } = require("hardhat");

// All 4 deployed contract addresses (WKP + DPM)
const CONTRACTS = {
  crypto:     "0x0DE38B6eCBb09eF05584C9607EE941D4938D1da8",
  politics:   "0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8",
  sports:     "0x8f62C698a26888424b5170a11610Fa5Fd7DF540b",
  technology: "0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8",
};

const ABI = [
  "function totalFeesCollected() view returns (uint256)",
  "function withdrawFees() external",
  "function owner() view returns (address)",
];

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log(`Wallet: ${wallet.address}\n`);

  // Parse CLI arg: node scripts/withdrawFees.js [category|all]
  // When run via hardhat: npx hardhat run scripts/withdrawFees.js --network testnet
  // The category defaults to "all" if not specified
  const target = process.env.TARGET || "all";

  const entries = target === "all"
    ? Object.entries(CONTRACTS)
    : [[target, CONTRACTS[target]]];

  for (const [name, address] of entries) {
    if (!address) {
      console.log(`[${name}] No contract address configured, skipping.`);
      continue;
    }

    const contract = new ethers.Contract(address, ABI, wallet);

    try {
      const owner = await contract.owner();
      const fees = await contract.totalFeesCollected();
      const balance = await ethers.provider.getBalance(address);

      console.log(`[${name}] ${address}`);
      console.log(`  Owner:          ${owner}`);
      console.log(`  Contract bal:   ${ethers.utils.formatEther(balance)} HBAR`);
      console.log(`  Fees collected: ${ethers.utils.formatEther(fees)} HBAR`);

      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`  SKIPPED -- you are not the owner.\n`);
        continue;
      }

      if (fees.isZero()) {
        console.log(`  No fees to withdraw.\n`);
        continue;
      }

      console.log(`  Withdrawing ${ethers.utils.formatEther(fees)} HBAR in fees...`);
      const tx = await contract.withdrawFees();
      const receipt = await tx.wait();
      console.log(`  Done. TX: ${receipt.transactionHash}`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}\n`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}\n`);
    }
  }
}

main().catch(console.error);
