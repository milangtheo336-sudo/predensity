const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying CryptoPredictionMarket...");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "HBAR");
  
  // Check if balance is sufficient
  const minBalance = hre.ethers.utils.parseEther("20");
  if (balance.lt(minBalance)) {
    console.error("ERROR: Insufficient balance. Need at least 20 HBAR for deployment.");
    console.error("Fund your account at: https://portal.hedera.com/");
    process.exit(1);
  }
  
  console.log("");

  // Staking token: address(0) = native HBAR, or USDC address for token mode
  const stakingToken = process.env.STAKING_TOKEN || "0x0000000000000000000000000000000000000000";
  const isTokenMode = stakingToken !== "0x0000000000000000000000000000000000000000";

  // Stake bounds: must be expressed in the staking token's smallest unit.
  //   Native HBAR (18 decimals): 0.01 ether (1e16) / 100 ether (1e20)
  //   USDC      (6  decimals):   10_000   (= 0.01 USDC) / 100_000_000 (= 100 USDC)
  // Override via env: MIN_STAKE / MAX_STAKE (raw integer in smallest unit).
  const defaultMin = isTokenMode ? "10000" : hre.ethers.utils.parseEther("0.01").toString();
  const defaultMax = isTokenMode ? "100000000" : hre.ethers.utils.parseEther("100").toString();
  const minStake = process.env.MIN_STAKE || defaultMin;
  const maxStake = process.env.MAX_STAKE || defaultMax;

  // Deploy Crypto Prediction Market
  console.log("Deploying CryptoPredictionMarket...");
  console.log("Constructor parameters:");
  console.log("  - assetSymbol: HBAR");
  console.log("  - priceDecimals: 8");
  console.log("  - stakingToken:", stakingToken, isTokenMode ? "(ERC-20 Token Mode)" : "(Native HBAR Mode)");
  console.log("  - minStake:", minStake);
  console.log("  - maxStake:", maxStake);
  console.log("");

  const CryptoPredictionMarket = await hre.ethers.getContractFactory("CryptoPredictionMarket");
  const cryptoMarket = await CryptoPredictionMarket.deploy("HBAR", 8, stakingToken, minStake, maxStake);
  await cryptoMarket.deployed();
  
  console.log("CryptoPredictionMarket deployed to:", cryptoMarket.address);
  console.log("");

  // Verify deployment
  console.log("Verifying deployment...");
  const owner = await cryptoMarket.owner();
  const assetSymbol = await cryptoMarket.assetSymbol();
  const priceDecimals = await cryptoMarket.priceDecimals();
  const startTimestamp = await cryptoMarket.startTimestamp();
  
  console.log("  Owner:", owner);
  console.log("  Asset Symbol:", assetSymbol);
  console.log("  Price Decimals:", priceDecimals);
  console.log("  Start Timestamp:", startTimestamp.toString());
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contract: {
      name: "CryptoPredictionMarket",
      address: cryptoMarket.address,
      assetSymbol: assetSymbol,
      priceDecimals: priceDecimals.toString(),
      startTimestamp: startTimestamp.toString(),
      owner: owner
    }
  };

  console.log("=".repeat(60));
  console.log("Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("=".repeat(60));

  // Save to file
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `crypto-market-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${filepath}`);
  console.log("");

  // Save latest deployment
  const latestPath = path.join(deploymentsDir, `crypto-market-latest-${hre.network.name}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Latest deployment saved to: ${latestPath}`);
  console.log("");

  console.log("Next steps:");
  console.log("1. Update frontend/.env.local with contract address:");
  console.log(`   NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS=${cryptoMarket.address}`);
  console.log("");
  console.log("2. Verify contract on HashScan:");
  console.log(`   https://hashscan.io/${hre.network.name}/contract/${cryptoMarket.address}`);
  console.log("");
  console.log("3. Set prices for timestamps using setPriceForTimestamp() or setPricesForTimestamps()");
  console.log("");
  console.log("4. For multi-asset support, users can call placeBetWithAsset(asset, timestamp, priceMin, priceMax)");
  console.log("   Example assets: 'HBAR', 'BTC', 'ETH', 'SOL'");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
