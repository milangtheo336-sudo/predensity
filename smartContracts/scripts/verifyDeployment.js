const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Verifying Deployment...");
  console.log("=".repeat(60));

  // Load latest deployment
  const deploymentsDir = path.join(__dirname, "../deployments");
  const latestPath = path.join(deploymentsDir, `latest-${hre.network.name}.json`);
  
  if (!fs.existsSync(latestPath)) {
    console.error(`ERROR: No deployment found for network ${hre.network.name}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  console.log("Network:", deployment.network);
  console.log("Deployed at:", deployment.timestamp);
  console.log("Deployer:", deployment.deployer);
  console.log("");

  // Verify each contract
  const contracts = [
    { name: "CryptoPredictionMarket", address: deployment.contracts.CryptoPredictionMarket.address },
    { name: "PoliticsPredictionMarket", address: deployment.contracts.PoliticsPredictionMarket.address },
    { name: "SportsPredictionMarket", address: deployment.contracts.SportsPredictionMarket.address },
    { name: "TechnologyPredictionMarket", address: deployment.contracts.TechnologyPredictionMarket.address },
  ];

  for (const contract of contracts) {
    console.log(`Verifying ${contract.name}...`);
    console.log(`  Address: ${contract.address}`);
    
    try {
      const instance = await hre.ethers.getContractAt(contract.name, contract.address);
      
      // Check owner
      const owner = await instance.owner();
      console.log(`  Owner: ${owner}`);
      
      // Check oracle count
      const requiredConfirmations = await instance.requiredConfirmations();
      console.log(`  Required Confirmations: ${requiredConfirmations}`);
      
      // Try to get oracle count (if method exists)
      try {
        const isTrustedOracle = await instance.trustedOracles(deployment.deployer);
        console.log(`  Deployer is trusted oracle: ${isTrustedOracle}`);
      } catch (e) {
        console.log(`  Could not verify oracle status`);
      }
      
      console.log(`  Status: OK`);
      console.log(`  HashScan: https://hashscan.io/${hre.network.name}/contract/${contract.address}`);
    } catch (error) {
      console.log(`  Status: ERROR`);
      console.log(`  Error: ${error.message}`);
    }
    
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("Verification complete!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Add oracle addresses: npx hardhat run scripts/addOracles.js --network", hre.network.name);
  console.log("2. Create test markets: npx hardhat run scripts/createTestMarkets.js --network", hre.network.name);
  console.log("3. Update frontend configuration");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
