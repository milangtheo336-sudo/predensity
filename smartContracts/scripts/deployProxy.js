const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy SimpleProxyWallet master implementation
  console.log("\nDeploying SimpleProxyWallet (master implementation)...");
  const SimpleProxyWallet = await hre.ethers.getContractFactory("SimpleProxyWallet");
  const proxyMaster = await SimpleProxyWallet.deploy(deployer.address);
  await proxyMaster.deployed();
  console.log("SimpleProxyWallet master deployed to:", proxyMaster.address);

  // Deploy ProxyWalletFactory
  console.log("\nDeploying ProxyWalletFactory...");
  const ProxyWalletFactory = await hre.ethers.getContractFactory("ProxyWalletFactory");
  const factory = await ProxyWalletFactory.deploy(proxyMaster.address);
  await factory.deployed();
  console.log("ProxyWalletFactory deployed to:", factory.address);

  console.log("\n=== Proxy Deployment Summary ===");
  console.log("SimpleProxyWallet (master):", proxyMaster.address);
  console.log("ProxyWalletFactory:", factory.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
