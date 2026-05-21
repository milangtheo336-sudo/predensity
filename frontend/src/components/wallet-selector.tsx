'use client';

import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, ChevronDown, User, Copy, Check, Coins } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { getStakingCurrency } from '@/lib/contracts/contract-config';

export function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ address });

  const handleConnect = (connector: (typeof connectors)[number]) => {
    setIsOpen(false);
    connect({ connector });
  };

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatBal = (val: bigint | undefined, decimals: number) => {
    const sym = getStakingCurrency().symbol;
    if (!val) return `0 ${sym}`;
    const num = Number(val) / 10 ** decimals;
    return num >= 1000 ? `${(num / 1000).toFixed(2)}k ${sym}` : `${num.toFixed(2)} ${sym}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" className="border-vibrant-purple text-vibrant-purple">
          {balanceLoading ? (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <Coins className="w-3 h-3" />
              <span className="text-xs">{formatBal(balanceData?.value, balanceData?.decimals ?? 6)}</span>
            </div>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-light-gray hover:bg-gray-200 dark:hover:bg-neutral-700"
          onClick={handleCopyAddress}
        >
          <User className="w-3 h-3" />
          <span className="text-xs font-mono">{formatAddress(address, 4)}</span>
          {copied && <Check className="w-3 h-3 text-green-400" />}
        </Button>

        {activeConnector && (
          <Button variant="outline" size="sm" className="flex items-center space-x-2 border-vibrant-purple text-vibrant-purple">
            <span className="text-xs font-medium">{activeConnector.name}</span>
          </Button>
        )}

        <Button onClick={() => disconnect()} variant="outline" size="sm">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your wallet</DialogTitle>
          <DialogDescription>Select a wallet provider to connect to Arc.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {connectors.map((connector) => (
            <Button
              key={connector.uid}
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => handleConnect(connector)}
            >
              <div className="flex items-center space-x-3 w-full">
                <Wallet className="w-6 h-6" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{connector.name}</span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
