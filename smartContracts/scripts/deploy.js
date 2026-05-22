const hre = require("hardhat");

async function main() {
  const PredensityPredictionMarket = await hre.ethers.getContractFactory(
    "PredensityPredictionMarket",
  );
  const contract = await PredensityPredictionMarket.deploy();
  await contract.deployed();
  console.log("PredensityPredictionMarket deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
