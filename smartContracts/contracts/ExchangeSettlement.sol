// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title ExchangeSettlement
 * @notice Settles matched trades from the off-chain Convex order book.
 *         Supports two modes:
 *         1. Operator mode: operator submits matched trades (for managed wallet users)
 *         2. Signature mode: EIP-712 signed intents verified on-chain (for wallet users)
 *
 *         Uses HTS pre-compiles for atomic token swaps on Hedera.
 */

// ERC-20 interface
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// HTS pre-compile for token transfers
interface IHederaTokenService {
    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int64 responseCode);
}

contract ExchangeSettlement is Ownable, ReentrancyGuard, Pausable, EIP712 {
    using ECDSA for bytes32;

    address constant HTS_PRECOMPILE = address(0x167);

    // USDC token address
    address public immutable usdcToken;

    // Authorized operator (can submit trades without signatures)
    address public operator;

    // Nonce tracking for signed orders (prevents replay)
    mapping(address => uint256) public nonces;

    // Trade tracking (prevents double-settlement)
    mapping(bytes32 => bool) public settledTrades;

    // Protocol fee in basis points
    uint256 public feeBps = 50; // 0.5%
    uint256 constant BPS_DENOM = 10000;
    uint256 public totalFees;

    // EIP-712 type hash for signed orders
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address trader,address outcomeToken,bool isBuy,uint256 price,uint256 quantity,uint256 nonce,uint256 expiry)"
    );

    struct Order {
        address trader;         // The user's address (managed wallet EVM address or connected wallet)
        address outcomeToken;   // HTS outcome token address
        bool isBuy;             // true = buying outcome tokens, false = selling
        uint256 price;          // Price per token in USDC micro-units (6 decimals)
        uint256 quantity;       // Number of outcome tokens
        uint256 nonce;          // Replay protection
        uint256 expiry;         // Unix timestamp when order expires
    }

    // Events
    event TradeSettled(
        bytes32 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        address outcomeToken,
        uint256 price,
        uint256 quantity,
        uint256 usdcAmount
    );
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdcToken, address _operator) EIP712("PredensityExchange", "1") {
        usdcToken = _usdcToken;
        operator = _operator;
    }

    // =========================================================================
    // MODE 1: OPERATOR SETTLEMENT (for managed wallet users)
    // =========================================================================

    /**
     * @notice Settle a matched trade submitted by the authorized operator.
     *         The operator holds all tokens for managed wallet users.
     *         This is an internal accounting settlement -- tokens move within
     *         the operator's balance. Convex tracks per-user ownership.
     * @param tradeId Unique trade identifier from Convex
     * @param outcomeToken The HTS outcome token being traded
     * @param buyer Address receiving outcome tokens (operator for managed users)
     * @param seller Address sending outcome tokens (operator for managed users)
     * @param price Price per token in USDC micro-units
     * @param quantity Number of outcome tokens
     */
    function settleOperatorTrade(
        bytes32 tradeId,
        address outcomeToken,
        address buyer,
        address seller,
        uint256 price,
        uint256 quantity
    ) external nonReentrant whenNotPaused {
        require(msg.sender == operator, "Only operator");
        require(!settledTrades[tradeId], "Already settled");
        require(quantity > 0, "Quantity must be > 0");

        settledTrades[tradeId] = true;

        uint256 usdcAmount = (price * quantity) / 1e6; // price is in micro-units
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOM;
        totalFees += fee;

        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

        // Transfer outcome tokens: seller -> buyer
        int64 rc1 = hts.transferToken(
            outcomeToken,
            seller,
            buyer,
            int64(int256(quantity))
        );
        require(rc1 == 22, "Token transfer failed");

        // Transfer USDC: buyer -> seller (minus fee) using HTS
        int64 rc2 = hts.transferToken(
            usdcToken,
            buyer,
            seller,
            int64(int256(usdcAmount - fee))
        );
        require(rc2 == 22, "USDC transfer failed");

        emit TradeSettled(tradeId, buyer, seller, outcomeToken, price, quantity, usdcAmount);
    }

    // =========================================================================
    // MODE 2: SIGNATURE-VERIFIED SETTLEMENT (for wallet-connected users)
    // =========================================================================

    /**
     * @notice Settle a matched trade using EIP-712 signed orders from both parties.
     *         Used when users have their own wallets (HashPack, MetaMask, etc.)
     *         and want non-custodial, trustless settlement.
     * @param makerOrder The maker's signed order
     * @param makerSignature EIP-712 signature from the maker
     * @param takerOrder The taker's signed order
     * @param takerSignature EIP-712 signature from the taker
     */
    function settleSignedTrade(
        Order calldata makerOrder,
        bytes calldata makerSignature,
        Order calldata takerOrder,
        bytes calldata takerSignature
    ) external nonReentrant whenNotPaused {
        // Verify signatures
        bytes32 makerHash = _hashOrder(makerOrder);
        bytes32 takerHash = _hashOrder(takerOrder);

        address makerSigner = ECDSA.recover(
            _hashTypedDataV4(makerHash),
            makerSignature
        );
        address takerSigner = ECDSA.recover(
            _hashTypedDataV4(takerHash),
            takerSignature
        );

        require(makerSigner == makerOrder.trader, "Invalid maker signature");
        require(takerSigner == takerOrder.trader, "Invalid taker signature");

        // Verify order compatibility
        require(makerOrder.outcomeToken == takerOrder.outcomeToken, "Token mismatch");
        require(makerOrder.isBuy != takerOrder.isBuy, "Same side");
        require(makerOrder.price == takerOrder.price, "Price mismatch");
        require(makerOrder.quantity == takerOrder.quantity, "Quantity mismatch");
        require(block.timestamp <= makerOrder.expiry, "Maker order expired");
        require(block.timestamp <= takerOrder.expiry, "Taker order expired");

        // Verify nonces (replay protection)
        require(makerOrder.nonce == nonces[makerOrder.trader], "Invalid maker nonce");
        require(takerOrder.nonce == nonces[takerOrder.trader], "Invalid taker nonce");
        nonces[makerOrder.trader]++;
        nonces[takerOrder.trader]++;

        // Execute the swap
        _executeSignedSwap(makerOrder, takerOrder, makerHash, takerHash);
    }

    function _executeSignedSwap(
        Order calldata makerOrder,
        Order calldata takerOrder,
        bytes32 makerHash,
        bytes32 takerHash
    ) internal {
        address buyer = makerOrder.isBuy ? makerOrder.trader : takerOrder.trader;
        address seller = makerOrder.isBuy ? takerOrder.trader : makerOrder.trader;

        bytes32 tradeId = keccak256(abi.encodePacked(makerHash, takerHash));
        require(!settledTrades[tradeId], "Already settled");
        settledTrades[tradeId] = true;

        uint256 usdcAmount = (makerOrder.price * makerOrder.quantity) / 1e6;
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOM;
        totalFees += fee;

        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

        // Outcome tokens: seller -> buyer
        require(hts.transferToken(
            makerOrder.outcomeToken, seller, buyer, int64(int256(makerOrder.quantity))
        ) == 22, "Token transfer failed");

        // USDC: buyer -> seller (minus fee) using HTS
        require(hts.transferToken(
            usdcToken, buyer, seller, int64(int256(usdcAmount - fee))
        ) == 22, "USDC transfer failed");

        emit TradeSettled(tradeId, buyer, seller, makerOrder.outcomeToken, makerOrder.price, makerOrder.quantity, usdcAmount);
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    function _hashOrder(Order calldata order) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.trader,
            order.outcomeToken,
            order.isBuy,
            order.price,
            order.quantity,
            order.nonce,
            order.expiry
        ));
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function setOperator(address _operator) external onlyOwner {
        address old = operator;
        operator = _operator;
        emit OperatorUpdated(old, _operator);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        feeBps = _feeBps;
    }

    function withdrawFees(address to) external onlyOwner {
        require(totalFees > 0, "No fees");
        uint256 amount = totalFees;
        totalFees = 0;
        require(IERC20(usdcToken).transfer(to, amount), "Transfer failed");
        emit FeesWithdrawn(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function isTradeSettled(bytes32 tradeId) external view returns (bool) {
        return settledTrades[tradeId];
    }

    function getNonce(address trader) external view returns (uint256) {
        return nonces[trader];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
