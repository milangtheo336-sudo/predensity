const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ChallengeMarket with account:", deployer.address);

  const usdcAddress = process.env.STAKING_TOKEN;
  console.log("Staking Token (USDC):", usdcAddress);

  // Fee recipient will be the deployer for now (treasury)
  const feeRecipient = deployer.address;

  const ChallengeMarket = await hre.ethers.getContractFactory("ChallengeMarket");
  const market = await ChallengeMarket.deploy(usdcAddress, feeRecipient);
  await market.deployed();
  
  console.log("ChallengeMarket deployed to:", market.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
