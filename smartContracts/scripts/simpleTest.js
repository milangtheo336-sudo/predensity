const { ethers } = require("hardhat");

module.exports = async (contractAddress) => {
  console.log("🔍 Simple contract test...");
  console.log(`📍 Contract Address: ${contractAddress}`);

  try {
    // Get contract instance
    const TestPredensityPredictionMarket = await ethers.getContractFactory(
      "TestPredensityPredictionMarket",
    );
    const contract = TestPredensityPredictionMarket.attach(contractAddress);

    // Try to get the contract code to see if it exists
    const code = await ethers.provider.getCode(contractAddress);
    console.log(`📦 Contract code length: ${code.length}`);

    if (code === "0x") {
      console.log("❌ No contract found at this address");
      return;
    }

    console.log("✅ Contract exists at address");

    // Try a simple view function that doesn't require parameters
    try {
      const nextBetId = await contract.nextBetId();
      console.log(`✅ nextBetId() works: ${nextBetId}`);
    } catch (error) {
      console.log(`❌ nextBetId() failed: ${error.message}`);
    }

    // Try to get the FEE_BPS constant
    try {
      const feeBps = await contract.FEE_BPS();
      console.log(`✅ FEE_BPS() works: ${feeBps}`);
    } catch (error) {
      console.log(`❌ FEE_BPS() failed: ${error.message}`);
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
};
