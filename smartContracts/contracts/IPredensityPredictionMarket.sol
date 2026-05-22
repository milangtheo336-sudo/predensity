// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IPredensityPredictionMarket
 * @dev Interface for the Predensity Prediction Market contract
 * 
 * This contract implements a sophisticated prediction market with:
 * - Quality-based scoring system (sharpness + lead time)
 * - Daily pools for reward distribution
 * - Role-based access control for admin functions
 * - Comprehensive UX features and leaderboard tracking
 * - Security features including reentrancy protection and pausability
 */
interface IPredensityPredictionMarket {
    // ============ CUSTOM ERRORS ============
    
    // Betting errors
    error BetAmountTooLow(uint256 sent, uint256 required);
    error TargetTimeInPast(uint256 target, uint256 current);
    error TargetTimeTooFar(uint256 target, uint256 maxAllowed);
    error InvalidPriceRange(uint256 min, uint256 max);
    error PriceMustBePositive(uint256 price);
    error PriceRangeTooWide(uint256 range, uint256 maxRange);
    
    // Resolution errors
    error CannotResolveFutureTimestamp(uint256 target, uint256 current);
    error AlreadyResolved(uint256 timestamp);
    error ResolvedPriceMustBePositive(uint256 price);
    
    // Claim errors
    error InvalidBetId(uint256 betId, uint256 maxBetId);
    error OnlyBetOwnerCanClaim(address caller, address owner);
    error BetNotSettled(uint256 betId);
    error PayoutAlreadyClaimed(uint256 betId);
    error BetDidNotWin(uint256 betId);
    error NoPoolAvailable(uint256 dailyKey);
    error NoQualityPoolAvailable(uint256 dailyKey);
    
    // Fee errors
    error NoFeesToWithdraw();
    error FailedToSendFees();
    
    // General errors
    error InsufficientBalance(address user, uint256 requested, uint256 available);
    error FailedToSendEther();
    error FailedToSendPayout();
    
    // ============ STRUCTS ============
    
    struct Bet {
        address user;
        uint256 targetTimestamp;
        uint256 priceMin;
        uint256 priceMax;
        uint256 amount; // Amount after fee
        uint256 fee;    // Protocol fee
        bool settled;
        // Phase 4: Scoring & Rewards
        uint256 quality;        // Calculated quality score
        uint256 sharpness;      // Sharpness multiplier
        uint256 leadTime;       // Lead time multiplier
        bool claimed;           // Whether payout has been claimed
    }

    struct LeaderboardEntry {
        address user;
        uint256 totalPayout;
        uint256 totalBets;
        uint256 winningBets;
    }

    // ============ EVENTS ============
    
    event BetPlaced(
        uint256 indexed betId,
        address indexed user,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 amount,
        uint256 fee
    );

    event BetResolved(
        uint256 indexed betId,
        address indexed user,
        uint256 targetTimestamp,
        uint256 resolvedPrice,
        bool won,
        uint256 payout
    );

    event PayoutClaimed(
        uint256 indexed betId,
        address indexed user,
        uint256 targetTimestamp,
        uint256 quality,
        uint256 payout,
        uint256 dailyPool
    );

    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Place a bet with specified parameters
     * @param targetTimestamp The target timestamp for the prediction
     * @param priceMin The minimum price in the range
     * @param priceMax The maximum price in the range
     */
    function placeBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax
    ) external payable;

    /**
     * @dev Admin function to resolve bets for a specific targetTimestamp
     * @param targetTimestamp The timestamp for which to resolve bets
     * @param resolvedPrice The final price at the target timestamp
     */
    function resolveBets(uint256 targetTimestamp, uint256 resolvedPrice) external;

    /**
     * @dev Function for winners to claim their payouts
     * @param betId The ID of the bet to claim payout for
     */
    function claimPayout(uint256 betId) external;

    // ============ USER FUNCTIONS ============
    
    /**
     * @dev Deposit Ether into the contract
     */
    function deposit() external payable;

    /**
     * @dev Withdraw Ether from the contract
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external;

    /**
     * @dev Transfer Ether to another address
     * @param _to The recipient address
     * @param _amount The amount to transfer
     */
    function transfer(address payable _to, uint256 _amount) external;

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get all bets for a user
     * @param user The address of the user
     * @return Array of bet IDs for the user
     */
    function getUserBets(address user) external view returns (uint256[] memory);

    /**
     * @dev Get bet details for UI display
     * @param betId The ID of the bet
     * @return user The address of the bet user
     * @return targetTimestamp The target timestamp for the bet
     * @return priceMin The minimum price in the range
     * @return priceMax The maximum price in the range
     * @return amount The bet amount after fees
     * @return settled Whether the bet has been settled
     * @return claimed Whether the payout has been claimed
     * @return quality The quality score of the bet
     */
    function getBetDetails(uint256 betId) external view returns (
        address user,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 amount,
        bool settled,
        bool claimed,
        uint256 quality
    );

    /**
     * @dev Get open bets for a user (not settled)
     * @param user The address of the user
     * @return Array of bet IDs that are not yet settled
     */
    function getOpenBets(address user) external view returns (uint256[] memory);

    /**
     * @dev Get closed bets for a user (settled)
     * @param user The address of the user
     * @return Array of bet IDs that are settled
     */
    function getClosedBets(address user) external view returns (uint256[] memory);

    /**
     * @dev Get leaderboard entry for a user
     * @param user The address of the user
     * @return totalPayout The total payout amount for the user
     * @return totalBets The total number of bets placed by the user
     * @return winningBets The number of winning bets for the user
     */
    function getLeaderboardEntry(address user) external view returns (
        uint256 totalPayout,
        uint256 totalBets,
        uint256 winningBets
    );

    /**
     * @dev Function to check if an address has ADMIN_ROLE
     * @param admin The address to check
     * @return True if the address has ADMIN_ROLE
     */
    function isAdmin(address admin) external view returns (bool);

    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Owner function to withdraw accumulated protocol fees
     */
    function withdrawFees() external;

    /**
     * @dev Owner function to grant ADMIN_ROLE to an address
     * @param admin The address to grant admin role to
     */
    function grantAdminRole(address admin) external;

    /**
     * @dev Owner function to revoke ADMIN_ROLE from an address
     * @param admin The address to revoke admin role from
     */
    function revokeAdminRole(address admin) external;

    /**
     * @dev Pause the contract for safety
     */
    function pause() external;

    /**
     * @dev Unpause the contract
     */
    function unpause() external;
} 