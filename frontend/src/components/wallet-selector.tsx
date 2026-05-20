'use client';

import React, { useState } from 'react';
import { useWallet, useAccountId, useBalance } from '@buidlerlabs/hashgraph-react-wallets';
import HashpackConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/HashpackConnector';
import BladeConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/BladeConnector';
import KabilaConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/KabilaConnector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, ChevronDown, User, Check, Coins } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { getStakingCurrency } from '@/lib/contracts/contract-config';

// MetamaskConnector and HWCConnector are excluded — they pull in
// @walletconnect/ethereum-provider → @reown/appkit → valtio (broken in Next.js 14).
// EVM wallets are handled via EIP-6963 in auth-modal instead.
type WalletType = 'hashpack' | 'blade' | 'kabila';

interface WalletOption {
  name: string;
  type: WalletType;
  icon: string;
  description: string;
  connector: any;
}

const walletOptions: WalletOption[] = [
  {
    name: 'HashPack',
    type: 'hashpack',
    icon: '🟣',
    description: 'Hedera native wallet',
    connector: HashpackConnector,
  },
  {
    name: 'Blade',
    type: 'blade',
    icon: '⚔️',
    description: 'Hedera native wallet',
    connector: BladeConnector,
  },
  {
    name: 'Kabila',
    type: 'kabila',
    icon: '🔗',
    description: 'Hedera wallet',
    connector: KabilaConnector,
  },
];

export function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isConnected, disconnect, connector } = useWallet();
  const { data: accountId } = useAccountId();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: false });

  const balance = React.useMemo(() => {
    if (!balanceData) return null;
    if (typeof balanceData === 'object' && 'hbars' in balanceData) return (balanceData as any).hbars.toString();
    if (typeof balanceData === 'object' && 'value' in balanceData) return (balanceData as any).value.toString();
    return balanceData.toString();
  }, [balanceData]);

  const hashpackWallet = useWallet(HashpackConnector);
  const bladeWallet = useWallet(BladeConnector);
  const kabilaWallet = useWallet(KabilaConnector);

  const wallets: Record<WalletType, any> = {
    hashpack: hashpackWallet,
    blade: bladeWallet,
    kabila: kabilaWallet,
  };

  const handleWalletSelect = async (walletOption: WalletOption) => {
    setIsOpen(false);
    try {
      await wallets[walletOption.type].connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try { await disconnect(); } catch (error) { console.error('Failed to disconnect wallet:', error); }
  };

  const handleCopyAddress = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getWalletType = (): WalletType | null => {
    if (!connector) return null;
    const name = connector.constructor?.name?.toLowerCase() || '';
    if (name.includes('hashpack')) return 'hashpack';
    if (name.includes('blade')) return 'blade';
    if (name.includes('kabila')) return 'kabila';
    return null;
  };

  const currentWalletOption = walletOptions.find((w) => w.type === getWalletType());

  const formatBalance = (bal: string | null) => {
    const sym = getStakingCurrency().symbol;
    if (!bal) return `0 ${sym}`;
    const n = parseFloat(bal);
    return n >= 1000 ? `${(n / 1000).toFixed(2)}k ${sym}` : `${n.toFixed(2)} ${sym}`;
  };

  if (isConnected) {
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
              <span className="text-xs">{formatBalance(balance)}</span>
            </div>
          )}
        </Button>
        {accountId && (
          <Button variant="outline" size="sm" className="flex items-center space-x-2 bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-light-gray hover:bg-gray-200 dark:hover:bg-neutral-700" onClick={handleCopyAddress}>
            <User className="w-3 h-3" />
            <span className="text-xs font-mono">{formatAddress(accountId, 4)}</span>
            {copied && <Check className="w-3 h-3 text-green-400" />}
          </Button>
        )}
        {currentWalletOption && (
          <Button variant="outline" size="sm" className="flex items-center space-x-2 border-vibrant-purple text-vibrant-purple">
            <span className="text-sm">{currentWalletOption.icon}</span>
            <span className="text-xs font-medium">{currentWalletOption.name}</span>
          </Button>
        )}
        <Button onClick={handleDisconnect} variant="outline" size="sm">Disconnect</Button>
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
          <DialogDescription>Select a Hedera wallet to connect.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {walletOptions.map((wallet) => (
            <Button key={wallet.name} variant="outline" className="justify-start h-auto p-4" onClick={() => handleWalletSelect(wallet)}>
              <div className="flex items-center space-x-3 w-full">
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{wallet.name}</span>
                  <span className="text-sm text-muted-foreground">{wallet.description}</span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
