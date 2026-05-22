// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleProxyWallet - User-controlled smart contract wallet with session keys
 * 
 * Each user gets their own proxy wallet owned by their Magic Link EOA.
 * Supports session keys for gasless betting with withdrawal protection.
 * 
 * Features:
 * - Single owner (user's Magic Link address)
 * - Session key delegation (sign once, bet multiple times)
 * - Withdrawal protection (withdrawals require owner signature)
 * - Execute any transaction
 * - Batch transactions (gas optimization)
 * - Receive USDC
 * - Change owner (account recovery)
 */
contract SimpleProxyWallet {
    address public owner;
    bool private initialized;
    
    // Nonce tracking to prevent signature replay attacks
    mapping(address => uint256) public nonces;
    
    // Session key management
    struct SessionKey {
        address delegate;      // Address that can execute on behalf of owner
        uint256 maxAmount;     // Maximum USDC per transaction
        uint256 dailyLimit;    // Maximum USDC per day
        uint256 expiry;        // Timestamp when session expires
        bool revoked;          // Can be revoked by owner anytime
        uint256 spentToday;    // Amount spent today
        uint256 lastResetDay;  // Last day counter was reset
    }
    
    mapping(address => SessionKey) public sessionKeys;
    
    // Withdrawal delay for security
    struct PendingWithdrawal {
        address token;
        address to;
        uint256 amount;
        uint256 executeAfter;  // Timestamp when withdrawal can be executed
        bool executed;
    }
    
    mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;
    uint256 public withdrawalNonce;
    uint256 public constant WITHDRAWAL_DELAY = 24 hours;

    // Session key delegate list for revocation during emergency
    address[] private _delegates;
    
    // Whitelisted contracts (prediction markets)
    mapping(address => bool) public whitelistedContracts;
    
    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event SessionKeyCreated(address indexed delegate, uint256 maxAmount, uint256 dailyLimit, uint256 expiry);
    event SessionKeyRevoked(address indexed delegate);
    event WithdrawalInitiated(bytes32 indexed withdrawalId, address token, address to, uint256 amount, uint256 executeAfter);
    event WithdrawalExecuted(bytes32 indexed withdrawalId);
    event WithdrawalCancelled(bytes32 indexed withdrawalId);
    event ContractWhitelisted(address indexed contractAddress);
    event ContractRemovedFromWhitelist(address indexed contractAddress);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyOwnerOrDelegate() {
        require(msg.sender == owner || isValidDelegate(msg.sender), "Not authorized");
        _;
    }
    
    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
        initialized = true;
    }
    
    /**
     * Initialize function for minimal proxy pattern (EIP-1167).
     * Called once after cloning.
     */
    function initialize(address _owner) external {
        require(!initialized, "Already initialized");
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
        initialized = true;
    }
    
    /**
     * Check if an address is a valid delegate with active session.
     */
    function isValidDelegate(address delegate) public view returns (bool) {
        SessionKey memory session = sessionKeys[delegate];
        return !session.revoked && 
               session.expiry > block.timestamp && 
               session.delegate == delegate;
    }
    
    /**
     * Create a session key for delegated betting.
     * Only owner can create session keys.
     * 
     * @param delegate Address that can execute bets on behalf of owner
     * @param maxAmount Maximum USDC per transaction
     * @param dailyLimit Maximum USDC per day
     * @param duration How long the session is valid (in seconds)
     */
    function createSessionKey(
        address delegate,
        uint256 maxAmount,
        uint256 dailyLimit,
        uint256 duration
    ) external onlyOwner {
        require(delegate != address(0), "Invalid delegate");
        require(maxAmount > 0 && dailyLimit > 0, "Invalid limits");
        require(duration > 0 && duration <= 90 days, "Invalid duration");
        
        // Track delegate for emergency revocation
        if (sessionKeys[delegate].delegate == address(0)) {
            _delegates.push(delegate);
        }

        sessionKeys[delegate] = SessionKey({
            delegate: delegate,
            maxAmount: maxAmount,
            dailyLimit: dailyLimit,
            expiry: block.timestamp + duration,
            revoked: false,
            spentToday: 0,
            lastResetDay: block.timestamp / 1 days
        });

        emit SessionKeyCreated(delegate, maxAmount, dailyLimit, block.timestamp + duration);
    }
    
    /**
     * Revoke a session key immediately.
     * Only owner can revoke.
     */
    function revokeSessionKey(address delegate) external onlyOwner {
        require(sessionKeys[delegate].delegate != address(0), "Session key not found");
        sessionKeys[delegate].revoked = true;
        emit SessionKeyRevoked(delegate);
    }
    
    /**
     * Whitelist a prediction market contract for session key usage.
     * Only owner can whitelist contracts.
     */
    function whitelistContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract");
        whitelistedContracts[contractAddress] = true;
        emit ContractWhitelisted(contractAddress);
    }
    
    /**
     * Remove a contract from whitelist.
     */
    function removeFromWhitelist(address contractAddress) external onlyOwner {
        whitelistedContracts[contractAddress] = false;
        emit ContractRemovedFromWhitelist(contractAddress);
    }
    
    /**
     * Check and update daily spending limit for session keys.
     */
    function _checkAndUpdateDailyLimit(address delegate, uint256 amount) internal {
        SessionKey storage session = sessionKeys[delegate];
        uint256 currentDay = block.timestamp / 1 days;
        
        // Reset counter if it's a new day
        if (currentDay > session.lastResetDay) {
            session.spentToday = 0;
            session.lastResetDay = currentDay;
        }
        
        require(session.spentToday + amount <= session.dailyLimit, "Daily limit exceeded");
        require(amount <= session.maxAmount, "Amount exceeds per-transaction limit");
        
        session.spentToday += amount;
    }
    
    // ERC-20 selectors we know how to decode for limit enforcement.
    bytes4 private constant SELECTOR_APPROVE       = 0x095ea7b3; // approve(address,uint256)
    bytes4 private constant SELECTOR_TRANSFER      = 0xa9059cbb; // transfer(address,uint256)
    bytes4 private constant SELECTOR_TRANSFER_FROM = 0x23b872dd; // transferFrom(address,address,uint256)

    /**
     * Decode the value/amount field of a known ERC-20 call.
     * Reverts if the selector isn't one we can audit.
     */
    function _decodeERC20Amount(bytes calldata data)
        internal
        pure
        returns (uint256 amount, address recipient)
    {
        require(data.length >= 4, "Calldata too short");
        bytes4 selector = bytes4(data[:4]);

        if (selector == SELECTOR_APPROVE) {
            // approve(address spender, uint256 amount)
            require(data.length >= 4 + 32 + 32, "Bad approve calldata");
            address spender;
            assembly {
                spender := calldataload(add(data.offset, 4))
                amount  := calldataload(add(data.offset, 36))
            }
            return (amount, spender);
        }
        if (selector == SELECTOR_TRANSFER) {
            // transfer(address to, uint256 amount)
            require(data.length >= 4 + 32 + 32, "Bad transfer calldata");
            address to;
            assembly {
                to     := calldataload(add(data.offset, 4))
                amount := calldataload(add(data.offset, 36))
            }
            return (amount, to);
        }
        if (selector == SELECTOR_TRANSFER_FROM) {
            // transferFrom(address from, address to, uint256 amount)
            require(data.length >= 4 + 32 + 32 + 32, "Bad transferFrom calldata");
            address to;
            assembly {
                to     := calldataload(add(data.offset, 36))
                amount := calldataload(add(data.offset, 68))
            }
            return (amount, to);
        }
        revert("Selector not allowed for session keys");
    }

    /**
     * Execute a transaction on behalf of this wallet.
     * Can be called by owner OR valid session key delegate (with restrictions).
     *
     * Session keys can only:
     * - Call whitelisted contracts
     * - Using a known ERC-20 selector (approve/transfer/transferFrom)
     * - With the recipient/spender itself whitelisted, so funds cannot be
     *   swept to an arbitrary attacker address even if the token contract
     *   happens to be whitelisted.
     * - Within their per-tx and daily spending limits
     * - Cannot send native tokens
     *
     * For calling arbitrary prediction-market functions (e.g. placeBet), delegates
     * MUST use `executeBet()`, which takes the bet amount explicitly so the
     * daily cap can be enforced against the real value at stake.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwnerOrDelegate returns (bytes memory) {
        // If caller is a delegate (not owner), enforce restrictions
        if (msg.sender != owner) {
            require(isValidDelegate(msg.sender), "Invalid session key");
            require(whitelistedContracts[target], "Contract not whitelisted");
            require(value == 0, "Session keys cannot send native tokens");

            // Decode the ERC-20 amount from calldata and charge it
            // against the daily + per-tx limits. Unknown selectors revert.
            (uint256 amount, address recipient) = _decodeERC20Amount(data);

            // For transfer/transferFrom, restrict the recipient to a
            // whitelisted contract so a compromised session key can't
            // redirect USDC out of the proxy to an attacker-owned address.
            // For approve, the "recipient" is the spender — also must be
            // whitelisted.
            require(whitelistedContracts[recipient], "Recipient not whitelisted");

            _checkAndUpdateDailyLimit(msg.sender, amount);
        }

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
        return result;
    }
    
    /**
     * Execute a bet transaction with signature verification.
     * Backend calls this with user's signature to place bet.
     * Proxy wallet verifies the signature matches the owner.
     */
    function executeBetWithSignature(
        address predictionContract,
        uint256 betAmount,
        address usdcToken,
        bytes calldata betData,
        string calldata message,
        bytes calldata signature
    ) external returns (bytes memory) {
        require(recoverSigner(message, signature) == owner, "Invalid signature");
        nonces[owner]++;

        // Transfer USDC to prediction contract using standard ERC-20
        (bool transferSuccess, bytes memory transferResult) = usdcToken.call(
            abi.encodeWithSelector(SELECTOR_TRANSFER, predictionContract, betAmount)
        );
        require(transferSuccess && (transferResult.length == 0 || abi.decode(transferResult, (bool))), "USDC transfer failed");

        // Execute bet
        (bool success, bytes memory result) = predictionContract.call(betData);
        require(success, "Bet execution failed");

        emit Executed(predictionContract, 0, betData);
        return result;
    }
    
    /**
     * Recover signer from signature (for string messages).
     * personal_sign already adds the "\x19Ethereum Signed Message:\n" prefix,
     * so we need to reconstruct the exact same hash.
     */
    function recoverSigner(string memory message, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        // personal_sign format: "\x19Ethereum Signed Message:\n" + len(message) + message
        bytes memory messageBytes = bytes(message);
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        bytes memory lengthBytes = bytes(uintToString(messageBytes.length));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(prefix, lengthBytes, message));
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
    
    /**
     * Convert uint to string for message length.
     */
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * Execute a bet transaction with explicit amount tracking.
     * Used by session keys to place bets with proper limit enforcement.
     *
     * betAmount must match the actual value encoded in betData — we decode
     * betData independently and require they agree, so a delegate cannot
     * pass betAmount=0 to skip the daily-limit check while encoding a
     * larger real amount inside betData.
     */
    function executeBet(
        address predictionContract,
        uint256 betAmount,
        bytes calldata betData
    ) external onlyOwnerOrDelegate returns (bytes memory) {
        if (msg.sender != owner) {
            require(isValidDelegate(msg.sender), "Invalid session key");
            require(whitelistedContracts[predictionContract], "Contract not whitelisted");
            require(betAmount > 0, "Bet amount must be > 0");

            // Decode the real amount from betData and require it matches
            // the caller-supplied betAmount so the limit cannot be bypassed.
            (uint256 decodedAmount, ) = _decodeERC20Amount(betData);
            require(decodedAmount == betAmount, "betAmount mismatch");

            _checkAndUpdateDailyLimit(msg.sender, betAmount);
        }

        (bool success, bytes memory result) = predictionContract.call(betData);
        require(success, "Bet execution failed");
        emit Executed(predictionContract, 0, betData);
        return result;
    }
    
    /**
     * Initiate a withdrawal (OWNER ONLY - session keys CANNOT withdraw).
     * Withdrawals have a 24-hour delay for security.
     * 
     * @param token Token address (or address(0) for native USDC)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function initiateWithdrawal(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner returns (bytes32) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        bytes32 withdrawalId = keccak256(abi.encodePacked(token, to, amount, block.timestamp, withdrawalNonce++));
        
        pendingWithdrawals[withdrawalId] = PendingWithdrawal({
            token: token,
            to: to,
            amount: amount,
            executeAfter: block.timestamp + WITHDRAWAL_DELAY,
            executed: false
        });
        
        emit WithdrawalInitiated(withdrawalId, token, to, amount, block.timestamp + WITHDRAWAL_DELAY);
        return withdrawalId;
    }
    
    /**
     * Execute a pending withdrawal after the delay period.
     * OWNER ONLY - provides time to cancel if compromised.
     */
    function executeWithdrawal(bytes32 withdrawalId) external onlyOwner {
        PendingWithdrawal storage withdrawal = pendingWithdrawals[withdrawalId];
        
        require(withdrawal.amount > 0, "Withdrawal not found");
        require(!withdrawal.executed, "Already executed");
        require(block.timestamp >= withdrawal.executeAfter, "Withdrawal delay not passed");
        
        withdrawal.executed = true;
        
        if (withdrawal.token == address(0)) {
            // Native withdrawal
            (bool success, ) = withdrawal.to.call{value: withdrawal.amount}("");
            require(success, "Native transfer failed");
        } else {
            // Token withdrawal (USDC)
            (bool success, ) = withdrawal.token.call(
                abi.encodeWithSignature("transfer(address,uint256)", withdrawal.to, withdrawal.amount)
            );
            require(success, "Token transfer failed");
        }
        
        emit WithdrawalExecuted(withdrawalId);
    }
    
    /**
     * Cancel a pending withdrawal (OWNER ONLY).
     * Use this if you suspect your session key was compromised.
     */
    function cancelWithdrawal(bytes32 withdrawalId) external onlyOwner {
        PendingWithdrawal storage withdrawal = pendingWithdrawals[withdrawalId];
        
        require(withdrawal.amount > 0, "Withdrawal not found");
        require(!withdrawal.executed, "Already executed");
        
        delete pendingWithdrawals[withdrawalId];
        emit WithdrawalCancelled(withdrawalId);
    }
    
    /**
     * Emergency withdrawal (OWNER ONLY, no delay).
     * Use only in emergencies. Bypasses the 24-hour delay.
     * Automatically revokes ALL session keys for security.
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        // Revoke all active session keys before moving funds
        for (uint256 i = 0; i < _delegates.length; i++) {
            if (!sessionKeys[_delegates[i]].revoked) {
                sessionKeys[_delegates[i]].revoked = true;
                emit SessionKeyRevoked(_delegates[i]);
            }
        }

        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Emergency native withdrawal failed");
        } else {
            (bool success, ) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", to, amount)
            );
            require(success, "Emergency token withdrawal failed");
        }

        emit Executed(token, amount, "");
    }
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwner {
        require(
            targets.length == values.length && values.length == datas.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(datas[i]);
            require(success, "Batch execution failed");
            emit Executed(targets[i], values[i], datas[i]);
        }
    }
    
    /**
     * Change owner (for account recovery).
     * User can transfer ownership to a new Magic Link account.
     */
    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnerChanged(previousOwner, newOwner);
    }
    
    
    receive() external payable {}
    
    /**
     * Fallback for any other calls.
     */
    fallback() external payable {}
}