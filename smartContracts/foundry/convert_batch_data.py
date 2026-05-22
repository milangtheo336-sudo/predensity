#!/usr/bin/env python3
import json
import time
from datetime import datetime, timedelta

def convert_to_batch_format():
    # Current Hedera timestamp
    current_timestamp = 1754645318
    
    # Read the mock data
    with open('mock_bet_data_4_Aug07.json', 'r') as f:
        data = json.load(f)
    
    # Filter valid bets (future timestamps only)
    valid_bets = []
    for bet in data:
        # Skip bets with past timestamps
        if bet['targetTimestamp'] <= current_timestamp:
            continue
            
        # Convert price from decimal to BPS (multiply by 10000)
        price_min_bps = int(bet['priceMin'] * 10000)
        price_max_bps = int(bet['priceMax'] * 10000)
        
        # Convert stake from ETH to wei (multiply by 10^18)
        stake_wei = int(bet['stake'] * 10**18)
        
        valid_bets.append({
            'targetTimestamp': bet['targetTimestamp'],
            'priceMin': price_min_bps,
            'priceMax': price_max_bps,
            'stake': stake_wei,
            'original_stake_eth': bet['stake'],
            'original_price_min': bet['priceMin'],
            'original_price_max': bet['priceMax']
        })
    
    # Sort by timestamp
    valid_bets.sort(key=lambda x: x['targetTimestamp'])
    
    # Group into batches of 10 (contract limit)
    batches = []
    for i in range(0, len(valid_bets), 10):
        batch = valid_bets[i:i+10]
        batches.append(batch)
    
    # Generate batch commands
    print(f"# Converted {len(valid_bets)} valid bets into {len(batches)} batches")
    print(f"# Current timestamp: {current_timestamp}")
    print(f"# Valid bets range: {valid_bets[0]['targetTimestamp']} to {valid_bets[-1]['targetTimestamp']}")
    print()
    
    for i, batch in enumerate(batches):
        print(f"# Batch {i+1}: {len(batch)} bets")
        
        # Extract arrays for batch function
        timestamps = [str(bet['targetTimestamp']) for bet in batch]
        price_mins = [str(bet['priceMin']) for bet in batch]
        price_maxs = [str(bet['priceMax']) for bet in batch]
        
        # Calculate total stake for this batch
        total_stake = sum(bet['stake'] for bet in batch)
        total_stake_eth = total_stake / 10**18
        
        print(f"# Total stake: {total_stake_eth:.6f} ETH ({total_stake} wei)")
        print()
        
        # Generate the batch command
        print(f"# Batch {i+1} command:")
        print(f"forge script script/PlaceBatchBets.s.sol --sig \"run(uint256[],uint256[],uint256[])\" \\")
        print(f"  --rpc-url $MAINNET_RPC_URL \\")
        print(f"  --broadcast \\")
        print(f"  --value {total_stake} \\")
        print(f"  -- {json.dumps(timestamps)} {json.dumps(price_mins)} {json.dumps(price_maxs)}")
        print()
        
        # Show individual bets in this batch
        for j, bet in enumerate(batch):
            print(f"#   Bet {j+1}: {bet['original_stake_eth']:.6f} ETH, {bet['original_price_min']:.4f}-{bet['original_price_max']:.4f} -> {bet['priceMin']}-{bet['priceMax']} BPS")
        print()

if __name__ == "__main__":
    convert_to_batch_format() 