const { ethers } = require("hardhat");

module.exports = async (contractAddress, betId, actualPrice) => {
  console.log("🏁 Finalizing bet...");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🆔 Bet ID: ${betId}`);
  console.log(`💰 Actual Price: ${actualPrice}`);

  try {
    // Get contract instance
    const PredensityPredictionMarket = await ethers.getContractFactory("PredensityPredictionMarket");
    const contract = PredensityPredictionMarket.attach(contractAddress);

    // Get bet details first
    const bet = await contract.getBet(betId);
    console.log(`👤 Bettor: ${bet.bettor}`);
    console.log(`📅 Target Timestamp: ${bet.targetTimestamp}`);
    console.log(`📈 Price Range: ${bet.priceMin} - ${bet.priceMax}`);
    console.log(`💰 Stake: ${ethers.utils.formatEther(bet.stake)} ETH`);

    // Finalize bet
    console.log("⏳ Finalizing bet...");
    const tx = await contract.finalizeBet(betId, actualPrice);
    
    console.log("⏳ Waiting for transaction...");
    const receipt = await tx.wait();
    
    console.log("✅ Bet finalized successfully!");
    console.log(`📝 Transaction Hash: ${tx.hash}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Check if bet won
    const updatedBet = await contract.getBet(betId);
    console.log(`🎯 Bet won: ${updatedBet.won}`);
    console.log(`💰 Actual Price: ${updatedBet.actualPrice}`);

    return tx.hash;

  } catch (error) {
    console.log("❌ Error:", error.message);
    
    if (error.code === 'CALL_EXCEPTION') {
      console.log("\n💡 Possible solutions:");
      console.log("   1. Make sure you're the contract owner");
      console.log("   2. Check that bet exists and is not already finalized");
      console.log("   3. Verify target timestamp has passed");
      console.log("   4. Check that actual price is greater than 0");
    }
  }
}; 