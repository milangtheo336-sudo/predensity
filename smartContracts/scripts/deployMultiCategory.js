const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Multi-Category Prediction Markets...");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "HBAR");
  
  // Check if balance is sufficient
  const minBalance = hre.ethers.utils.parseEther("50");
  if (balance.lt(minBalance)) {
    console.error("ERROR: Insufficient balance. Need at least 50 HBAR for deployment.");
    console.error("Fund your account at: https://portal.hedera.com/");
    process.exit(1);
  }

  // Staking token address: address(0) = native HBAR mode, or set to USDC address for token mode
  // USDC on Hedera Testnet (NEW): 0x00000000000000000000000000000000007d943f (0.0.8229951)
  // USDC on Hedera Testnet (OLD): 0x0000000000000000000000000000000000068cDa (0.0.429274) -- DO NOT USE
  // USDC on Hedera Mainnet: 0x000000000000000000000000000000000006f89a (0.0.456858)
  // Pass via env var STAKING_TOKEN or default to address(0) for HBAR mode
  const stakingToken = process.env.STAKING_TOKEN || "0x0000000000000000000000000000000000000000";
  const isTokenMode = stakingToken !== "0x0000000000000000000000000000000000000000";
  
  console.log("Staking token:", stakingToken);
  console.log("Mode:", isTokenMode ? "ERC-20 Token (USDC)" : "Native HBAR");

  // Stake bounds in the staking token's smallest unit.
  //   Native HBAR (18 decimals): 0.01 ether / 100 ether
  //   USDC      (6 decimals):   10_000 / 100_000_000
  const defaultMin = isTokenMode ? "10000" : hre.ethers.utils.parseEther("0.01").toString();
  const defaultMax = isTokenMode ? "100000000" : hre.ethers.utils.parseEther("100").toString();
  const minStake = process.env.MIN_STAKE || defaultMin;
  const maxStake = process.env.MAX_STAKE || defaultMax;
  console.log("minStake:", minStake);
  console.log("maxStake:", maxStake);
  console.log("");

  // Deploy Crypto Prediction Market
  console.log("1. Deploying CryptoPredictionMarket...");
  const CryptoPredictionMarket = await hre.ethers.getContractFactory("CryptoPredictionMarket");
  const cryptoMarket = await CryptoPredictionMarket.deploy("HBAR", 8, stakingToken, minStake, maxStake);
  await cryptoMarket.deployed();
  console.log("   CryptoPredictionMarket deployed to:", cryptoMarket.address);
  console.log("");

  // Deploy Politics Prediction Market
  console.log("2. Deploying PoliticsPredictionMarket...");
  const PoliticsPredictionMarket = await hre.ethers.getContractFactory("PoliticsPredictionMarket");
  const politicsMarket = await PoliticsPredictionMarket.deploy(stakingToken);
  await politicsMarket.deployed();
  console.log("   PoliticsPredictionMarket deployed to:", politicsMarket.address);
  console.log("");

  // Deploy Sports Prediction Market
  console.log("3. Deploying SportsPredictionMarket...");
  const SportsPredictionMarket = await hre.ethers.getContractFactory("SportsPredictionMarket");
  const sportsMarket = await SportsPredictionMarket.deploy(stakingToken);
  await sportsMarket.deployed();
  console.log("   SportsPredictionMarket deployed to:", sportsMarket.address);
  console.log("");

  // Deploy Technology Prediction Market
  console.log("4. Deploying TechnologyPredictionMarket...");
  const TechnologyPredictionMarket = await hre.ethers.getContractFactory("TechnologyPredictionMarket");
  const techMarket = await TechnologyPredictionMarket.deploy(stakingToken);
  await techMarket.deployed();
  console.log("   TechnologyPredictionMarket deployed to:", techMarket.address);
  console.log("");

  // Verify ownership
  console.log("5. Verifying contract ownership...");
  const cryptoOwner = await cryptoMarket.owner();
  const politicsOwner = await politicsMarket.owner();
  const sportsOwner = await sportsMarket.owner();
  const techOwner = await techMarket.owner();
  
  console.log("   Crypto owner:", cryptoOwner);
  console.log("   Politics owner:", politicsOwner);
  console.log("   Sports owner:", sportsOwner);
  console.log("   Technology owner:", techOwner);
  console.log("");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    stakingToken: stakingToken,
    isTokenMode: isTokenMode,
    contracts: {
      CryptoPredictionMarket: {
        address: cryptoMarket.address,
        assetSymbol: "HBAR",
        priceDecimals: 8,
        stakingToken: stakingToken
      },
      PoliticsPredictionMarket: {
        address: politicsMarket.address,
        stakingToken: stakingToken
      },
      SportsPredictionMarket: {
        address: sportsMarket.address,
        stakingToken: stakingToken
      },
      TechnologyPredictionMarket: {
        address: techMarket.address,
        stakingToken: stakingToken
      }
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
  
  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${filepath}`);
  console.log("");

  // Save latest deployment
  const latestPath = path.join(deploymentsDir, `latest-${hre.network.name}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Latest deployment saved to: ${latestPath}`);
  console.log("");

  // Copy to frontend config location
  const frontendConfigDir = path.join(__dirname, "../../frontend/src/lib/contracts");
  if (fs.existsSync(frontendConfigDir)) {
    const frontendConfigPath = path.join(frontendConfigDir, `deployed-contracts-${hre.network.name}.json`);
    fs.writeFileSync(frontendConfigPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Contract addresses copied to frontend: ${frontendConfigPath}`);
    console.log("");
  }

  console.log("Next steps:");
  console.log("1. Create events/markets for each category");
  console.log("2. Update frontend contract-config.ts with new addresses");
  console.log("3. Configure subgraph to index all four contracts");
  console.log("4. Verify contracts on HashScan:");
  console.log(`   https://hashscan.io/${hre.network.name}/contract/${cryptoMarket.address}`);
  console.log("");
  console.log("Resolution methods (all centralized - owner only):");
  console.log("- Crypto: setPriceForTimestamp() or setPricesForTimestamps()");
  console.log("- Politics: submitPoliticalResult() or batchResolvePoliticalEvents()");
  console.log("- Sports: submitSportsResult() or batchResolveSportsEvents()");
  console.log("- Technology: submitTechResult() or batchResolveTechEvents()");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
