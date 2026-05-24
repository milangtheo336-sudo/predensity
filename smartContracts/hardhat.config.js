require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
const path = require("path");

// Load .env.local first (for local secrets), then fallback .env
require("dotenv").config({ path: path.resolve(__dirname, ".env.local") });
require("dotenv").config();

// Define Hardhat tasks here, which can be accessed in our test file (test/rpc.js) by using hre.run('taskName')
task("show-balance", async () => {
  const showBalance = require("./scripts/showBalance");
  return showBalance();
});

task("deploy-contract", async () => {
  const deployContract = require("./scripts/deployContract");
  return deployContract();
});

task("deploy-test-predensity", async () => {
  const deployTestPredensityPredictionMarket = require("./scripts/deployTestPredensityPredictionMarket");
  return deployTestPredensityPredictionMarket();
});

task("deploy-predensity", async () => {
  const deployPredensityPredictionMarket = require("./scripts/deployPredensityPredictionMarket");
  return deployPredensityPredictionMarket();
});

task("interact-test-predensity", "Interact with deployed TestPredensityPredictionMarket contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const interactWithTestPredensity = require("./scripts/interactWithTestPredensity");
    return interactWithTestPredensity(taskArgs.contractAddress);
  });

task("contract-view-call", "Make a view call to a deployed contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const contractViewCall = require("./scripts/contractViewCall");
    return contractViewCall(taskArgs.contractAddress);
  });

task("contract-call", "Make a call to a deployed contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("msg", "The message to set in the contract")
  .setAction(async (taskArgs) => {
    const contractCall = require("./scripts/contractCall");
    return contractCall(taskArgs.contractAddress, taskArgs.msg);
  });

task("place-bet", "Place a bet using placeBetWithoutValue")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("targetTimestamp", "Target timestamp for the prediction")
  .addParam("priceMin", "Minimum price in BPS")
  .addParam("priceMax", "Maximum price in BPS")
  .addParam("stakeAmount", "Stake amount in wei")
  .setAction(async (taskArgs) => {
    const placeBetWithoutValue = require("./scripts/placeBetWithoutValue");
    return placeBetWithoutValue(
      taskArgs.contractAddress,
      taskArgs.targetTimestamp,
      taskArgs.priceMin,
      taskArgs.priceMax,
      taskArgs.stakeAmount,
    );
  });

task("test-place-bet", "Test placeBet with default parameters")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const testPlaceBet = require("./scripts/testPlaceBet");
    return testPlaceBet(taskArgs.contractAddress);
  });

task("set-bucket-price", "Set price for a bucket (owner only)")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("bucket", "The bucket index")
  .addParam("price", "The price to set")
  .setAction(async (taskArgs) => {
    const setBucketPrice = require("./scripts/setBucketPrice");
    return setBucketPrice(taskArgs.contractAddress, taskArgs.bucket, taskArgs.price);
  });

task("finalize-bet", "Finalize a bet with actual price (owner only)")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("betId", "The ID of the bet to finalize")
  .addParam("actualPrice", "The actual price at target timestamp")
  .setAction(async (taskArgs) => {
    const finalizeBet = require("./scripts/finalizeBet");
    return finalizeBet(taskArgs.contractAddress, taskArgs.betId, taskArgs.actualPrice);
  });

task("claim-bet", "Claim winnings for a finalized bet")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("betId", "The ID of the bet to claim")
  .setAction(async (taskArgs) => {
    const claimBet = require("./scripts/claimBet");
    return claimBet(taskArgs.contractAddress, taskArgs.betId);
  });

task("place-10-bets", "Place 10 bets with delays")
  .setAction(async () => {
    const place10BetsWithDelay = require("./scripts/place10BetsWithDelay");
    return place10BetsWithDelay();
  });

task("test-mainnet-flow", "Test full flow on mainnet")
  .setAction(async () => {
    const testMainnetFlow = require("./scripts/testMainnetFlow");
    return testMainnetFlow();
  });

task("transfer-ownership", "Transfer contract ownership to a new address")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("newOwner", "The address to transfer ownership to")
  .setAction(async (taskArgs) => {
    const transferOwnership = require("./scripts/transferOwnership");
    return transferOwnership(taskArgs.contractAddress, taskArgs.newOwner);
  });

const networks = {};

if (process.env.LOCAL_NODE_ENDPOINT && process.env.LOCAL_NODE_OPERATOR_PRIVATE_KEY) {
  networks.local = {
    url: process.env.LOCAL_NODE_ENDPOINT,
    accounts: [process.env.LOCAL_NODE_OPERATOR_PRIVATE_KEY],
  };
}

if (process.env.TESTNET_ENDPOINT && process.env.TESTNET_OPERATOR_PRIVATE_KEY) {
  networks.testnet = {
    url: process.env.TESTNET_ENDPOINT,
    accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
    gasPrice: 2500000000000,
    gas: 15000000,
    timeout: 180000,
  };
}

if (process.env.MAINNET_ENDPOINT && process.env.MAINNET_OPERATOR_PRIVATE_KEY) {
  networks.mainnet = {
    url: process.env.MAINNET_ENDPOINT,
    accounts: [process.env.MAINNET_OPERATOR_PRIVATE_KEY],
    gasPrice: 2500000000000,
    gas: 15000000,
    timeout: 180000,
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: {
    timeout: 3600000,
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
      viaIR: true,
    },
  },
  defaultNetwork: "hardhat",
  networks,
};
