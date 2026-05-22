const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestPredensityPredictionMarket", function () {
  let contract, owner, user1, user2;
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const FEE_BPS = 50;
  const BPS_DENOM = 10000;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const TestPredensityPredictionMarket = await ethers.getContractFactory(
      "TestPredensityPredictionMarket",
    );
    contract = await TestPredensityPredictionMarket.deploy();
    await contract.deployed();
  });

  describe("Constructor", function () {
    it("should set startTimestamp correctly", async function () {
      const startTimestamp = await contract.startTimestamp();
      expect(startTimestamp).to.be.gt(0);
    });

    it("should initialize nextBetId to 0", async function () {
      const nextBetId = await contract.nextBetId();
      expect(nextBetId).to.equal(0);
    });
  });

  describe("bucketIndex", function () {
    it("should calculate correct bucket for same day", async function () {
      const startTimestamp = await contract.startTimestamp();
      const bucket = await contract.bucketIndex(startTimestamp);
      expect(bucket).to.equal(0);
    });

    it("should calculate correct bucket for next day", async function () {
      const startTimestamp = await contract.startTimestamp();
      const nextDay = startTimestamp.add(SECONDS_PER_DAY);
      const bucket = await contract.bucketIndex(nextDay);
      expect(bucket).to.equal(1);
    });

    it("should calculate correct bucket for multiple days", async function () {
      const startTimestamp = await contract.startTimestamp();
      const threeDaysLater = startTimestamp.add(SECONDS_PER_DAY * 3);
      const bucket = await contract.bucketIndex(threeDaysLater);
      expect(bucket).to.equal(3);
    });

    it("should calculate correct bucket for partial day", async function () {
      const startTimestamp = await contract.startTimestamp();
      const halfDayLater = startTimestamp.add(SECONDS_PER_DAY / 2);
      const bucket = await contract.bucketIndex(halfDayLater);
      expect(bucket).to.equal(0);
    });

    it("should revert for timestamp before startTimestamp", async function () {
      const startTimestamp = await contract.startTimestamp();
      const beforeStart = startTimestamp.sub(1);

      await expect(contract.bucketIndex(beforeStart)).to.be.revertedWith(
        "must be >= start",
      );
    });
  });

  describe("placeBet", function () {
    const betAmount = ethers.utils.parseEther("1.0");
    const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
    const priceMin = 100;
    const priceMax = 200;

    it("should place bet successfully", async function () {
      const initialBalance = await user1.getBalance();

      const tx = await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "BetPlaced");

      expect(event).to.not.be.undefined;
      expect(event.args.betId).to.equal(0);
      expect(event.args.bettor).to.equal(user1.address);
      expect(event.args.stake).to.equal(
        betAmount.mul(10000 - FEE_BPS).div(10000),
      );
    });

    it("should increment nextBetId after placing bet", async function () {
      await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const nextBetId = await contract.nextBetId();
      expect(nextBetId).to.equal(1);
    });

    it("should store bet data correctly", async function () {
      await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const bet = await contract.bets(0);
      expect(bet.bettor).to.equal(user1.address);
      expect(bet.targetTimestamp).to.equal(futureTimestamp);
      expect(bet.priceMin).to.equal(priceMin);
      expect(bet.priceMax).to.equal(priceMax);
      expect(bet.stake).to.equal(betAmount.mul(10000 - FEE_BPS).div(10000));
      expect(bet.finalized).to.be.false;
      expect(bet.claimed).to.be.false;
    });

    it("should calculate and deduct fee correctly", async function () {
      const initialBalance = await user1.getBalance();

      await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const expectedFee = betAmount.mul(FEE_BPS).div(BPS_DENOM);
      const expectedStake = betAmount.sub(expectedFee);

      const bet = await contract.bets(0);
      expect(bet.stake).to.equal(expectedStake);
    });

    it("should update bucket totals correctly", async function () {
      const bucket = await contract.bucketIndex(futureTimestamp);

      await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const totalStaked = await contract.totalStakedInBucket(bucket);
      const totalWeight = await contract.totalWeightInBucket(bucket);

      const expectedStake = betAmount.mul(10000 - FEE_BPS).div(10000);
      expect(totalStaked).to.equal(expectedStake);
      expect(totalWeight).to.be.gt(0); // Quality is currently 1, so weight = stake
    });

    it("should emit FeeCollected event", async function () {
      const tx = await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      const receipt = await tx.wait();
      const feeEvent = receipt.events.find((e) => e.event === "FeeCollected");

      expect(feeEvent).to.not.be.undefined;
      const expectedFee = betAmount.mul(FEE_BPS).div(BPS_DENOM);
      expect(feeEvent.args.amount).to.equal(expectedFee);
    });

    it("should revert for past timestamp", async function () {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 86400; // 1 day ago

      await expect(
        contract
          .connect(user1)
          .placeBet(pastTimestamp, priceMin, priceMax, { value: betAmount }),
      ).to.be.revertedWith("must be future timestamp");
    });

    it("should revert for invalid price range", async function () {
      await expect(
        contract.connect(user1).placeBet(
          futureTimestamp,
          priceMax, // min > max
          priceMin,
          { value: betAmount },
        ),
      ).to.be.revertedWith("invalid price range");
    });

    it("should revert for zero stake", async function () {
      await expect(
        contract
          .connect(user1)
          .placeBet(futureTimestamp, priceMin, priceMax, { value: 0 }),
      ).to.be.revertedWith("stake must be > 0");
    });

    it("should handle multiple bets correctly", async function () {
      const futureTimestamp2 = futureTimestamp + SECONDS_PER_DAY;

      // Place first bet
      await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, { value: betAmount });

      // Place second bet
      await contract
        .connect(user2)
        .placeBet(futureTimestamp2, priceMin + 10, priceMax + 10, {
          value: betAmount.mul(2),
        });

      const nextBetId = await contract.nextBetId();
      expect(nextBetId).to.equal(2);

      const bet1 = await contract.bets(0);
      const bet2 = await contract.bets(1);

      expect(bet1.bettor).to.equal(user1.address);
      expect(bet2.bettor).to.equal(user2.address);
    });

    it("should handle bets in same bucket correctly", async function () {
      const startTimestamp = await contract.startTimestamp();
      const baseTarget = startTimestamp.add(SECONDS_PER_DAY * 2);
      const secondTarget = baseTarget.add(3600);
      const bucket = await contract.bucketIndex(baseTarget);

      // Place two bets in same bucket
      await contract
        .connect(user1)
        .placeBet(baseTarget, priceMin, priceMax, { value: betAmount });

      await contract.connect(user2).placeBet(
        secondTarget,
        priceMin + 10,
        priceMax + 10,
        { value: betAmount.mul(2) },
      );

      const totalStaked = await contract.totalStakedInBucket(bucket);
      const totalWeight = await contract.totalWeightInBucket(bucket);

      const expectedStake1 = betAmount.mul(10000 - FEE_BPS).div(10000);
      const expectedStake2 = betAmount
        .mul(2)
        .mul(10000 - FEE_BPS)
        .div(10000);
      const expectedTotalStake = expectedStake1.add(expectedStake2);
      const bet1 = await contract.bets(0);
      const bet2 = await contract.bets(1);
      const expectedTotalWeight = bet1.weight.add(bet2.weight);

      expect(totalStaked).to.equal(expectedTotalStake);
      expect(totalWeight).to.equal(expectedTotalWeight);
    });
  });

  describe("Integration Tests", function () {
    it("should handle complex betting scenario", async function () {
      const startTimestamp = await contract.startTimestamp();
      const day1 = startTimestamp.add(SECONDS_PER_DAY);
      const day2 = startTimestamp.add(SECONDS_PER_DAY * 2);
      const day3 = startTimestamp.add(SECONDS_PER_DAY * 3);

      // Multiple users placing bets on different days
      await contract
        .connect(user1)
        .placeBet(day1, 100, 150, { value: ethers.utils.parseEther("1.0") });

      await contract
        .connect(user2)
        .placeBet(day2, 120, 180, { value: ethers.utils.parseEther("2.0") });

      await contract
        .connect(user1)
        .placeBet(day3, 90, 140, { value: ethers.utils.parseEther("0.5") });

      // Check bucket totals
      const bucket1 = await contract.bucketIndex(day1);
      const bucket2 = await contract.bucketIndex(day2);
      const bucket3 = await contract.bucketIndex(day3);

      const totalStaked1 = await contract.totalStakedInBucket(bucket1);
      const totalStaked2 = await contract.totalStakedInBucket(bucket2);
      const totalStaked3 = await contract.totalStakedInBucket(bucket3);

      expect(totalStaked1).to.be.gt(0);
      expect(totalStaked2).to.be.gt(0);
      expect(totalStaked3).to.be.gt(0);
      expect(totalStaked2).to.be.gt(totalStaked1); // Higher stake in day2
    });

    it("should maintain correct bet IDs across multiple bets", async function () {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;

      // Place multiple bets
      for (let i = 0; i < 5; i++) {
        await contract
          .connect(user1)
          .placeBet(futureTimestamp + i * 3600, 100 + i * 10, 150 + i * 10, {
            value: ethers.utils.parseEther("0.1"),
          });
      }

      const nextBetId = await contract.nextBetId();
      expect(nextBetId).to.equal(5);

      // Verify all bets have correct IDs
      for (let i = 0; i < 5; i++) {
        const bet = await contract.bets(i);
        expect(bet.bettor).to.equal(user1.address);
        expect(bet.targetTimestamp).to.equal(futureTimestamp + i * 3600);
      }
    });
  });
});
