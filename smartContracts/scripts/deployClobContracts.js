/**
 * Deploy MarketManager and ExchangeSettlement contracts to Hedera testnet.
 * 
 * Usage: npx hardhat run scripts/deployClobContracts.js
 */

const { ethers } = require("hardhat");

async function main() {
  const network = process.env.HEDERA_NETWORK || "testnet";
  console.log(`\nDeploying CLOB contracts to ${network}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // USDC token address (EVM format)
  const usdcToken = network === "mainnet"
    ? "0x000000000000000000000000000000000006f89a" // Mainnet USDC
    : "0x00000000000000000000000000000000007d943f"; // Testnet USDC

  console.log("USDC token:", usdcToken);

  // Deploy MarketManager
  console.log("\n--- Deploying MarketManager ---");
  const MarketManager = await ethers.getContractFactory("MarketManager");
  const marketManager = await MarketManager.deploy(usdcToken, { gasLimit: 5000000 });
  await marketManager.deployed();
  console.log("MarketManager deployed to:", marketManager.address);

  // Deploy ExchangeSettlement
  console.log("\n--- Deploying ExchangeSettlement ---");
  const ExchangeSettlement = await ethers.getContractFactory("ExchangeSettlement");
  const exchangeSettlement = await ExchangeSettlement.deploy(
    usdcToken,
    deployer.address, // operator = deployer
    { gasLimit: 5000000 }
  );
  await exchangeSettlement.deployed();
  console.log("ExchangeSettlement deployed to:", exchangeSettlement.address);

  // Save deployment info
  const deployment = {
    network,
    timestamp: Date.now(),
    deployer: deployer.address,
    usdcToken,
    marketManager: {
      address: marketManager.address,
    },
    exchangeSettlement: {
      address: exchangeSettlement.address,
      operator: deployer.address,
    },
  };

  const fs = require("fs");
  const filename = `deployments/clob-${network}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${filename}`);
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("MarketManager:", marketManager.address);
  console.log("ExchangeSettlement:", exchangeSettlement.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
