// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CryptoPredictionMarket
 * @dev Prediction market for cryptocurrency price ranges with multi-asset support
 * @notice Users predict price ranges for crypto assets (HBAR, BTC, ETH, etc.)
 * 
 * Example predictions:
 * - "HBAR will be between $0.29-$0.31 on March 15"
 * - "BTC will be between $65,000-$68,000 on April 1"
 * - "ETH will be between $3,200-$3,500 on March 20"
 * 
 * Resolution: Centralized owner sets prices (scalable, fast, gas-efficient)
 */
contract CryptoPredictionMarket is Ownable {
    using SafeERC20 for IERC20;
    // ==============================================================
    // |                    Constants                               |
    // ==============================================================
    uint256 public immutable startTimestamp;
    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant FEE_BPS = 100;        // 1% entry fee in basis points
    uint256 public constant EXIT_FEE_BPS = 80;   // 0.8% exit fee in basis points
    uint256 public constant BPS_DENOM = 10000;   // denominator for basis points (100% = 10000)
    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant MAX_STAKE = 100 ether;
    uint256 public constant MAX_DAYS_AHEAD = 30;
    uint256 public constant MIN_DAYS_AHEAD = 1;     // Minimum days ahead for bet placement
    uint256 public constant BATCH_SIZE = 50;
    uint256 public constant MAX_EXIT_RATIO_BPS = 3000; // max 30% of bucket pool can exit early
    uint256 public constant MIN_K = 10 ether;          // minimum liquidity parameter (10 HBAR)
    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    uint256 public totalFeesCollected;
    uint256 public totalObligations;  // reserved for unclaimed winning payouts
    uint256 public nextBetId;
    uint256 public knownTokenBalance;  // Track actual token balance to prevent fake deposits
    
    // Asset identifier (e.g., "HBAR", "BTC", "ETH")
    string public assetSymbol;
    
    // Price decimals (e.g., 8 for BTC, 18 for ETH)
    uint8 public priceDecimals;

    // Staking token: address(0) = native HBAR mode, otherwise ERC-20 (e.g., USDC)
    IERC20 public stakingToken;
    
    // Mapping of betId to asset symbol (for multi-asset support)
    mapping(uint256 => string) public betAssets;

    // ==============================================================
    // |                    Structs                                 |
    // ==============================================================
    struct Bet {
        address bettor;
        uint256 targetTimestamp;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stake;
        uint256 qualityBps;
        uint256 weight;
        bool finalized;
        bool claimed;
        uint256 actualPrice;
        bool won;
        // DPM fields
        uint256 entryBandWeight;  // total weight in this bet's band when they entered
        bool exited;              // whether the bettor sold shares early
    }

    struct BetSimulation {
        uint256 fee;
        uint256 stakeNet;
        uint256 sharpnessBps;
        uint256 timeBps;
        uint256 qualityBps;
        uint256 weight;
        uint256 bucket;
        bool isValid;
        string errorMessage;
    }

    struct BucketInfo {
        uint256[] betIds;
        uint256 totalStaked;
        uint256 totalWeight;
        uint256 totalWinningWeight;
        uint256 nextProcessIndex;
        bool aggregationComplete;
        // DPM fields
        uint256 totalExited;  // total HBAR paid out via early exits
    }

    // DPM band cost tracking: bucket => bandIndex => total weight in that band
    // Band index is derived from price range midpoint quantized to bands
    mapping(uint256 => mapping(uint256 => uint256)) public bandWeights;

    // ==============================================================
    // |                    Mappings                               |
    // ==============================================================
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BucketInfo) public buckets;
    mapping(uint256 => uint256) public pricesAtTimestamp; // targetTimestamp => price

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 stake,
        uint256 priceMin,
        uint256 priceMax,
        uint256 targetTimestamp,
        string asset
    );
    
    event BetFinalized(
        uint256 indexed betId,
        uint256 actualPrice,
        bool won,
        uint256 payout
    );
    
    event BetClaimed(
        uint256 indexed betId,
        address indexed bettor,
        uint256 payout
    );
    
    event FeeCollected(uint256 amount);
    event BucketPriceSet(uint256 indexed bucket, uint256 price);
    event BatchProcessed(uint256 indexed bucket, uint256 processedCount, uint256 winningWeight);
    event AggregationCompleted(uint256 indexed bucket, uint256 totalWinningWeight);
    
    event AssetPriceResolved(
        string indexed asset,
        uint256 indexed timestamp,
        uint256 price
    );

    event SharesSold(
        uint256 indexed betId,
        address indexed bettor,
        uint256 exitPayout,
        uint256 exitFee
    );

    // ==============================================================
    // |                    Modifiers                               |
    // ==============================================================
    modifier validBetAmount(uint256 amount) {
        require(amount >= MIN_STAKE, "Bet too small");
        require(amount <= MAX_STAKE, "Bet too large");
        _;
    }

    modifier validTimeRange(uint256 targetTimestamp) {
        uint256 minTime = block.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY);
        uint256 maxTime = block.timestamp + (MAX_DAYS_AHEAD * SECONDS_PER_DAY);
        require(targetTimestamp >= minTime, "Target too soon");
        require(targetTimestamp <= maxTime, "Target too far");
        _;
    }

    // ==============================================================
    // |                    Constructor                             |
    // ==============================================================
    
    /**
     * @param _assetSymbol The primary asset symbol (e.g., "HBAR")
     * @param _priceDecimals Number of decimals for price representation
     * @param _stakingToken ERC-20 token for stakes (address(0) = native HBAR mode)
     */
    constructor(string memory _assetSymbol, uint8 _priceDecimals, address _stakingToken) {
        assetSymbol = _assetSymbol;
        priceDecimals = _priceDecimals;
        stakingToken = IERC20(_stakingToken);
        startTimestamp = block.timestamp;
        transferOwnership(msg.sender);
    }

    /**
     * @notice Returns true if the contract uses an ERC-20 token for stakes
     */
    function isTokenMode() public view returns (bool) {
        return address(stakingToken) != address(0);
    }

    // ==============================================================
    // |                    Core Functions                          |
    // ==============================================================

    /**
     * @notice Place a bet on crypto price range (primary asset)
     * @param targetTimestamp When the price will be checked
     * @param priceMin Minimum price in range (in wei or smallest unit)
     * @param priceMax Maximum price in range (in wei or smallest unit)
     * @return betId The ID of the placed bet
     */
    function placeBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax
    ) public payable validTimeRange(targetTimestamp) returns (uint256) {
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");

        // Calculate fee and net stake
        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = msg.value - fee;
        
        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute bet quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Create bet for primary asset
        return _createBet(msg.sender, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight, assetSymbol);
    }

    /**
     * @notice Place a bet with specific asset symbol (for multi-asset markets)
     * @param asset The asset symbol (e.g., "BTC", "ETH")
     * @param targetTimestamp When the price will be checked
     * @param priceMin Minimum price in range
     * @param priceMax Maximum price in range
     * @return betId The ID of the placed bet
     */
    function placeBetWithAsset(
        string memory asset,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax
    ) external payable validTimeRange(targetTimestamp) returns (uint256) {
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");

        return _placeBetInternal(msg.sender, targetTimestamp, priceMin, priceMax, msg.value, asset);
    }

    /**
     * @notice Place a bet using ERC-20 token (USDC mode). Caller must approve() first.
     * @param targetTimestamp When the price will be checked
     * @param priceMin Minimum price in range
     * @param priceMax Maximum price in range
     * @param amount Token amount to stake
     * @return betId The ID of the placed bet
     */
    function placeBetWithToken(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 amount
    ) external validTimeRange(targetTimestamp) returns (uint256) {
        require(address(stakingToken) != address(0), "Token mode not enabled");
        require(amount > 0, "Amount must be > 0");
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        return _placeBetInternal(msg.sender, targetTimestamp, priceMin, priceMax, amount, assetSymbol);
    }

    /**
     * @notice Place a bet with specific asset using ERC-20 token. Caller must approve() first.
     * @param asset The asset symbol (e.g., "BTC", "ETH")
     * @param targetTimestamp When the price will be checked
     * @param priceMin Minimum price in range
     * @param priceMax Maximum price in range
     * @param amount Token amount to stake
     * @return betId The ID of the placed bet
     */
    function placeBetWithAssetToken(
        string memory asset,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 amount
    ) external validTimeRange(targetTimestamp) returns (uint256) {
        require(address(stakingToken) != address(0), "Token mode not enabled");
        require(amount > 0, "Amount must be > 0");
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        return _placeBetInternal(msg.sender, targetTimestamp, priceMin, priceMax, amount, asset);
    }

    /**
     * @notice Place a bet with tokens that have already been transferred to this contract.
     * Used by proxy wallets that transfer tokens via HTS before calling this function.
     */
    function placeBetWithPreTransferredToken(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 amount
    ) external validTimeRange(targetTimestamp) returns (uint256) {
        require(address(stakingToken) != address(0), "Token mode not enabled");
        require(amount > 0, "Amount must be > 0");
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");
        require(bettor != address(0), "Invalid bettor address");

        // SECURITY FIX: Verify that tokens were actually transferred into this contract
        uint256 currentBalance = stakingToken.balanceOf(address(this));
        uint256 newlyReceived = currentBalance - knownTokenBalance;
        require(newlyReceived >= amount, "Tokens were not transferred");
        
        // Update the known balance for the next transaction
        knownTokenBalance = currentBalance;

        return _placeBetInternal(bettor, targetTimestamp, priceMin, priceMax, amount, assetSymbol);
    }

    /**
     * @notice Internal function to place bet (reduces stack depth)
     */
    function _placeBetInternal(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount,
        string memory asset
    ) private returns (uint256) {
        // Calculate fee and net stake
        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;
        
        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute bet quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Create bet with specified asset
        return _createBet(bettor, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight, asset);
    }

    /**
     * @notice Process next batch of bets for a bucket (anyone can call)
     * @param bucket The bucket index to process
     * @return processedCount Number of bets processed in this batch
     * @return winningWeight Total winning weight added in this batch
     */
    function processBatch(uint256 bucket) external returns (uint256 processedCount, uint256 winningWeight) {
        BucketInfo storage bucketInfo = buckets[bucket];
        require(!bucketInfo.aggregationComplete, "Aggregation already complete");
        
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        
        if (endIndex > bucketInfo.betIds.length) {
            endIndex = bucketInfo.betIds.length;
        }
        
        if (startIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            totalObligations += bucketInfo.totalStaked - bucketInfo.totalExited;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
            return (0, 0);
        }
        
        uint256 batchWinningWeight = 0;
        uint256 processed = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            
            if (!bet.finalized && !bet.exited) {
                uint256 price = pricesAtTimestamp[bet.targetTimestamp];
                require(price > 0, "Price not set for timestamp");
                
                bet.finalized = true;
                bet.actualPrice = price;
                bet.won = (price >= bet.priceMin && price <= bet.priceMax);
                
                if (bet.won) {
                    batchWinningWeight += bet.weight;
                }
                
                processed++;
            }
        }
        
        bucketInfo.totalWinningWeight += batchWinningWeight;
        bucketInfo.nextProcessIndex = endIndex;
        
        if (endIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            totalObligations += bucketInfo.totalStaked - bucketInfo.totalExited;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
        }
        
        emit BatchProcessed(bucket, processed, batchWinningWeight);
        return (processed, batchWinningWeight);
    }

    /**
     * @notice Claim winnings for a finalized bet (only after aggregation complete)
     * @param betId The ID of the bet to claim
     */
    function claimBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.finalized, "Bet not finalized");
        require(!bet.claimed, "Already claimed");
        require(!bet.exited, "Already exited via DPM");

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];
        require(bucketInfo.aggregationComplete, "Aggregation not complete");

        bet.claimed = true;

        if (bet.won) {
            // DPM-adjusted payout: use remaining pool after early exits
            uint256 remainingPool = bucketInfo.totalStaked - bucketInfo.totalExited;
            uint256 payout = bucketInfo.totalWinningWeight > 0 ? 
                (bet.weight * remainingPool) / bucketInfo.totalWinningWeight : 0;
            
            // Reduce obligations as payout is fulfilled
            if (payout <= totalObligations) {
                totalObligations -= payout;
            } else {
                totalObligations = 0;
            }

            _transferOut(msg.sender, payout);
            
            emit BetClaimed(betId, msg.sender, payout);
        } else {
            emit BetClaimed(betId, msg.sender, 0);
        }
    }

    // ==============================================================
    // |          SCALABLE RESOLUTION (Owner Only - Centralized)    |
    // ==============================================================

    /**
     * @notice Set prices for multiple timestamps at once (owner only - centralized but scalable)
     * @param timestamps Array of target timestamps
     * @param prices Array of corresponding prices
     */
    function setPricesForTimestamps(uint256[] calldata timestamps, uint256[] calldata prices) external onlyOwner {
        require(timestamps.length == prices.length, "Lengths must match");
        for (uint256 i = 0; i < timestamps.length; i++) {
            require(prices[i] > 0, "Price must be positive");
            pricesAtTimestamp[timestamps[i]] = prices[i];
            emit BucketPriceSet(timestamps[i], prices[i]);
            emit AssetPriceResolved(assetSymbol, timestamps[i], prices[i]);
        }
    }

    /**
     * @notice Set price for a single timestamp (owner only - centralized but scalable)
     * @param timestamp The target timestamp
     * @param price The actual price
     */
    function setPriceForTimestamp(uint256 timestamp, uint256 price) external onlyOwner {
        require(price > 0, "Price must be positive");
        pricesAtTimestamp[timestamp] = price;
        emit BucketPriceSet(timestamp, price);
        emit AssetPriceResolved(assetSymbol, timestamp, price);
    }

    /**
     * @notice Set prices for multiple assets and timestamps (owner only - multi-asset batch)
     * @param assets Array of asset symbols
     * @param timestamps Array of target timestamps
     * @param prices Array of corresponding prices
     */
    function setAssetPrices(
        string[] calldata assets,
        uint256[] calldata timestamps,
        uint256[] calldata prices
    ) external onlyOwner {
        require(
            assets.length == timestamps.length && timestamps.length == prices.length,
            "Lengths must match"
        );
        
        for (uint256 i = 0; i < timestamps.length; i++) {
            require(prices[i] > 0, "Price must be positive");
            pricesAtTimestamp[timestamps[i]] = prices[i];
            emit BucketPriceSet(timestamps[i], prices[i]);
            emit AssetPriceResolved(assets[i], timestamps[i], prices[i]);
        }
    }

    // ==============================================================
    // |                    Admin Functions                         |
    // ==============================================================

    /**
     * @notice Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 bal = _contractBalance();
        uint256 available = bal > totalObligations ? bal - totalObligations : 0;
        uint256 amount = totalFeesCollected < available ? totalFeesCollected : available;
        require(amount > 0, "No withdrawable fees");
        totalFeesCollected -= amount;
        _transferOut(owner(), amount);
    }

    /**
     * @notice Emergency withdraw surplus only -- cannot touch funds owed to winners
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 bal = _contractBalance();
        uint256 surplus = bal > totalObligations ? bal - totalObligations : 0;
        require(surplus > 0, "No surplus to withdraw");
        totalFeesCollected = 0;
        _transferOut(owner(), surplus);
    }

    /**
     * @notice Associate with a Hedera token (required before receiving HTS tokens like USDC).
     * On Hedera, contracts must explicitly associate with tokens.
     * 
     * Hedera Token Service (HTS) system contract: 0x0000000000000000000000000000000000000167
     */
    function associateToken(address token) external onlyOwner {
        (bool success, ) = address(0x0000000000000000000000000000000000000167).call(
            abi.encodeWithSelector(0x49146bde, address(this), token)
        );
        require(success, "Token association failed");
    }

    // ==============================================================
    // |                    Helper Functions                        |
    // ==============================================================

    /**
     * @notice Transfer funds out -- native HBAR or ERC-20 depending on mode
     */
    function _transferOut(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (address(stakingToken) != address(0)) {
            stakingToken.safeTransfer(to, amount);
            // Keep knownTokenBalance in sync
            knownTokenBalance = stakingToken.balanceOf(address(this));
        } else {
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "Transfer failed");
        }
    }

    /**
     * @notice Get contract balance -- native HBAR or ERC-20 depending on mode
     */
    function _contractBalance() internal view returns (uint256) {
        if (address(stakingToken) != address(0)) {
            return stakingToken.balanceOf(address(this));
        }
        return address(this).balance;
    }

    /**
     * @notice Create a bet and emit event (with asset tracking)
     */
    function _createBet(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeNet,
        uint256 qualityBps,
        uint256 weight,
        string memory asset
    ) private returns (uint256) {
        uint256 betId = nextBetId++;
        uint256 bucket = bucketIndex(targetTimestamp);

        // Record entry band weight BEFORE adding this bet's weight
        {
            uint256 band = bandIndex(priceMin, priceMax);
            bets[betId].entryBandWeight = bandWeights[bucket][band];
            bandWeights[bucket][band] += weight;
        }

        bets[betId].bettor = bettor;
        bets[betId].targetTimestamp = targetTimestamp;
        bets[betId].priceMin = priceMin;
        bets[betId].priceMax = priceMax;
        bets[betId].stake = stakeNet;
        bets[betId].qualityBps = qualityBps;
        bets[betId].weight = weight;

        // Store asset for this bet (multi-asset support)
        betAssets[betId] = asset;

        // Update bucket tracking
        buckets[bucket].betIds.push(betId);
        buckets[bucket].totalStaked += stakeNet;
        buckets[bucket].totalWeight += weight;

        emit BetPlaced(betId, bettor, stakeNet, priceMin, priceMax, targetTimestamp, asset);
        return betId;
    }

    /**
     * @notice Map timestamp to bucket index
     */
    function bucketIndex(uint256 targetTs) public view returns (uint256) {
        require(targetTs >= startTimestamp, "Must be >= start");
        return (targetTs - startTimestamp) / SECONDS_PER_DAY;
    }

    /**
     * @notice Quantize a price range into a band index for DPM tracking.
     *         Uses the midpoint of [priceMin, priceMax] divided into 2% bands
     *         relative to the midpoint magnitude. This groups similar predictions
     *         so the cost function applies per-band.
     * @param priceMin Lower bound of the prediction range
     * @param priceMax Upper bound of the prediction range
     * @return The band index (deterministic for a given midpoint)
     */
    function bandIndex(uint256 priceMin, uint256 priceMax) public pure returns (uint256) {
        uint256 midpoint = (priceMin + priceMax) / 2;
        // Band width = 2% of midpoint (200 BPS). Minimum band width of 1 to avoid division by zero.
        uint256 bandWidth = (midpoint * 200) / BPS_DENOM;
        if (bandWidth == 0) bandWidth = 1;
        return midpoint / bandWidth;
    }

    /**
     * @notice Adaptive liquidity parameter for the DPM cost function.
     *         k scales with 20% of the bucket's total staked amount,
     *         with a floor of MIN_K (10 HBAR) to prevent degenerate pricing
     *         on small or empty pools.
     * @param bucket The bucket index
     * @return k The liquidity parameter in tinybars
     */
    function getK(uint256 bucket) public view returns (uint256) {
        uint256 poolSize = buckets[bucket].totalStaked;
        // k = 20% of pool size
        uint256 k = (poolSize * 2000) / BPS_DENOM;
        return k > MIN_K ? k : MIN_K;
    }

    /**
     * @notice Compute the exit value for a bet using the linear surplus approximation.
     *         This is a safe underapproximation of the true log cost function difference
     *         C(q_b) - C(q_b - w), ensuring the pool always stays solvent.
     *
     *         Formula: exitValue = (surplus * yourShare) / BPS_DENOM
     *         where surplus = currentBandWeight - entryBandWeight (weight added after you)
     *         and yourShare = (yourWeight / entryBandWeight) in BPS
     *
     *         Capped at the bet's original stake to prevent unbounded exits.
     *
     * @param betId The bet to compute exit value for
     * @return rawExit The exit value before fees (0 if no surplus)
     */
    function getExitValue(uint256 betId) public view returns (uint256 rawExit) {
        Bet storage bet = bets[betId];
        if (bet.finalized || bet.exited || bet.entryBandWeight == 0) return 0;

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        uint256 band = bandIndex(bet.priceMin, bet.priceMax);
        uint256 currentBandWeight = bandWeights[bucket][band];

        // Surplus = weight added to this band after this bet entered
        if (currentBandWeight <= bet.entryBandWeight) return 0;
        uint256 surplus = currentBandWeight - bet.entryBandWeight;

        // Your proportional share of the surplus
        uint256 yourShare = (bet.weight * BPS_DENOM) / bet.entryBandWeight;
        rawExit = (surplus * yourShare) / BPS_DENOM;

        // Cap at original stake (max 1x profit on early exit)
        if (rawExit > bet.stake) rawExit = bet.stake;
    }

    /**
     * @notice Sell shares back to the pool before market resolution (DPM early exit).
     *         The bettor receives the exit value minus the 0.8% exit fee.
     *         Subject to the 30% pool cap to maintain solvency for final resolution.
     *
     *         Requirements:
     *         - Caller must be the bet owner
     *         - Bet must not be finalized or already exited
     *         - Exit value must be positive (surplus must exist in the band)
     *         - Bucket exit cap must not be exceeded
     *
     * @param betId The ID of the bet to exit
     */
    function sellShares(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(!bet.finalized, "Already resolved");
        require(!bet.exited, "Already exited");

        uint256 rawExit = getExitValue(betId);
        require(rawExit > 0, "No exit value available");

        // Apply 0.8% exit fee
        uint256 exitFee = (rawExit * EXIT_FEE_BPS) / BPS_DENOM;
        uint256 netExit = rawExit - exitFee;

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];

        // Solvency guard: max 30% of bucket pool can exit early
        require(
            bucketInfo.totalExited + netExit <= (bucketInfo.totalStaked * MAX_EXIT_RATIO_BPS) / BPS_DENOM,
            "Exit pool exhausted"
        );

        // Mark bet as exited
        bet.exited = true;

        // Update bucket accounting
        bucketInfo.totalExited += netExit;
        bucketInfo.totalWeight -= bet.weight;

        // Update band weight
        uint256 band = bandIndex(bet.priceMin, bet.priceMax);
        bandWeights[bucket][band] -= bet.weight;

        // Exit fee goes to protocol
        totalFeesCollected += exitFee;

        // Transfer exit payout
        _transferOut(msg.sender, netExit);

        emit SharesSold(betId, msg.sender, netExit, exitFee);
    }

    /**
     * @notice Compute sharpness multiplier based on price range width
     */
    function getSharpnessMultiplier(
        uint256 priceMin,
        uint256 priceMax
    ) public pure returns (uint256) {
        uint256 range = priceMax - priceMin;
        uint256 averagePrice = (priceMin + priceMax) / 2;
        uint256 widthBps = averagePrice > 0 ? (range * BPS_DENOM) / averagePrice : 0;

        if (widthBps > 4000) {
            return 1000;  // 0.1x
        } else if (widthBps >= 2000) {
            return 3000;  // 0.3x
        } else if (widthBps >= 1000) {
            return 5000;  // 0.5x
        } else if (widthBps >= 500) {
            return 10000; // 1x
        } else if (widthBps >= 200) {
            return 15000; // 1.5x
        } else {
            return 20000; // 2x for very sharp (<2%)
        }
    }

    /**
     * @notice Compute time multiplier based on lead time
     */
    function getTimeMultiplier(
        uint256 targetTimestamp
    ) public view returns (uint256) {
        uint256 delta = targetTimestamp - block.timestamp;

        if (delta >= 4 * SECONDS_PER_DAY) {
            return 20000; // >4 days -> 2x
        } else if (delta >= 2 * SECONDS_PER_DAY) {
            return 15000; // 2-4 days -> 1.5x
        } else if (delta >= 1 * SECONDS_PER_DAY) {
            return 10000; // 1-2 days -> 1x
        } else if (delta >= 8 * 60 * 60) {
            return 5000;  // 8-24 h -> 0.5x
        } else if (delta >= 2 * 60 * 60) {
            return 3000;  // 2-4 h -> 0.3x
        } else if (delta >= 1 * 60 * 60) {
            return 1000;  // 1-2 h -> 0.1x
        } else {
            return 1000;  // < 1 h -> 0.1x
        }
    }

    // ==============================================================
    // |                    View Functions                          |
    // ==============================================================

    /**
     * @notice Get the asset symbol for a bet
     */
    function getBetAsset(uint256 betId) external view returns (string memory) {
        string memory asset = betAssets[betId];
        return bytes(asset).length > 0 ? asset : assetSymbol;
    }

    /**
     * @notice Get current price decimals
     */
    function getPriceDecimals() external view returns (uint8) {
        return priceDecimals;
    }

    /**
     * @notice Get primary asset symbol
     */
    function getAssetSymbol() external view returns (string memory) {
        return assetSymbol;
    }

    /**
     * @notice Convert price to human-readable format
     * @param price Price in smallest unit
     * @return Human-readable price string
     */
    function formatPrice(uint256 price) external view returns (string memory) {
        // Simple formatting - divide by 10^decimals
        uint256 divisor = 10 ** priceDecimals;
        uint256 wholePart = price / divisor;
        uint256 fractionalPart = price % divisor;
        
        // Return as concatenated string (simplified)
        return string(abi.encodePacked(
            _uint2str(wholePart),
            ".",
            _uint2str(fractionalPart)
        ));
    }

    /**
     * @notice Get bet details
     */
    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    /**
     * @notice Simulate a bet placement
     */
    function simulatePlaceBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external view returns (BetSimulation memory) {
        // Validate inputs
        if (targetTimestamp <= block.timestamp) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Must be future timestamp"
            });
        }
        
        if (priceMin >= priceMax) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid price range"
            });
        }
        
        if (stakeAmount < MIN_STAKE || stakeAmount > MAX_STAKE) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid stake amount"
            });
        }

        // Calculate fee and net stake
        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;

        // Calculate multipliers
        uint256 sharpnessBps = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeBps = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;

        // Calculate weight
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Calculate bucket
        uint256 bucket = bucketIndex(targetTimestamp);

        return BetSimulation({
            fee: fee,
            stakeNet: stakeNet,
            sharpnessBps: sharpnessBps,
            timeBps: timeBps,
            qualityBps: qualityBps,
            weight: weight,
            bucket: bucket,
            isValid: true,
            errorMessage: ""
        });
    }

    /**
     * @notice Get bucket statistics
     */
    function getBucketStats(uint256 bucket) external view returns (uint256 totalStaked, uint256 totalWeight, uint256 price) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (bucketInfo.totalStaked, bucketInfo.totalWeight, pricesAtTimestamp[bucket]);
    }

    /**
     * @notice Get bucket aggregation status
     */
    function getBucketInfo(uint256 bucket) external view returns (
        uint256 totalBets,
        uint256 totalWinningWeight,
        uint256 nextProcessIndex,
        bool aggregationComplete
    ) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (
            bucketInfo.betIds.length,
            bucketInfo.totalWinningWeight,
            bucketInfo.nextProcessIndex,
            bucketInfo.aggregationComplete
        );
    }

    /**
     * @notice Get DPM exit info for a specific bet.
     *         Returns the current exit value, fee, net payout, and whether exit is possible.
     * @param betId The bet to query
     * @return rawExitValue Exit value before fee
     * @return exitFee The 0.8% fee that would be deducted
     * @return netExitPayout What the bettor would actually receive
     * @return canExit Whether the bet is eligible for early exit
     * @return exitPoolRemaining How much of the 30% exit cap is still available in this bucket
     */
    function getDPMInfo(uint256 betId) external view returns (
        uint256 rawExitValue,
        uint256 exitFee,
        uint256 netExitPayout,
        bool canExit,
        uint256 exitPoolRemaining
    ) {
        Bet storage bet = bets[betId];
        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];

        rawExitValue = getExitValue(betId);
        exitFee = (rawExitValue * EXIT_FEE_BPS) / BPS_DENOM;
        netExitPayout = rawExitValue - exitFee;

        uint256 exitCap = (bucketInfo.totalStaked * MAX_EXIT_RATIO_BPS) / BPS_DENOM;
        uint256 alreadyExited = bucketInfo.totalExited;
        exitPoolRemaining = exitCap > alreadyExited ? exitCap - alreadyExited : 0;

        canExit = !bet.finalized 
            && !bet.exited 
            && rawExitValue > 0 
            && netExitPayout <= exitPoolRemaining;
    }

    /**
     * @notice Get batch processing info for a bucket
     */
    function getBatchInfo(uint256 bucket) external view returns (
        uint256 nextBatchStart,
        uint256 nextBatchEnd,
        uint256 remainingBets,
        bool canProcess
    ) {
        BucketInfo storage bucketInfo = buckets[bucket];
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        
        if (endIndex > bucketInfo.betIds.length) {
            endIndex = bucketInfo.betIds.length;
        }
        
        uint256 remaining = bucketInfo.betIds.length - startIndex;
        bool canProcessBatch = !bucketInfo.aggregationComplete && remaining > 0;
        
        return (startIndex, endIndex, remaining, canProcessBatch);
    }

    /**
     * @notice Check if all timestamps in a bucket have prices set
     */
    function arePricesSetForBucket(uint256 bucket) external view returns (bool) {
        BucketInfo storage bucketInfo = buckets[bucket];
        for (uint256 i = 0; i < bucketInfo.betIds.length; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            if (pricesAtTimestamp[bet.targetTimestamp] == 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * @notice Get price for a specific timestamp
     */
    function getPriceAtTimestamp(uint256 timestamp) external view returns (uint256) {
        return pricesAtTimestamp[timestamp];
    }

    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 totalBets,
        uint256 totalFees,
        uint256 contractBalance
    ) {
        return (nextBetId, totalFeesCollected, _contractBalance());
    }

    /**
     * @notice Helper function to convert uint to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
