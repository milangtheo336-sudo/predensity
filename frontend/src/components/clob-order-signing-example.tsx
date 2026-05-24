/**
 * Example: How to update clob-prediction-card.tsx to use Magic Link signing
 * 
 * Copy this handlePlaceOrder function to replace the existing one.
 */

import { signTypedDataWithMagic, getMagicAddress } from '@/lib/magic';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';

export function useClobOrderSigning(user: any, market: any) {
  const wallet = useQuery(api.users.getManagedWalletByUserId, 
    user?.id ? { userId: user.id } : 'skip'
  );

  const handlePlaceOrder = async (
    selectedOutcome: number,
    orderSide: string,
    effectivePrice: number,
    shares: number,
    setIsPlacing: (val: boolean) => void,
    setAmount: (val: string) => void
  ) => {
    try {
      setIsPlacing(true);

      if (!wallet) {
        toast.error('No wallet found');
        return;
      }

      // Verify user is logged into Magic Link
      const magicAddress = await getMagicAddress();
      if (!magicAddress || magicAddress.toLowerCase() !== wallet.magicEOAAddress.toLowerCase()) {
        toast.error('Please authenticate with Magic Link first');
        return;
      }

      // Generate nonce (prevents replay attacks)
      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      // Create EIP-712 typed data
      const domain = {
        name: 'Predensity CLOB',
        version: '1',
        chainId: 296, // Hedera testnet
      };

      const types = {
        Order: [
          { name: 'marketId', type: 'string' },
          { name: 'outcomeIndex', type: 'uint256' },
          { name: 'side', type: 'string' },
          { name: 'price', type: 'uint256' },
          { name: 'quantity', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      };

      const message = {
        marketId: market.marketId,
        outcomeIndex: selectedOutcome,
        side: orderSide,
        price: effectivePrice,
        quantity: shares,
        nonce,
      };

      // User signs with Magic Link (MPC signature)
      toast.info('Please sign the order...');
      const signature = await signTypedDataWithMagic(domain, types, message);

      // Send signed order to backend
      const response = await fetch('/api/clob/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          marketId: market.marketId,
          outcomeIndex: selectedOutcome,
          side: orderSide,
          price: effectivePrice,
          quantity: shares,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Order placement failed');
      }

      toast.success('Order placed successfully');
      setAmount('');
    } catch (error) {
      console.error('Order placement error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setIsPlacing(false);
    }
  };

  return { handlePlaceOrder, wallet };
}
