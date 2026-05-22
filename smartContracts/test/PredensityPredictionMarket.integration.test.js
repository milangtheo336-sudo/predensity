const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PredensityPredictionMarket Integration Tests", function () {
  let PredensityPredictionMarket;
  let predictionMarket;
  let owner, alice, bob, charlie;
  let startTimestamp;

  beforeEach(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    console.log(`Available signers: ${signers.length}`);
    
    owner = signers[0];
    
    // Create additional accounts if needed
    if (signers.length >= 4) {
      alice = signers[1];
      bob = signers[2];
      charlie = signers[3];
    } else {
      // Create additional accounts using ethers
      const provider = ethers.provider;
      alice = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
      bob = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
      charlie = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
      
      // Fund the accounts with some ETH
      const fundAmount = ethers.utils.parseEther("10");
      await owner.sendTransaction({ to: alice.address, value: fundAmount });
      await owner.sendTransaction({ to: bob.address, value: fundAmount });
      await owner.sendTransaction({ to: charlie.address, value: fundAmount });
      
      console.log("💰 Funded additional accounts with 10 ETH each");
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🔧 SETTING UP NEW TEST");
    console.log("=".repeat(60));
    console.log(`👑 Owner: ${owner.address}`);
    console.log(`👤 Alice: ${alice.address}`);
    console.log(`👤 Bob: ${bob.address}`);
    console.log(`👤 Charlie: ${charlie.address}`);

    // Deploy contract
    console.log("🚀 Deploying PredensityPredictionMarket contract...");
    PredensityPredictionMarket = await ethers.getContractFactory("PredensityPredictionMarket");
    predictionMarket = await PredensityPredictionMarket.deploy();
    await predictionMarket.deployed();
    
    console.log(`📍 Contract Address: ${predictionMarket.address}`);
    
    try {
      startTimestamp = await predictionMarket.startTimestamp();
      console.log(`📅 Contract Start Timestamp: ${startTimestamp}`);
    } catch (error) {
      console.log(`❌ Error getting startTimestamp: ${error.message}`);
      // Try to get contract code to see if it's deployed
      const code = await ethers.provider.getCode(predictionMarket.address);
      console.log(`📦 Contract code length: ${code.length}`);
      if (code === "0x") {
        console.log("❌ No contract code found at address");
      }
    }
  });

  describe("🎯 Multi-Actor Multi-Bucket Integration Test", function () {
    it("Should handle complete workflow with multiple actors and buckets", async function () {
      console.log("\n" + "🎯".repeat(20) + " INTEGRATION TEST START " + "🎯".repeat(20));
      
      // ==============================================================
      // |                    Phase 1: Place Bets                     |
      // ==============================================================
      console.log("\n📊 PHASE 1: PLACING BETS");
      console.log("=".repeat(50));

      // Calculate timestamps for different buckets using chain time.
      // Add a small buffer so MIN_DAYS_AHEAD checks remain valid at execution time.
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const bufferSeconds = 120;
      const bucket0Time = now + (1 * 24 * 60 * 60) + bufferSeconds;
      const bucket1Time = now + (2 * 24 * 60 * 60) + bufferSeconds;
      const bucket2Time = now + (3 * 24 * 60 * 60) + bufferSeconds;

      console.log(`⏰ Current Time: ${now}`);
      console.log(`📅 Bucket 0 Target: ${bucket0Time} (${new Date(bucket0Time * 1000).toISOString()})`);
      console.log(`📅 Bucket 1 Target: ${bucket1Time} (${new Date(bucket1Time * 1000).toISOString()})`);
      console.log(`📅 Bucket 2 Target: ${bucket2Time} (${new Date(bucket2Time * 1000).toISOString()})`);

      // Alice places bet in bucket 0 (sharp prediction)
      console.log("\n🎲 ALICE'S BET (Bucket 0 - Sharp Prediction)");
      console.log("-".repeat(40));
      const aliceStake = ethers.utils.parseEther("0.1");
      const alicePriceMin = 100; // $0.0100
      const alicePriceMax = 120; // $0.0120 (very sharp: 20% range)
      
      console.log(`💰 Stake: ${ethers.utils.formatEther(aliceStake)} ETH`);
      console.log(`📈 Price Range: ${alicePriceMin} - ${alicePriceMax} (${alicePriceMax - alicePriceMin} BPS range)`);
      
      const aliceTx = await predictionMarket.connect(alice).placeBet(
        bucket0Time,
        alicePriceMin,
        alicePriceMax,
        { value: aliceStake }
      );
      const aliceReceipt = await aliceTx.wait();
      const aliceBetId = 0;
      
      console.log(`✅ Alice's bet placed! Bet ID: ${aliceBetId}`);
      console.log(`📝 Transaction: ${aliceTx.hash}`);
      console.log(`⛽ Gas Used: ${aliceReceipt.gasUsed.toString()}`);

      // Bob places bet in bucket 0 (medium prediction)
      console.log("\n🎲 BOB'S BET (Bucket 0 - Medium Prediction)");
      console.log("-".repeat(40));
      const bobStake = ethers.utils.parseEther("0.2");
      const bobPriceMin = 90;  // $0.0090
      const bobPriceMax = 150; // $0.0150 (medium: 60% range)
      
      console.log(`💰 Stake: ${ethers.utils.formatEther(bobStake)} ETH`);
      console.log(`📈 Price Range: ${bobPriceMin} - ${bobPriceMax} (${bobPriceMax - bobPriceMin} BPS range)`);
      
      const bobTx = await predictionMarket.connect(bob).placeBet(
        bucket0Time,
        bobPriceMin,
        bobPriceMax,
        { value: bobStake }
      );
      const bobReceipt = await bobTx.wait();
      const bobBetId = 1;
      
      console.log(`✅ Bob's bet placed! Bet ID: ${bobBetId}`);
      console.log(`📝 Transaction: ${bobTx.hash}`);
      console.log(`⛽ Gas Used: ${bobReceipt.gasUsed.toString()}`);

      // Charlie places bet in bucket 1 (long-term prediction)
      console.log("\n🎲 CHARLIE'S BET (Bucket 1 - Long-term Prediction)");
      console.log("-".repeat(40));
      const charlieStake = ethers.utils.parseEther("0.15");
      const charliePriceMin = 80;  // $0.0080
      const charliePriceMax = 200; // $0.0200 (wide: 120% range)
      
      console.log(`💰 Stake: ${ethers.utils.formatEther(charlieStake)} ETH`);
      console.log(`📈 Price Range: ${charliePriceMin} - ${charliePriceMax} (${charliePriceMax - charliePriceMin} BPS range)`);
      
      const charlieTx = await predictionMarket.connect(charlie).placeBet(
        bucket1Time,
        charliePriceMin,
        charliePriceMax,
        { value: charlieStake }
      );
      const charlieReceipt = await charlieTx.wait();
      const charlieBetId = 2;
      
      console.log(`✅ Charlie's bet placed! Bet ID: ${charlieBetId}`);
      console.log(`📝 Transaction: ${charlieTx.hash}`);
      console.log(`⛽ Gas Used: ${charlieReceipt.gasUsed.toString()}`);

      // ==============================================================
      // |                    Phase 2: Check Bet Details              |
      // ==============================================================
      console.log("\n📋 PHASE 2: CHECKING BET DETAILS");
      console.log("=".repeat(50));

      // Get all bet details
      const aliceBet = await predictionMarket.getBet(aliceBetId);
      const bobBet = await predictionMarket.getBet(bobBetId);
      const charlieBet = await predictionMarket.getBet(charlieBetId);

      console.log("\n📊 BET DETAILS:");
      console.log("Alice's Bet:");
      console.log(`  👤 Bettor: ${aliceBet.bettor}`);
      console.log(`  📅 Target: ${aliceBet.targetTimestamp}`);
      console.log(`  📈 Range: ${aliceBet.priceMin} - ${aliceBet.priceMax}`);
      console.log(`  💰 Stake: ${ethers.utils.formatEther(aliceBet.stake)} ETH`);
      console.log(`  ⭐ Quality BPS: ${aliceBet.qualityBps}`);
      console.log(`  ⚖️ Weight: ${aliceBet.weight}`);
      console.log(`  🏁 Finalized: ${aliceBet.finalized}`);
      console.log(`  🎯 Won: ${aliceBet.won}`);

      console.log("\nBob's Bet:");
      console.log(`  👤 Bettor: ${bobBet.bettor}`);
      console.log(`  📅 Target: ${bobBet.targetTimestamp}`);
      console.log(`  📈 Range: ${bobBet.priceMin} - ${bobBet.priceMax}`);
      console.log(`  💰 Stake: ${ethers.utils.formatEther(bobBet.stake)} ETH`);
      console.log(`  ⭐ Quality BPS: ${bobBet.qualityBps}`);
      console.log(`  ⚖️ Weight: ${bobBet.weight}`);
      console.log(`  🏁 Finalized: ${bobBet.finalized}`);
      console.log(`  🎯 Won: ${bobBet.won}`);

      console.log("\nCharlie's Bet:");
      console.log(`  👤 Bettor: ${charlieBet.bettor}`);
      console.log(`  📅 Target: ${charlieBet.targetTimestamp}`);
      console.log(`  📈 Range: ${charliePriceMin} - ${charliePriceMax}`);
      console.log(`  💰 Stake: ${ethers.utils.formatEther(charlieBet.stake)} ETH`);
      console.log(`  ⭐ Quality BPS: ${charlieBet.qualityBps}`);
      console.log(`  ⚖️ Weight: ${charlieBet.weight}`);
      console.log(`  🏁 Finalized: ${charlieBet.finalized}`);
      console.log(`  🎯 Won: ${charlieBet.won}`);

      // ==============================================================
      // |                    Phase 3: Check Bucket Stats             |
      // ==============================================================
      console.log("\n📊 PHASE 3: CHECKING BUCKET STATISTICS");
      console.log("=".repeat(50));

      const bucket0Index = await predictionMarket.bucketIndex(bucket0Time);
      const bucket1Index = await predictionMarket.bucketIndex(bucket1Time);
      const bucket2Index = await predictionMarket.bucketIndex(bucket2Time);

      const bucket0Stats = await predictionMarket.getBucketStats(bucket0Index);
      const bucket1Stats = await predictionMarket.getBucketStats(bucket1Index);
      const bucket2Stats = await predictionMarket.getBucketStats(bucket2Index);

      console.log("\n📦 BUCKET STATISTICS:");
      console.log("Bucket 0 (Alice + Bob):");
      console.log(`  💰 Total Staked: ${ethers.utils.formatEther(bucket0Stats.totalStaked)} ETH`);
      console.log(`  ⚖️ Total Weight: ${bucket0Stats.totalWeight}`);
      console.log(`  💵 Price: ${bucket0Stats.price} (0 = not set yet)`);

      console.log("\nBucket 1 (Charlie):");
      console.log(`  💰 Total Staked: ${ethers.utils.formatEther(bucket1Stats.totalStaked)} ETH`);
      console.log(`  ⚖️ Total Weight: ${bucket1Stats.totalWeight}`);
      console.log(`  💵 Price: ${bucket1Stats.price} (0 = not set yet)`);

      console.log("\nBucket 2 (Empty):");
      console.log(`  💰 Total Staked: ${ethers.utils.formatEther(bucket2Stats.totalStaked)} ETH`);
      console.log(`  ⚖️ Total Weight: ${bucket2Stats.totalWeight}`);
      console.log(`  💵 Price: ${bucket2Stats.price} (0 = not set yet)`);

      // ==============================================================
      // |                    Phase 4: Set Prices                    |
      // ==============================================================
      console.log("\n💰 PHASE 4: SETTING PRICES (Owner Action)");
      console.log("=".repeat(50));

      // Set price for timestamp used by bucket 0 bets
      const bucket0Price = 110; // $0.0110 (Alice wins, Bob loses)
      console.log(`\n🔧 Setting Timestamp Price for Bucket 0 bets: ${bucket0Price}`);
      const setPrice0Tx = await predictionMarket
        .connect(owner)
        .setPriceForTimestamp(bucket0Time, bucket0Price);
      await setPrice0Tx.wait();
      console.log(`✅ Timestamp price set to ${bucket0Price}`);

      // Set price for timestamp used by bucket 1 bets
      const bucket1Price = 180; // $0.0180 (Charlie wins)
      console.log(`\n🔧 Setting Timestamp Price for Bucket 1 bets: ${bucket1Price}`);
      const setPrice1Tx = await predictionMarket
        .connect(owner)
        .setPriceForTimestamp(bucket1Time, bucket1Price);
      await setPrice1Tx.wait();
      console.log(`✅ Timestamp price set to ${bucket1Price}`);

      // ==============================================================
      // |              Phase 5: Process Bucket Batches              |
      // ==============================================================
      console.log("\n🏁 PHASE 5: PROCESSING BATCHES");
      console.log("=".repeat(50));

      console.log(`\n🏁 Processing Bucket ${bucket0Index} for Alice + Bob bets`);
      const processBucket0Tx = await predictionMarket.connect(owner).processBatch(bucket0Index);
      await processBucket0Tx.wait();
      console.log(`✅ Processed Bucket ${bucket0Index}`);

      console.log(`\n🏁 Processing Bucket ${bucket1Index} for Charlie bet`);
      const processBucket1Tx = await predictionMarket.connect(owner).processBatch(bucket1Index);
      await processBucket1Tx.wait();
      console.log(`✅ Processed Bucket ${bucket1Index}`);

      // ==============================================================
      // |                    Phase 6: Check Finalized Bets           |
      // ==============================================================
      console.log("\n📋 PHASE 6: CHECKING FINALIZED BETS");
      console.log("=".repeat(50));

      const aliceBetFinal = await predictionMarket.getBet(aliceBetId);
      const bobBetFinal = await predictionMarket.getBet(bobBetId);
      const charlieBetFinal = await predictionMarket.getBet(charlieBetId);

      console.log("\n📊 FINALIZED BET RESULTS:");
      console.log("Alice's Bet:");
      console.log(`  🏁 Finalized: ${aliceBetFinal.finalized}`);
      console.log(`  💰 Actual Price: ${aliceBetFinal.actualPrice}`);
      console.log(`  🎯 Won: ${aliceBetFinal.won}`);
      console.log(`  💰 Claimed: ${aliceBetFinal.claimed}`);

      console.log("\nBob's Bet:");
      console.log(`  🏁 Finalized: ${bobBetFinal.finalized}`);
      console.log(`  💰 Actual Price: ${bobBetFinal.actualPrice}`);
      console.log(`  🎯 Won: ${bobBetFinal.won}`);
      console.log(`  💰 Claimed: ${bobBetFinal.claimed}`);

      console.log("\nCharlie's Bet:");
      console.log(`  🏁 Finalized: ${charlieBetFinal.finalized}`);
      console.log(`  💰 Actual Price: ${charlieBetFinal.actualPrice}`);
      console.log(`  🎯 Won: ${charlieBetFinal.won}`);
      console.log(`  💰 Claimed: ${charlieBetFinal.claimed}`);

      // ==============================================================
      // |                    Phase 7: Claim Winnings                 |
      // ==============================================================
      console.log("\n💰 PHASE 7: CLAIMING WINNINGS");
      console.log("=".repeat(50));

      // Alice claims (should win)
      if (aliceBetFinal.won) {
        console.log(`\n💰 Alice claiming winnings (Bet ID: ${aliceBetId})`);
        const aliceBalanceBefore = await alice.getBalance();
        const claimAliceTx = await predictionMarket.connect(alice).claimBet(aliceBetId);
        await claimAliceTx.wait();
        const aliceBalanceAfter = await alice.getBalance();
        const alicePayout = aliceBalanceAfter.sub(aliceBalanceBefore);
        console.log(`✅ Alice claimed successfully!`);
        console.log(`💰 Payout: ${ethers.utils.formatEther(alicePayout)} ETH`);
      } else {
        console.log(`\n❌ Alice lost - no payout to claim`);
      }

      // Bob claims (should lose)
      if (bobBetFinal.won) {
        console.log(`\n💰 Bob claiming winnings (Bet ID: ${bobBetId})`);
        const bobBalanceBefore = await bob.getBalance();
        const claimBobTx = await predictionMarket.connect(bob).claimBet(bobBetId);
        await claimBobTx.wait();
        const bobBalanceAfter = await bob.getBalance();
        const bobPayout = bobBalanceAfter.sub(bobBalanceBefore);
        console.log(`✅ Bob claimed successfully!`);
        console.log(`💰 Payout: ${ethers.utils.formatEther(bobPayout)} ETH`);
      } else {
        console.log(`\n❌ Bob lost - no payout to claim`);
      }

      // Charlie claims (should win)
      if (charlieBetFinal.won) {
        console.log(`\n💰 Charlie claiming winnings (Bet ID: ${charlieBetId})`);
        const charlieBalanceBefore = await charlie.getBalance();
        const claimCharlieTx = await predictionMarket.connect(charlie).claimBet(charlieBetId);
        await claimCharlieTx.wait();
        const charlieBalanceAfter = await charlie.getBalance();
        const charliePayout = charlieBalanceAfter.sub(charlieBalanceBefore);
        console.log(`✅ Charlie claimed successfully!`);
        console.log(`💰 Payout: ${ethers.utils.formatEther(charliePayout)} ETH`);
      } else {
        console.log(`\n❌ Charlie lost - no payout to claim`);
      }

      // ==============================================================
      // |                    Phase 8: Final Statistics               |
      // ==============================================================
      console.log("\n📊 PHASE 8: FINAL STATISTICS");
      console.log("=".repeat(50));

      const finalStats = await predictionMarket.getStats();
      const finalBucket0Stats = await predictionMarket.getBucketStats(bucket0Index);
      const finalBucket1Stats = await predictionMarket.getBucketStats(bucket1Index);

      console.log("\n📈 CONTRACT STATISTICS:");
      console.log(`  🎲 Total Bets: ${finalStats.totalBets}`);
      console.log(`  💰 Total Fees: ${ethers.utils.formatEther(finalStats.totalFees)} ETH`);
      console.log(`  💵 Contract Balance: ${ethers.utils.formatEther(finalStats.contractBalance)} ETH`);

      console.log("\n📦 FINAL BUCKET STATISTICS:");
      console.log("Bucket 0:");
      console.log(`  💰 Total Staked: ${ethers.utils.formatEther(finalBucket0Stats.totalStaked)} ETH`);
      console.log(`  ⚖️ Total Weight: ${finalBucket0Stats.totalWeight}`);
      console.log(`  💵 Price: ${finalBucket0Stats.price}`);

      console.log("\nBucket 1:");
      console.log(`  💰 Total Staked: ${ethers.utils.formatEther(finalBucket1Stats.totalStaked)} ETH`);
      console.log(`  ⚖️ Total Weight: ${finalBucket1Stats.totalWeight}`);
      console.log(`  💵 Price: ${finalBucket1Stats.price}`);

      // ==============================================================
      // |                    Phase 9: Assertions                    |
      // ==============================================================
      console.log("\n✅ PHASE 9: VERIFYING RESULTS");
      console.log("=".repeat(50));

      // Verify Alice won (price 110 is within 100-120)
      expect(aliceBetFinal.won).to.be.true;
      console.log(`✅ Alice won (price ${bucket0Price} within range ${alicePriceMin}-${alicePriceMax})`);

      // Verify Bob lost (price 110 is outside 90-150, but wait... actually it's within!)
      // Let me check the actual logic - Bob's range is 90-150, price is 110, so Bob should win
      expect(bobBetFinal.won).to.be.true;
      console.log(`✅ Bob won (price ${bucket0Price} within range ${bobPriceMin}-${bobPriceMax})`);

      // Verify Charlie won (price 180 is within 80-200)
      expect(charlieBetFinal.won).to.be.true;
      console.log(`✅ Charlie won (price ${bucket1Price} within range ${charliePriceMin}-${charliePriceMax})`);

      // Verify all bets are finalized
      expect(aliceBetFinal.finalized).to.be.true;
      expect(bobBetFinal.finalized).to.be.true;
      expect(charlieBetFinal.finalized).to.be.true;
      console.log(`✅ All bets finalized`);

      // Verify timestamp prices are set
      const timestamp0Price = await predictionMarket.getPriceAtTimestamp(bucket0Time);
      const timestamp1Price = await predictionMarket.getPriceAtTimestamp(bucket1Time);
      expect(timestamp0Price).to.equal(bucket0Price);
      expect(timestamp1Price).to.equal(bucket1Price);
      console.log(`✅ Timestamp prices correctly set`);

      console.log("\n" + "🎉".repeat(20) + " INTEGRATION TEST PASSED " + "🎉".repeat(20));
    });
  });
}); 