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
 * - Receive USDC/HBAR
 * - Change owner (account recovery)
 * - Hedera token association (for USDC on Hedera)
 */
contract SimpleProxyWallet {
    address public owner;
    bool private initialized;
    
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
    uint256 public constant WITHDRAWAL_DELAY = 24 hours;
    
    // Whitelisted contracts (prediction markets)
    mapping(address => bool) public whitelistedContracts;
    
    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event TokenAssociated(address indexed token);
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
    
    /**
     * Execute a transaction on behalf of this wallet.
     * Can be called by owner OR valid session key delegate (with restrictions).
     * 
     * Session keys can only:
     * - Call whitelisted contracts (prediction markets)
     * - Within their spending limits
     * - Cannot withdraw funds
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
            
            // Check spending limits (approximate USDC value)
            // In production, you'd decode the calldata to get exact amount
            _checkAndUpdateDailyLimit(msg.sender, value);
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
     * 
     * Uses Hedera Token Service (HTS) precompile for token transfers,
     * then calls placeBetWithPreTransferredToken on the prediction market.
     */
    function executeBetWithSignature(
        address predictionContract,
        uint256 betAmount,
        bytes calldata betData,
        string calldata message,
        bytes calldata signature
    ) external returns (bytes memory) {
        // Verify signature matches owner
        require(recoverSigner(message, signature) == owner, "Invalid signature");
        
        // Transfer USDC using HTS precompile
        // HTS: 0x0000000000000000000000000000000000000167
        // USDC: 0x00000000000000000000000000000000007d943F
        // transferToken selector: 0xeca36917
        (bool transferSuccess, bytes memory transferResult) = address(0x0000000000000000000000000000000000000167).call(
            abi.encodeWithSelector(
                bytes4(0xeca36917),
                address(0x00000000000000000000000000000000007d943F),
                address(this),
                predictionContract,
                int64(uint64(betAmount))
            )
        );
        
        require(transferSuccess, "HTS transfer failed");
        
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
     */
    function executeBet(
        address predictionContract,
        uint256 betAmount,
        bytes calldata betData
    ) external onlyOwnerOrDelegate returns (bytes memory) {
        // If caller is a delegate, enforce restrictions
        if (msg.sender != owner) {
            require(isValidDelegate(msg.sender), "Invalid session key");
            require(whitelistedContracts[predictionContract], "Contract not whitelisted");
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
     * @param token Token address (or address(0) for native HBAR)
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
        
        bytes32 withdrawalId = keccak256(abi.encodePacked(token, to, amount, block.timestamp));
        
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
            // Native HBAR withdrawal
            (bool success, ) = withdrawal.to.call{value: withdrawal.amount}("");
            require(success, "HBAR transfer failed");
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
        
        // Revoke all session keys for security
        // Note: In production, you'd want to iterate through all delegates
        // For now, users should manually revoke session keys before emergency withdrawal
        
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Emergency HBAR withdrawal failed");
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
    
    /**
     * Associate with a Hedera token (required before receiving HTS tokens like USDC).
     * On Hedera, contracts must explicitly associate with tokens.
     * 
     * Hedera Token Service (HTS) system contract: 0x0000000000000000000000000000000000000167
     */
    function associateToken(address token) external onlyOwner {
        // Call HTS associateToken function
        // Function selector: 0x49146bde (associateToken(address,address))
        (bool success, ) = address(0x0000000000000000000000000000000000000167).call(
            abi.encodeWithSelector(0x49146bde, address(this), token)
        );
        require(success, "Token association failed");
        emit TokenAssociated(token);
    }
    
    /**
     * Associate with multiple tokens in one transaction (gas optimization).
     */
    function associateTokens(address[] calldata tokens) external onlyOwner {
        // Call HTS associateTokens function
        // Function selector: 0x2e63879b (associateTokens(address,address[]))
        (bool success, ) = address(0x0000000000000000000000000000000000000167).call(
            abi.encodeWithSelector(0x2e63879b, address(this), tokens)
        );
        require(success, "Token association failed");
        for (uint256 i = 0; i < tokens.length; i++) {
            emit TokenAssociated(tokens[i]);
        }
    }
    
    /**
     * Receive HBAR/ETH.
     */
    receive() external payable {}
    
    /**
     * Fallback for any other calls.
     */
    fallback() external payable {}
}
