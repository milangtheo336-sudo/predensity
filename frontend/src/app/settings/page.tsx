'use client';

import React, { useState, useEffect } from 'react';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import { User, Shield, Bell, Copy, Check, Trash2, Camera } from 'lucide-react';
import Avatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { PageSkeleton } from '@/components/page-skeleton';

type Tab = 'profile' | 'account' | 'notifications';

export default function SettingsPage() {
  const { user, isLoading, logout } = useMagic();
  const { walletUser, clearWalletUser } = useWalletUser();
  const isSignedIn = !!user || !!walletUser;
  const isLoaded = !isLoading;
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  if (!isLoaded) {
    return <PageSkeleton rows={4} />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Sign in to access settings.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'account', label: 'Account', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-vibrant-purple text-vibrant-purple'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'profile' && (
          user
            ? <ProfileTab user={user} />
            : <WalletProfileTab walletUser={walletUser!} />
        )}
        {activeTab === 'account' && (
          <AccountTab
            user={user}
            logout={user ? logout : async () => { clearWalletUser(); }}
          />
        )}
        {activeTab === 'notifications' && <NotificationsTab />}
      </main>
    </div>
  );
}

// Profile Tab for wallet-only users
function WalletProfileTab({ walletUser }: { walletUser: NonNullable<ReturnType<typeof useWalletUser>['walletUser']> }) {
  const { isConnected, address: accountId } = useAccount();
  const [copied, setCopied] = useState(false);
  const [copiedProxy, setCopiedProxy] = useState(false);
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const [loadingProxy, setLoadingProxy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const managedWallet = useQuery(
    api.users.getManagedWalletByUserId,
    walletUser.userId ? { userId: walletUser.userId } : 'skip'
  );

  const displayAddress = managedWallet?.evmAddress || walletUser.publicAddress;

  useEffect(() => {
    const fetchProxyWallet = async () => {
      if (!displayAddress || displayAddress.startsWith('0.0.')) return;

      try {
        const cached = localStorage.getItem(`predensity_proxy_wallet_${displayAddress}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp < 86400000) {
            setProxyWalletAddress(data.proxyWallet);
            return;
          }
        }
      } catch (e) {
        console.error('[settings] Cache read error:', e);
      }

      setLoadingProxy(true);
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${displayAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          localStorage.setItem(
            `predensity_proxy_wallet_${displayAddress}`,
            JSON.stringify({ proxyWallet: data.proxyWalletAddress, timestamp: Date.now() })
          );
        }
      } catch (error) {
        console.error('[settings] Failed to fetch proxy wallet:', error);
      } finally {
        setLoadingProxy(false);
      }
    };

    fetchProxyWallet();
  }, [displayAddress]);

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Profile Avatar</h3>
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-[#0a0a0c]">
            <Avatar size={80} name={walletUser.publicAddress} variant="marble" colors={getAvatarPalette(walletUser.publicAddress)} square={false} />
          </div>
        </CardContent>
      </Card>

      {/* Wallet type */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Auth Method</h3>
          <p className="text-sm capitalize">{
            walletUser.walletType === 'metamask' ? 'MetaMask' :
            walletUser.walletType === 'walletconnect' ? 'WalletConnect' :
            walletUser.walletType === 'hashpack' ? 'HashPack' :
            walletUser.walletType === 'blade' ? 'Blade' :
            walletUser.walletType
          } Wallet</p>
        </CardContent>
      </Card>

      {/* Proxy wallet address */}
      {proxyWalletAddress && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Wallet Address</h3>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">
                {proxyWalletAddress}
              </code>
              <button
                onClick={async () => { await navigator.clipboard.writeText(proxyWalletAddress); setCopiedProxy(true); setTimeout(() => setCopiedProxy(false), 2000); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy proxy wallet address"
              >
                {copiedProxy ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Send USDC to this address for gasless betting.
            </p>
          </CardContent>
        </Card>
      )}
      {loadingProxy && !proxyWalletAddress && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Wallet Address</h3>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {/* Advanced */}
      <Card>
        <CardContent className="p-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-sm font-medium text-muted-foreground">Advanced</h3>
            <span className="text-xs text-muted-foreground">{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Connected Wallet Address</h4>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                    {walletUser.publicAddress}
                  </code>
                  <button
                    onClick={async () => { await navigator.clipboard.writeText(walletUser.publicAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy wallet address"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {walletUser.hederaAccountId && walletUser.hederaAccountId !== walletUser.publicAddress && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Account ID</h4>
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                    {walletUser.hederaAccountId}
                  </code>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Profile Tab for Magic users
function ProfileTab({ user }: { user: any }) {
  const { isConnected, address: accountId } = useAccount();
  const [bio, setBio] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedProxy, setCopiedProxy] = useState(false);
  const [copiedMagic, setCopiedMagic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const [loadingProxy, setLoadingProxy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const managedWallet = useQuery(
    api.users.getManagedWalletByUserId,
    user ? { userId: user.issuer } : 'skip'
  );

  const magicLinkAddress = managedWallet?.evmAddress || user?.publicAddress;
  const displayAddress = isConnected && accountId ? accountId : magicLinkAddress;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyProxy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedProxy(true);
    setTimeout(() => setCopiedProxy(false), 2000);
  };

  const handleCopyMagic = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMagic(true);
    setTimeout(() => setCopiedMagic(false), 2000);
  };

  useEffect(() => {
    const fetchProxyWallet = async () => {
      if (!magicLinkAddress) return;
      if (magicLinkAddress.startsWith('0.0.')) return;

      try {
        const cached = localStorage.getItem(`predensity_proxy_wallet_${magicLinkAddress}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp < 86400000) {
            setProxyWalletAddress(data.proxyWallet);
            setLoadingProxy(false);
            return;
          }
        }
      } catch (e) {
        console.error('[settings] Cache read error:', e);
      }

      setLoadingProxy(true);
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${magicLinkAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          localStorage.setItem(
            `predensity_proxy_wallet_${magicLinkAddress}`,
            JSON.stringify({ proxyWallet: data.proxyWalletAddress, timestamp: Date.now() })
          );
        }
      } catch (error) {
        console.error('[settings] Failed to fetch proxy wallet:', error);
      } finally {
        setLoadingProxy(false);
      }
    };

    fetchProxyWallet();
  }, [magicLinkAddress]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      await user.setProfileImage({ file });
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, bio } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save bio failed:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (user?.unsafeMetadata?.bio) {
      setBio(user.unsafeMetadata.bio as string);
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Profile Avatar</h3>
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-[#0a0a0c]">
                {user.imageUrl && !user.imageUrl.includes('gravatar') ? (
                  <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Avatar size={80} name={user.issuer} variant="marble" colors={getAvatarPalette(user.issuer)} square={false} />
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try { await user.setProfileImage({ file }); } catch (err) { console.error('Avatar upload failed:', err); }
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Email</h3>
          <p className="text-sm">{user.email || 'No email set'}</p>
        </CardContent>
      </Card>

      {proxyWalletAddress && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Wallet Address</h3>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">{proxyWalletAddress}</code>
              <button onClick={() => handleCopyProxy(proxyWalletAddress)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Copy proxy wallet address">
                {copiedProxy ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Send USDC to this address for gasless betting. Funds are held in your smart contract wallet.</p>
          </CardContent>
        </Card>
      )}
      {loadingProxy && !proxyWalletAddress && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Wallet Address</h3>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-between w-full text-left">
            <h3 className="text-sm font-medium text-muted-foreground">Advanced</h3>
            <span className="text-xs text-muted-foreground">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Signing Key Address (Magic Link)</h4>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{magicLinkAddress || 'Not available'}</code>
                  {magicLinkAddress && (
                    <button onClick={() => handleCopyMagic(magicLinkAddress)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Copy Magic Link address">
                      {copiedMagic ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="text-xs text-red-400 mt-1">⚠️ Used for authentication only. Do not send funds to this address.</p>
              </div>
              {isConnected && accountId && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Connected External Wallet</h4>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{accountId}</code>
                    <button onClick={() => handleCopy(accountId)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Copy connected wallet address">
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">External wallet connected for deposits only</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Bio</h3>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            maxLength={280}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{bio.length}/280</span>
            <Button size="sm" onClick={handleSaveBio} disabled={saving} className={saved ? 'bg-green-600 hover:bg-green-600 text-white' : 'bg-vibrant-purple hover:bg-vibrant-purple/90 text-white'}>
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Account Tab
function AccountTab({ user, logout }: { user: any; logout: () => Promise<void> }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await logout();
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <CardContent className="p-6 opacity-60">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Enable 2FA</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-vibrant-purple/20 text-vibrant-purple">Coming Soon</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Add an extra layer of security to your account using an authenticator app</p>
            </div>
            <button disabled className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted cursor-not-allowed" role="switch" aria-checked={false} aria-label="Toggle two-factor authentication">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Only show delete account for Magic users */}
      {user && (
        <Card className="border-red-500/20">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-red-400">Delete Account</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Permanently delete your account. This action cannot be undone.</p>
            {!showDeleteConfirm ? (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Account
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-sm text-red-400 mb-3">Are you sure? All your data, bets, and wallet will be permanently deleted.</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleDeleteAccount} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                    {deleting ? 'Deleting...' : 'Yes, delete my account'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Notifications Tab
function NotificationsTab() {
  const [betResults, setBetResults] = useState(true);
  const [deposits, setDeposits] = useState(true);
  const [marketUpdates, setMarketUpdates] = useState(false);
  const [promotions, setPromotions] = useState(false);

  const toggles = [
    { id: 'bet-results', label: 'Bet Results', desc: 'Get notified when your bets are resolved', value: betResults, onChange: setBetResults },
    { id: 'deposits', label: 'Deposits & Withdrawals', desc: 'Notifications for M-Pesa and wallet transactions', value: deposits, onChange: setDeposits },
    { id: 'market-updates', label: 'Market Updates', desc: 'New markets and significant price movements', value: marketUpdates, onChange: setMarketUpdates },
    { id: 'promotions', label: 'Promotions', desc: 'Special offers and platform announcements', value: promotions, onChange: setPromotions },
  ];

  return (
    <div className="space-y-1">
      {toggles.map((toggle) => (
        <Card key={toggle.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">{toggle.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{toggle.desc}</p>
              </div>
              <button
                onClick={() => toggle.onChange(!toggle.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-vibrant-purple focus:ring-offset-2 focus:ring-offset-background ${toggle.value ? 'bg-vibrant-purple' : 'bg-muted'}`}
                role="switch"
                aria-checked={toggle.value}
                aria-label={`Toggle ${toggle.label}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggle.value ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
