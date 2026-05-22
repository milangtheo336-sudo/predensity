const { expect } = require("chai");
const { ethers } = require("hardhat");

describe.skip("PredensityPredictionMarket", function () {
  let contract, owner;

  const HBAR = ethers.BigNumber.from("100000000"); // 1 HBAR = 100_000_000 tinybar (8 decimals)
  const DECIMALS = 18;
  const HBAR_18DECIMALS = ethers.BigNumber.from("10").pow(DECIMALS); // 1 HBAR = 10^18 wei

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const PredensityPredictionMarket = await ethers.getContractFactory(
      "PredensityPredictionMarket",
    );
    contract = await PredensityPredictionMarket.deploy();
    await contract.deployed();
  });

  it("should allow owner to withdraw HBAR and update balance", async function () {
    // Set up deposit amount
    const depositAmount = HBAR_18DECIMALS.mul(100); // 100 HBAR in tinybars (if HBAR = 1e8 tinybars)
    // Deposit
    await contract.connect(owner).deposit({ value: depositAmount });

    const balanceAfterDeposit = await contract.balances(owner.address);
    console.log("Balance after deposit:", balanceAfterDeposit.toString());

    await contract.connect(owner).withdraw(HBAR.mul(100));

    expect(balanceAfterWithdrawTinybar).to.equal(0);
  });
});
