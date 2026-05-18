// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleProxyWallet - User-controlled smart contract wallet
 * 
 * Each user gets their own proxy wallet owned by their Magic Link EOA.
 * Only the owner can execute transactions.
 * 
 * Features:
 * - Single owner (user's Magic Link address)
 * - Execute any transaction
 * - Batch transactions (gas optimization)
 * - Receive USDC/HBAR
 * - Change owner (account recovery)
 * - Hedera token association (for USDC on Hedera)
 */
contract SimpleProxyWallet {
    address public owner;
    bool private initialized;
    
    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event TokenAssociated(address indexed token);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
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
     * Execute a transaction on behalf of this wallet.
     * Only the owner (user's Magic Link EOA) can call this.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
        return result;
    }
    
    /**
     * Batch execute multiple transactions (gas optimization).
     */
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
