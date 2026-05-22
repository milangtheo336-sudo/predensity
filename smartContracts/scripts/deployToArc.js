const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance));

  const usdcAddress = process.env.STAKING_TOKEN;
  console.log("USDC (staking token):", usdcAddress);

  // Deploy CryptoPredictionMarket
  // Constructor: (assetSymbol, priceDecimals, stakingToken, minStake, maxStake)
  // USDC has 6 decimals on Arc ERC-20 interface
  const minStake = 10000;       // 0.01 USDC (6 decimals)
  const maxStake = 100000000;   // 100 USDC (6 decimals)

  console.log("\nDeploying CryptoPredictionMarket...");
  const CryptoPredictionMarket = await hre.ethers.getContractFactory("CryptoPredictionMarket");
  const market = await CryptoPredictionMarket.deploy(
    "BTC",          // assetSymbol
    8,              // priceDecimals (BTC uses 8)
    usdcAddress,    // stakingToken (USDC on Arc)
    minStake,
    maxStake
  );
  await market.deployed();
  const marketAddress = market.address;
  console.log("CryptoPredictionMarket deployed to:", marketAddress);

  // Deploy MarketManager
  console.log("\nDeploying MarketManager...");
  const MarketManager = await hre.ethers.getContractFactory("MarketManager");
  const manager = await MarketManager.deploy(usdcAddress);
  await manager.deployed();
  const managerAddress = manager.address;
  console.log("MarketManager deployed to:", managerAddress);

  // Deploy ExchangeSettlement
  console.log("\nDeploying ExchangeSettlement...");
  const ExchangeSettlement = await hre.ethers.getContractFactory("ExchangeSettlement");
  const exchange = await ExchangeSettlement.deploy(usdcAddress, deployer.address);
  await exchange.deployed();
  const exchangeAddress = exchange.address;
  console.log("ExchangeSettlement deployed to:", exchangeAddress);

  // Deploy SimpleProxyWallet master implementation
  console.log("\nDeploying SimpleProxyWallet (master implementation)...");
  const SimpleProxyWallet = await hre.ethers.getContractFactory("SimpleProxyWallet");
  const proxyMaster = await SimpleProxyWallet.deploy(deployer.address);
  await proxyMaster.deployed();
  const proxyMasterAddress = proxyMaster.address;
  console.log("SimpleProxyWallet master deployed to:", proxyMasterAddress);

  // Deploy ProxyWalletFactory
  console.log("\nDeploying ProxyWalletFactory...");
  const ProxyWalletFactory = await hre.ethers.getContractFactory("ProxyWalletFactory");
  const factory = await ProxyWalletFactory.deploy(proxyMasterAddress);
  await factory.deployed();
  const factoryAddress = factory.address;
  console.log("ProxyWalletFactory deployed to:", factoryAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Network: Arc Testnet");
  console.log("CryptoPredictionMarket:", marketAddress);
  console.log("MarketManager:", managerAddress);
  console.log("ExchangeSettlement:", exchangeAddress);
  console.log("SimpleProxyWallet (master):", proxyMasterAddress);
  console.log("ProxyWalletFactory:", factoryAddress);
  console.log("USDC Token:", usdcAddress);
  console.log("\nVerify on https://testnet.arcscan.app");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
