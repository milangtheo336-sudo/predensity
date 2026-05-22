# Foundry Scripts for HederaToken Operations

This directory contains Foundry scripts for deploying, minting, and reading token balances on-chain.

## Scripts Overview

### 1. `DeployToken.s.sol`
Simple deployment script that deploys the HederaToken contract.

### 2. `TokenOperations.s.sol`
Comprehensive script with multiple functions for token operations:
- `run()`: Deploy and perform basic operations
- `mintToAddress()`: Mint tokens to a specific address
- `readBalances()`: Read balances for multiple addresses
- `readTokenInfo()`: Read token information

## Prerequisites

1. Set up your environment variables in a `.env` file:
```bash
OPERATOR_KEY=your_private_key_here
RPC_URL=your_hedera_testnet_rpc_url
```

2. Make sure you have Foundry installed and configured.

## Usage Examples

### Deploy the Token Contract

```bash
# Deploy the token contract
forge script script/DeployToken.s.sol --rpc-url $RPC_URL --broadcast
```

### Run the Complete Operations Script

```bash
# This will deploy a new contract and perform minting operations
forge script script/TokenOperations.s.sol --rpc-url $RPC_URL --broadcast
```

### Mint Tokens to a Specific Address

First, update the `TOKEN_ADDRESS` constant in `TokenOperations.s.sol` with your deployed contract address, then:

```bash
# Mint 1000 tokens to a specific address
forge script script/TokenOperations.s.sol --sig "mintToAddress(address,address,uint256)" \
  --rpc-url $RPC_URL --broadcast \
  -- 0xYourTokenAddress 0xRecipientAddress 1000000000000000000000
```

### Read Token Information (View Function)

```bash
# Read token information
forge script script/TokenOperations.s.sol --sig "readTokenInfo(address)" \
  --rpc-url $RPC_URL \
  -- 0xYourTokenAddress
```

### Read Balances for Multiple Addresses

```bash
# Read balances for multiple addresses
forge script script/TokenOperations.s.sol --sig "readBalances(address,address[])" \
  --rpc-url $RPC_URL \
  -- 0xYourTokenAddress "[0xAddress1,0xAddress2,0xAddress3]"
```

## Environment Setup

Make sure your `.env` file contains:
- `OPERATOR_KEY`: Your private key for transactions
- `RPC_URL`: Your Hedera testnet RPC endpoint

## Notes

- The token has 18 decimals by default (ERC20 standard)
- When minting, multiply by 10^18 to account for decimals
- The deployer becomes the owner and can mint tokens
- All minting operations require the owner's private key

## Example Workflow

1. Deploy the token:
```bash
forge script script/DeployToken.s.sol --rpc-url $RPC_URL --broadcast
```

2. Note the deployed address from the output

3. Update the `TOKEN_ADDRESS` in `TokenOperations.s.sol` with the deployed address

4. Mint tokens to different addresses:
```bash
forge script script/TokenOperations.s.sol --sig "mintToAddress(address,address,uint256)" \
  --rpc-url $RPC_URL --broadcast \
  -- 0xDeployedAddress 0xRecipientAddress 1000000000000000000000
```

5. Read balances:
```bash
forge script script/TokenOperations.s.sol --sig "readBalances(address,address[])" \
  --rpc-url $RPC_URL \
  -- 0xDeployedAddress "[0xAddress1,0xAddress2]"
``` 