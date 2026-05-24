'use client';

import { useState, useEffect } from 'react';
import { useMagic } from '@/context/MagicContext';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export default function BotSetupPage() {
  const { user, isLoading } = useMagic();
  const [copied, setCopied] = useState(false);
  const [envContent, setEnvContent] = useState('');

  useEffect(() => {
    if (user) {
      const content = `# Market Maker Bot Configuration
# Copy this to: frontend/scripts/.env.market-maker

# Your Magic Link user ID (issuer)
MM_USER_ID=${user.issuer}

# Bot API key (must match BOT_API_KEY in .env.local)
BOT_API_KEY=predensity-bot-secret-key-change-in-production

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_URL=https://dynamic-anaconda-79.convex.cloud

# Market maker settings
MM_MARKET_IDS=
MM_MIN_SPREAD_BPS=50
MM_DEFAULT_SIZE=20
MM_MAX_EXPOSURE_USD=5000
MM_MAX_POSITION_PER_OUTCOME=500
MM_CANCEL_REPLACE_INTERVAL_MS=2000
`;
      setEnvContent(content);
    }
  }, [user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Bot Setup</h1>
            <p className="text-muted-foreground mb-8">
              Please sign in to get your bot configuration
            </p>
            <Button asChild>
              <a href="/auth">Sign In</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Bot Setup Configuration</h1>
          <p className="text-muted-foreground mb-8">
            Copy your bot configuration to run market maker bots
          </p>

          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Account Info</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <div className="font-mono text-sm mt-1">{user.email}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Public Address</label>
                  <div className="font-mono text-sm mt-1 break-all">{user.publicAddress}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">User ID (Issuer)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="font-mono text-sm break-all flex-1 bg-muted p-2 rounded">
                      {user.issuer}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(user.issuer)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Environment File */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Bot Environment File</h2>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(envContent)}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Save this as <code className="bg-muted px-2 py-1 rounded">frontend/scripts/.env.market-maker</code>
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {envContent}
              </pre>
            </div>

            {/* Instructions */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Copy the environment file content above</li>
                <li>Create file: <code className="bg-muted px-2 py-1 rounded">frontend/scripts/.env.market-maker</code></li>
                <li>Paste the content into the file</li>
                <li>Ensure your wallet has USDC balance (deposit via M-Pesa or transfer)</li>
                <li>Run the bot:
                  <pre className="bg-muted p-2 rounded mt-2 ml-6">
                    cd frontend{'\n'}
                    npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
                  </pre>
                </li>
              </ol>
            </div>

            {/* Security Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
                Security Note
              </h3>
              <p className="text-sm text-muted-foreground">
                The BOT_API_KEY is used to authenticate backend bots. Keep it secret and never expose it to the frontend.
                Change the default key in production.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
