const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying CryptoPredictionMarket to Mainnet");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "HBAR");

  // Need ~15 HBAR for a single contract deployment
  const minBalance = hre.ethers.utils.parseEther("15");
  if (balance.lt(minBalance)) {
    console.error("ERROR: Need at least 15 HBAR for deployment. Current:", hre.ethers.utils.formatEther(balance));
    process.exit(1);
  }

  // Mainnet USDC: 0x000000000000000000000000000000000006f89a (0.0.456858)
  // Hardcoded to mainnet USDC -- this script is mainnet-only
  const stakingToken = "0x000000000000000000000000000000000006f89a";
  console.log("Staking token (USDC):", stakingToken);

  // USDC has 6 decimals on Hedera.
  //   minStake = 0.01 USDC (10_000 base units)
  //   maxStake = 100  USDC (100_000_000 base units)
  // Override via env: MIN_STAKE / MAX_STAKE (raw integer in base units).
  const minStake = process.env.MIN_STAKE || "10000";
  const maxStake = process.env.MAX_STAKE || "100000000";
  console.log("minStake:", minStake);
  console.log("maxStake:", maxStake);
  console.log("");

  // Deploy CryptoPredictionMarket only
  console.log("Deploying CryptoPredictionMarket...");
  const CryptoPredictionMarket = await hre.ethers.getContractFactory("CryptoPredictionMarket");
  const cryptoMarket = await CryptoPredictionMarket.deploy("HBAR", 8, stakingToken, minStake, maxStake);
  await cryptoMarket.deployed();

  console.log("Contract deployed to:", cryptoMarket.address);
  console.log("");

  // Read startTimestamp from the deployed contract
  const startTimestamp = await cryptoMarket.startTimestamp();
  const minDaysAhead = await cryptoMarket.MIN_DAYS_AHEAD();
  const owner = await cryptoMarket.owner();

  console.log("=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("EVM Address:    ", cryptoMarket.address);
  console.log("Owner:          ", owner);
  console.log("startTimestamp: ", startTimestamp.toString());
  console.log("MIN_DAYS_AHEAD: ", minDaysAhead.toString());
  console.log("Staking Token:  ", stakingToken);
  console.log("Network:        ", hre.network.name);
  console.log("");
  console.log("SAVE THESE VALUES -- you need them for frontend config:");
  console.log("  contract-config.ts -> CONTRACT_ADDRESSES[CRYPTO] =", `'${cryptoMarket.address}'`);
  console.log("  contract-config.ts -> CONTRACT_START_TIMESTAMPS[CRYPTO] =", startTimestamp.toString());
  console.log("  sync.ts -> CONTRACT_START_TIMESTAMPS.crypto =", startTimestamp.toString());
  console.log("");
  console.log("To get the Hedera Contract ID (0.0.X), check HashScan:");
  console.log(`  https://hashscan.io/mainnet/contract/${cryptoMarket.address}`);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    stakingToken: stakingToken,
    contract: {
      name: "CryptoPredictionMarket",
      address: cryptoMarket.address,
      startTimestamp: startTimestamp.toString(),
      minDaysAhead: minDaysAhead.toString(),
      assetSymbol: "HBAR",
      priceDecimals: 8,
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filepath = path.join(deploymentsDir, `crypto-mainnet-${Date.now()}.json`);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", filepath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
