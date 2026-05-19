/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use SWC minifier and enable module transpilation optimizations
  swcMinify: true,
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
    'd3': {
      transform: 'd3-{{member}}',
      skipDefaultConversion: true,
    },
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      'ethers',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Security headers for mainnet deployment
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // Only allow scripts from our own origin and Clerk
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.predensity.com https://accounts.predensity.com https://challenges.cloudflare.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              // Clerk uses blob: workers for token polling
              "worker-src 'self' blob: https://clerk.predensity.com",
              // Images from our domain, Clerk avatars, data URIs, ibb.co, and WalletConnect wallet icons
              "img-src 'self' data: blob: https://*.clerk.accounts.dev https://clerk.predensity.com https://accounts.predensity.com https://img.clerk.com https://i.ibb.co https://assets.coingecko.com https://registry.walletconnect.com https://explorer-api.walletconnect.com https://*.walletconnect.com https://*.googleapis.com https://*.gravatar.com https://*.googleusercontent.com",
              // Connect to our API, Convex, Clerk, Hedera mirror nodes, CoinGecko, OpenRouter, Safaricom, WalletConnect
              "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://clerk.predensity.com https://accounts.predensity.com https://*.mirrornode.hedera.com https://api.coingecko.com https://openrouter.ai https://sandbox.safaricom.co.ke https://api.safaricom.co.ke https://mainnet.hashio.io https://testnet.hashio.io https://explorer-api.walletconnect.com wss://*.walletconnect.com wss://*.walletconnect.org https://*.walletconnect.com https://relay.walletconnect.com https://relay.walletconnect.org https://clerk-telemetry.com https://va.vercel-scripts.com https://cdn.jsdelivr.net https://unpkg.com https://metamask-sdk.api.cx.metamask.io",
              // Frames for Clerk auth
              "frame-src 'self' https://*.clerk.accounts.dev https://clerk.predensity.com https://accounts.predensity.com https://challenges.cloudflare.com https://verify.walletconnect.com https://verify.walletconnect.org",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            // Prevent MIME type sniffing
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Prevent clickjacking
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Control referrer information
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Enforce HTTPS
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Restrict browser features
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
