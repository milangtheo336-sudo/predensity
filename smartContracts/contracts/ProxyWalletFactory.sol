// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimpleProxyWallet.sol";

/**
 * ProxyWalletFactory - Deploys SimpleProxyWallet contracts using EIP-1167 minimal proxy
 * 
 * Uses EIP-1167 (minimal proxy) + CREATE2 for gas-efficient deterministic addresses.
 * Reduces deployment cost by ~80% compared to full contract deployment.
 * 
 * Pattern:
 * 1. Deploy master implementation once
 * 2. Clone master for each user (45 bytes vs full bytecode)
 * 3. Initialize clone with user's owner address
 */
contract ProxyWalletFactory {
    address public immutable masterImplementation;
    
    event WalletCreated(address indexed owner, address indexed wallet);
    
    mapping(address => address) public ownerToWallet;
    
    constructor() {
        // Deploy master implementation
        masterImplementation = address(new SimpleProxyWallet(address(this)));
    }
    
    /**
     * Deploy a minimal proxy wallet for a user (EIP-1167).
     * Uses CREATE2 so address is deterministic based on owner.
     * 
     * Gas cost: ~50k gas (vs ~250k for full deployment)
     */
    function createWallet(address owner) external returns (address) {
        require(owner != address(0), "Invalid owner");
        require(ownerToWallet[owner] == address(0), "Wallet already exists");
        
        bytes32 salt = keccak256(abi.encodePacked(owner));
        address clone = _clone(masterImplementation, salt);
        
        // Initialize the clone
        SimpleProxyWallet(payable(clone)).initialize(owner);
        
        ownerToWallet[owner] = clone;
        emit WalletCreated(owner, clone);
        
        return clone;
    }
    
    /**
     * Get the deterministic address for a user's wallet (before deployment).
     */
    function getWalletAddress(address owner) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(owner));
        return _predictCloneAddress(masterImplementation, salt);
    }
    
    /**
     * EIP-1167 minimal proxy clone with CREATE2.
     * Bytecode: 0x3d602d80600a3d3981f3363d3d373d3d3d363d73[implementation]5af43d82803e903d91602b57fd5bf3
     */
    function _clone(address implementation, bytes32 salt) private returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, salt)
        }
        require(instance != address(0), "Clone failed");
    }
    
    /**
     * Predict the address of a clone before deployment.
     */
    function _predictCloneAddress(address implementation, bytes32 salt) private view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
