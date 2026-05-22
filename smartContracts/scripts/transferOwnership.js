const { ethers } = require("hardhat");

/**
 * Transfer ownership of PredensityPredictionMarket contract to a new address
 * @param {string} contractAddress - The address of the deployed contract
 * @param {string} newOwnerAddress - The address to transfer ownership to
 */
module.exports = async (contractAddress, newOwnerAddress) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 TRANSFERRING CONTRACT OWNERSHIP");
  console.log("=".repeat(60));

  // Get the current owner (deployer)
  const [currentOwner] = await ethers.getSigners();
  
  console.log(`\n📍 Contract Address: ${contractAddress}`);
  console.log(`👤 Current Owner (Deployer): ${currentOwner.address}`);
  console.log(`🎯 New Owner Address: ${newOwnerAddress}`);

  // Validate new owner address
  if (!ethers.utils.isAddress(newOwnerAddress)) {
    throw new Error(`Invalid address: ${newOwnerAddress}`);
  }

  // Attach to deployed contract
  const PredensityPredictionMarket = await ethers.getContractFactory("PredensityPredictionMarket");
  const contract = PredensityPredictionMarket.attach(contractAddress);

  // Verify contract is accessible
  try {
    const code = await ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      throw new Error("Contract not found at address");
    }
    console.log("✅ Contract verified on network");
  } catch (error) {
    console.error("❌ Error connecting to contract:", error.message);
    return;
  }

  // Get current owner from contract
  try {
    const currentOwnerFromContract = await contract.owner();
    console.log(`\n📊 Current Contract Owner: ${currentOwnerFromContract}`);
    
    if (currentOwnerFromContract.toLowerCase() !== currentOwner.address.toLowerCase()) {
      console.log("⚠️ WARNING: Deployer address doesn't match contract owner!");
      console.log("   You may not have permission to transfer ownership.");
      console.log("   Continuing anyway...");
    }

    if (currentOwnerFromContract.toLowerCase() === newOwnerAddress.toLowerCase()) {
      console.log("✅ Contract is already owned by this address!");
      return;
    }
  } catch (error) {
    console.log("⚠️ Could not read current owner (this is normal on Hedera)");
  }

  // Transfer ownership
  try {
    console.log("\n🚀 Transferring ownership...");
    const tx = await contract.connect(currentOwner).transferOwnership(newOwnerAddress);
    console.log(`⏳ Transaction Hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`✅ Ownership transfer transaction confirmed!`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

    // Verify new owner
    console.log("\n🔍 Verifying new owner...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Hedera
    
    const newOwnerFromContract = await contract.owner();
    console.log(`📊 New Contract Owner: ${newOwnerFromContract}`);
    
    if (newOwnerFromContract.toLowerCase() === newOwnerAddress.toLowerCase()) {
      console.log("✅ Ownership transfer successful!");
      console.log(`\n🎉 Contract is now owned by: ${newOwnerFromContract}`);
    } else {
      console.log("⚠️ WARNING: Owner verification failed!");
      console.log(`   Expected: ${newOwnerAddress}`);
      console.log(`   Got: ${newOwnerFromContract}`);
    }

  } catch (error) {
    console.error("\n❌ ERROR transferring ownership:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.code === "CALL_EXCEPTION") {
      console.error("\n💡 Possible issues:");
      console.error("   1. You are not the current owner");
      console.error("   2. Contract doesn't support transferOwnership");
      console.error("   3. Network connectivity issue");
    }
    throw error;
  }
};





