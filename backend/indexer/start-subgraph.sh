#!/bin/bash

echo "========================================="
echo "Starting Predensity Subgraph Setup"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo "Step 1: Starting Graph Node (Docker)..."
npm run graph-node
echo "Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "Step 2: Generating TypeScript types..."
npm run graph-codegen

echo ""
echo "Step 3: Creating subgraph..."
npm run create-local

echo ""
echo "Step 4: Deploying subgraph..."
npm run deploy-local

echo ""
echo "========================================="
echo "Subgraph Setup Complete!"
echo "========================================="
echo ""
echo "GraphQL Playground: http://localhost:8000/subgraphs/name/PredensityPredictionMarket"
echo ""
echo "Test query:"
echo "{"
echo "  bets(first: 5) {"
echo "    id"
echo "    stake"
echo "    targetTimestamp"
echo "  }"
echo "}"
echo ""
echo "Now restart your frontend: cd ../frontend && npm run dev"
