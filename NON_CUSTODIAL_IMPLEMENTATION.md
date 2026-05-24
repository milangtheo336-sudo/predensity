# Complete Non-Custodial Implementation Plan

## Overview

Transform the entire platform to be fully non-custodial using Magic Link + Simple Proxy Wallets.

**Key Changes:**
- All users (including M-Pesa) use Magic Link authentication
- Each user gets their own SimpleProxyWallet contract
- M-Pesa deposits go directly to user's wallet (via treasury bridge)
- No private keys stored on backend
- Operator key only used for: proxy deployment, M-Pesa bridging, settlement

---

## Architecture

```
User signs up with email
         ↓
Magic Link creates MPC wallet (EOA)
         ↓
Backend deploys SimpleProxyWallet (owned by user's EOA)
         ↓
User deposits via:
  - Crypto: Direct to proxy wallet
  - M-Pesa: Treasury bridge → User's proxy wallet
         ↓
User trades: Signs orders with Magic Link
         ↓
NO HONEYPOT: Each user controls their own wallet
```

---

## Phase 1: Smart Contracts

### File 1: SimpleProxyWallet.sol

Location: `smartContracts/contracts/SimpleProxyWallet.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleProxyWallet {
    address public owner;
    
    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _owner) {
        owner = _owner;
    }
    
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
    
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwner {
        require(targets.length == values.length && values.length == datas.length, "Length mismatch");
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(datas[i]);
            require(success, "Batch execution failed");
            emit Executed(targets[i], values[i], datas[i]);
        }
    }
