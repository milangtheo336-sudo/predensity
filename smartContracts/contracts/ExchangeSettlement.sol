// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title ExchangeSettlement
 * @notice Settles matched trades from the off-chain Convex order book.
 *         Supports two modes:
 *         1. Operator mode: operator submits matched trades (for managed wallet users)
 *         2. Signature mode: EIP-712 signed intents verified on-chain (for wallet users)
 *
 *         Uses standard ERC-20 transferFrom for atomic token swaps on Arc.
 *         Requires participants to approve this contract for their tokens.
 */
contract ExchangeSettlement is Ownable, ReentrancyGuard, Pausable, EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    address public operator;

    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public settledTrades;

    uint256 public feeBps = 50; // 0.5%
    uint256 constant BPS_DENOM = 10000;
    uint256 public totalFees;

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address trader,address outcomeToken,bool isBuy,uint256 price,uint256 quantity,uint256 nonce,uint256 expiry)"
    );

    struct Order {
        address trader;
        address outcomeToken;
        bool isBuy;
        uint256 price;
        uint256 quantity;
        uint256 nonce;
        uint256 expiry;
    }

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
        usdcToken = IERC20(_usdcToken);
        operator = _operator;
    }

    // =========================================================================
    // MODE 1: OPERATOR SETTLEMENT (for managed wallet users)
    // =========================================================================

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

        uint256 usdcAmount = (price * quantity) / 1e6;
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOM;
        totalFees += fee;

        // Outcome tokens: seller -> buyer
        IERC20(outcomeToken).safeTransferFrom(seller, buyer, quantity);

        // USDC: buyer -> seller (minus fee)
        usdcToken.safeTransferFrom(buyer, seller, usdcAmount - fee);

        // Fee: buyer -> contract
        if (fee > 0) {
            usdcToken.safeTransferFrom(buyer, address(this), fee);
        }

        emit TradeSettled(tradeId, buyer, seller, outcomeToken, price, quantity, usdcAmount);
    }

    // =========================================================================
    // MODE 2: SIGNATURE-VERIFIED SETTLEMENT (for wallet-connected users)
    // =========================================================================

    function settleSignedTrade(
        Order calldata makerOrder,
        bytes calldata makerSignature,
        Order calldata takerOrder,
        bytes calldata takerSignature
    ) external nonReentrant whenNotPaused {
        bytes32 makerHash = _hashOrder(makerOrder);
        bytes32 takerHash = _hashOrder(takerOrder);

        address makerSigner = ECDSA.recover(_hashTypedDataV4(makerHash), makerSignature);
        address takerSigner = ECDSA.recover(_hashTypedDataV4(takerHash), takerSignature);

        require(makerSigner == makerOrder.trader, "Invalid maker signature");
        require(takerSigner == takerOrder.trader, "Invalid taker signature");

        require(makerOrder.outcomeToken == takerOrder.outcomeToken, "Token mismatch");
        require(makerOrder.isBuy != takerOrder.isBuy, "Same side");
        require(makerOrder.price == takerOrder.price, "Price mismatch");
        require(makerOrder.quantity == takerOrder.quantity, "Quantity mismatch");
        require(block.timestamp <= makerOrder.expiry, "Maker order expired");
        require(block.timestamp <= takerOrder.expiry, "Taker order expired");

        require(makerOrder.nonce == nonces[makerOrder.trader], "Invalid maker nonce");
        require(takerOrder.nonce == nonces[takerOrder.trader], "Invalid taker nonce");
        nonces[makerOrder.trader]++;
        nonces[takerOrder.trader]++;

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

        // Outcome tokens: seller -> buyer
        IERC20(makerOrder.outcomeToken).safeTransferFrom(seller, buyer, makerOrder.quantity);

        // USDC: buyer -> seller (minus fee)
        usdcToken.safeTransferFrom(buyer, seller, usdcAmount - fee);

        // Fee: buyer -> contract
        if (fee > 0) {
            usdcToken.safeTransferFrom(buyer, address(this), fee);
        }

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
        usdcToken.safeTransfer(to, amount);
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
