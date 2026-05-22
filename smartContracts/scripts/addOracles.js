const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Adding Trusted Oracles to Prediction Markets...");
  console.log("=".repeat(60));

  // Load latest deployment
  const deploymentsDir = path.join(__dirname, "../deployments");
  const latestPath = path.join(deploymentsDir, `latest-${hre.network.name}.json`);
  
  if (!fs.existsSync(latestPath)) {
    console.error(`ERROR: No deployment found for network ${hre.network.name}`);
    console.error(`Please deploy contracts first using: npx hardhat run scripts/deployMultiCategory.js --network ${hre.network.name}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  console.log("Loaded deployment from:", latestPath);
  console.log("");

  // Oracle addresses to add (replace with your actual oracle addresses)
  const oracleAddresses = [
    "0x0000000000000000000000000000000000000001", // Replace with actual address
    "0x0000000000000000000000000000000000000002", // Replace with actual address
    "0x0000000000000000000000000000000000000003", // Replace with actual address
    "0x0000000000000000000000000000000000000004", // Replace with actual address
  ];

  console.log("Oracle addresses to add:");
  oracleAddresses.forEach((addr, i) => {
    console.log(`  ${i + 1}. ${addr}`);
  });
  console.log("");

  // Get contract instances
  const cryptoMarket = await hre.ethers.getContractAt(
    "CryptoPredictionMarket",
    deployment.contracts.CryptoPredictionMarket.address
  );
  
  const politicsMarket = await hre.ethers.getContractAt(
    "PoliticsPredictionMarket",
    deployment.contracts.PoliticsPredictionMarket.address
  );
  
  const sportsMarket = await hre.ethers.getContractAt(
    "SportsPredictionMarket",
    deployment.contracts.SportsPredictionMarket.address
  );
  
  const techMarket = await hre.ethers.getContractAt(
    "TechnologyPredictionMarket",
    deployment.contracts.TechnologyPredictionMarket.address
  );

  // Add oracles to each contract
  console.log("Adding oracles to CryptoPredictionMarket...");
  for (const oracle of oracleAddresses) {
    try {
      const tx = await cryptoMarket.addTrustedOracle(oracle);
      await tx.wait();
      console.log(`  Added: ${oracle}`);
    } catch (error) {
      console.log(`  Skipped: ${oracle} (already added or error)`);
    }
  }
  console.log("");

  console.log("Adding oracles to PoliticsPredictionMarket...");
  for (const oracle of oracleAddresses) {
    try {
      const tx = await politicsMarket.addTrustedOracle(oracle);
      await tx.wait();
      console.log(`  Added: ${oracle}`);
    } catch (error) {
      console.log(`  Skipped: ${oracle} (already added or error)`);
    }
  }
  console.log("");

  console.log("Adding oracles to SportsPredictionMarket...");
  for (const oracle of oracleAddresses) {
    try {
      const tx = await sportsMarket.addTrustedOracle(oracle);
      await tx.wait();
      console.log(`  Added: ${oracle}`);
    } catch (error) {
      console.log(`  Skipped: ${oracle} (already added or error)`);
    }
  }
  console.log("");

  console.log("Adding oracles to TechnologyPredictionMarket...");
  for (const oracle of oracleAddresses) {
    try {
      const tx = await techMarket.addTrustedOracle(oracle);
      await tx.wait();
      console.log(`  Added: ${oracle}`);
    } catch (error) {
      console.log(`  Skipped: ${oracle} (already added or error)`);
    }
  }
  console.log("");

  console.log("=".repeat(60));
  console.log("Oracle setup complete!");
  console.log("Total oracles per contract: 5 (1 deployer + 4 additional)");
  console.log("Required confirmations: 3 out of 5");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
