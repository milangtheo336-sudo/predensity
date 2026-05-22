const { ethers } = require("hardhat");

module.exports = async (
  contractAddress,
  targetTimestamp,
  priceMin,
  priceMax,
  stakeAmount,
) => {
  // Assign the first signer
  let wallet = (await ethers.getSigners())[0];

  console.log("🎲 Placing bet using placeBetWithoutValue...");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`👤 User Address: ${wallet.address}`);
  console.log(`📅 Target Timestamp: ${targetTimestamp}`);
  console.log(`📈 Price Range: ${priceMin} - ${priceMax}`);
  console.log(`💰 Stake Amount: ${ethers.utils.formatEther(stakeAmount)} ETH`);

  try {
    // Get contract instance
    const TestPredensityPredictionMarket = await ethers.getContractFactory(
      "TestPredensityPredictionMarket",
    );
    const contract = TestPredensityPredictionMarket.attach(contractAddress);

    // Check if contract exists
    const code = await ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      console.log("❌ No contract found at this address");
      return;
    }

    console.log("✅ Contract found at address");

    // Skip simulation for now and go straight to placing the bet
    console.log("\n🚀 Placing bet directly...");
    const tx = await contract
      .connect(wallet)
      .placeBetWithoutValue(targetTimestamp, priceMin, priceMax, stakeAmount);

    console.log("⏳ Waiting for transaction...");
    const receipt = await tx.wait();

    console.log("✅ Bet placed successfully!");
    console.log(`📝 Transaction Hash: ${tx.hash}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Get the bet ID from the event
    const betPlacedEvent = receipt.events?.find(
      (event) => event.event === "BetPlaced",
    );
    if (betPlacedEvent) {
      const betId = betPlacedEvent.args.betId;
      console.log(`🆔 Bet ID: ${betId.toString()}`);

      // Get bet details
      const bet = await contract.bets(betId);
      console.log("\n📋 Bet Details:");
      console.log(`👤 Bettor: ${bet.bettor}`);
      console.log(`📅 Target Timestamp: ${bet.targetTimestamp}`);
      console.log(`📈 Price Range: ${bet.priceMin} - ${bet.priceMax}`);
      console.log(`💰 Stake: ${ethers.utils.formatEther(bet.stake)} ETH`);
      console.log(`⭐ Quality BPS: ${bet.qualityBps}`);
      console.log(`⚖️ Weight: ${bet.weight}`);
      console.log(`✅ Finalized: ${bet.finalized}`);
      console.log(`💸 Claimed: ${bet.claimed}`);
    }

    return tx.hash;
  } catch (error) {
    console.log("❌ Error placing bet:", error.message);
    throw error;
  }
};
