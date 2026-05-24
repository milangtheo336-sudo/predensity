# Predensity Multi-Category Prediction Market Subgraph

Subgraph for indexing multi-category prediction market smart contract events on Arc Testnet.

This repository defines the GraphQL schema, event mappings, and configurations for indexing events from four category-specific prediction market contracts: Crypto, Politics, Sports, and Technology.

## Directory Structure

```
predensity-subgraph/
├── abis/              # ABI definitions for the indexed smart contracts
├── config/            # Configuration files
├── graph-node/        # Dockerized Graph Node setup for local development
├── src/               # Event handlers and mapping logic
├── package.json       # Project dependencies and scripts
├── schema.graphql     # GraphQL schema definition (Entities)
├── subgraph.yaml      # Subgraph manifest: sources, mappings, schema
└── README.md          
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker + Docker Compose](https://docs.docker.com/compose/)
- [Graph CLI](https://www.npmjs.com/package/@graphprotocol/graph-cli)

## Quick Start

### 1. Install Dependencies

```bash
cd predensity-subgraph
npm install
```

### 2. Start Local Graph Node

The Graph Node requires Docker to run locally with PostgreSQL and IPFS.

```bash
npm run graph-node
```

This will start:
- Graph Node on port 8000 (GraphQL queries)
- Graph Node admin on port 8020 (deployments)
- IPFS on port 5001
- PostgreSQL on port 5432

Wait for the services to be fully ready (check Docker logs).

### 3. Generate TypeScript Types

```bash
npm run graph-codegen
```

This generates TypeScript types from your schema.graphql and ABIs.

### 4. Create the Subgraph

```bash
npm run create-local
```

This registers the subgraph with your local Graph Node.

### 5. Deploy the Subgraph

```bash
npm run deploy-local
```

This builds and deploys the subgraph to your local Graph Node.

### 6. Query the Subgraph

Once deployed, you can query the subgraph at:
```
http://localhost:8000/subgraphs/name/PredensityPredictionMarket
```

Example query:
```graphql
{
  bets(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    user {
      id
    }
    market {
      category
    }
    stake
    priceMin
    priceMax
    targetTimestamp
    finalized
    won
  }
}
```

## Indexed Contracts

The subgraph indexes four category-specific contracts:

| Category | Contract Address | Network |
|----------|-----------------|---------|
| Crypto | 0x0DE38B6eCBb09eF05584C9607EE941D4938D1da8 | Arc Testnet |
| Politics | 0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8 | Arc Testnet |
| Sports | 0x8f62C698a26888424b5170a11610Fa5Fd7DF540b | Arc Testnet |
| Technology | 0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8 | Arc Testnet |

## Indexed Events

| Event | Description |
|-------|-------------|
| `BetPlaced` | User places a prediction bet |
| `BetClaimed` | User claims their winnings |
| `FeeCollected` | Platform fee collected from a bet |
| `AggregationCompleted` | Bucket aggregation completed |
| `BucketPriceSet` / `BucketValueSet` | Price set for a bucket |
| `BatchProcessed` | Batch of bets processed |
| `SharesSold` | DPM early exit shares sold |

## Schema Overview

Key entities:
- `User` - User accounts and their stats
- `Market` - Category-specific market contracts
- `Bet` - Individual prediction bets
- `Bucket` - Time-based bet buckets
- `Fee` - Platform fees collected

See `schema.graphql` for the complete schema definition.

## Development Commands

```bash
# Generate types from schema and ABIs
npm run graph-codegen

# Build the subgraph
npm run compile

# Start local Graph Node
npm run graph-node

# Create subgraph on local node
npm run create-local

# Deploy to local node
npm run deploy-local

# Remove from local node
npm run remove-local

# Clean local Graph Node data
npm run graph-local-clean
```

## Troubleshooting

### Graph Node not starting
- Ensure Docker is running
- Check if ports 8000, 8020, 5001, 5432 are available
- Run `npm run graph-local-clean` to reset the Graph Node data

### Deployment fails
- Ensure Graph Node is running (`docker ps`)
- Run `npm run graph-codegen` to regenerate types
- Check that contract addresses in `subgraph.yaml` match deployed contracts

### No data appearing
- Verify contracts have emitted events (check block explorer)
- Check Graph Node logs: `docker logs predensity-subgraph-graph-node-1`
- Ensure `startBlock` in `subgraph.yaml` is before the first event

## Learn More

- [The Graph Documentation](https://thegraph.com/docs/)
- [The Graph Subgraph Tutorial](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
