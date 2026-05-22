/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use SWC minifier and enable module transpilation optimizations
  swcMinify: true,

  // Transpile ESM-only packages that cause issues with Next.js bundler
  transpilePackages: [
    '@walletconnect/modal',
    '@walletconnect/sign-client',
    '@walletconnect/ethereum-provider',
    'derive-valtio',
  ],

  webpack: (config, { isServer }) => {
    // Fix: @walletconnect/ethereum-provider has a nested copy of @reown/appkit
    // which requires valtio/vanilla* but can't resolve it through Next.js.
    // We use NormalModuleReplacementPlugin to intercept any require of valtio
    // subpaths from within the nested node_modules and redirect to the top-level.
    const path = require('path');
    const valtioRoot = path.dirname(require.resolve('valtio/package.json'));

    config.plugins.push(
      new (require('webpack').NormalModuleReplacementPlugin)(
        /valtio\/vanilla(\/utils)?$/,
        (resource) => {
          if (resource.request === 'valtio/vanilla') {
            resource.request = path.join(valtioRoot, 'vanilla.js');
          } else if (resource.request === 'valtio/vanilla/utils') {
            resource.request = path.join(valtioRoot, 'vanilla', 'utils.js');
          }
        }
      )
    );

    config.plugins.push(
      new (require('webpack').NormalModuleReplacementPlugin)(
        /derive-valtio/,
        (resource) => {
          // derive-valtio also needs valtio/vanilla — handled by the above plugin
          // but we also need to ensure derive-valtio itself resolves
        }
      )
    );

    return config;
  },
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
    // Disable CSP in development to avoid issues with Magic Link and other services
    if (process.env.NODE_ENV === 'development') {
      return [];
    }
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // Only allow scripts from our own origin and Magic Link
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.magic.link https://auth.magic.link https://challenges.cloudflare.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              // Magic uses blob: workers
              "worker-src 'self' blob:",
              // Images from our domain, data URIs, ibb.co, and WalletConnect wallet icons
              "img-src 'self' data: blob: https://i.ibb.co https://assets.coingecko.com https://registry.walletconnect.com https://explorer-api.walletconnect.com https://*.walletconnect.com https://*.googleapis.com https://*.gravatar.com https://*.googleusercontent.com https://img.clerk.com https://*.clerk.com",
              // Allow media (videos/audio) from own origin only
              "media-src 'self' blob:",
              // Connect to our API, Convex, Magic Link, Arc RPC, CoinGecko, OpenRouter, Safaricom, WalletConnect
              "connect-src 'self' 'unsafe-inline' https://*.magic.link https://*.magiclabs.com https://vercel.live https://cognito.us-west-2.amazonaws.com https://kms.us-west-2.amazonaws.com https://cognito-identity.us-west-2.amazonaws.com https://*.hightouch-events.com/ https://browser-intake-datadoghq.com https://*.launchdarkly.com https://*.google.com https://*.alchemy.com https://*.infura.io https://relay.farcaster.xyz https://*.alchemyapi.io/ https://oauth.telegram.org/ https://rpc.sepolia.com https://*.base.org https://*.cronos.org https://*.onflow.org https://*.graffle.io https://*.fragmynt.network https://*.solidwallet.io https://*.hmny.io https://*.cryptonomic-infra.tech https://*.api.tez.ie https://ithacanet.ecadinfra.com https://ghostnet.tezos.marigold.dev wss://*.polkadot.io https://*.skalelabs.com https://*.skale.network https://*.skalenodes.com https://*.etherlink.com https://*.matic.today https://polygon-rpc.com https://*.polygon.technology https://*.rpc.rarichain.org https://*.solana.com https://*.zilliqa.com https://*.optimism.io https://alfajores-forno.celo-testnet.org https://forno.celo.org https://bsc-dataseed1.defibit.io https://*.moonbeam.network https://rpc.testnet.fantom.network https://rpc.ftm.tools https://*.arbitrum.io https://sepolia-rollup.arbitrum.io/rpc https://stage2-api.zksync.dev https://mainnet.era.zksync.io wss://mainnet.era.zksync.io https://*.era.zksync.dev wss://testnet.era.zksync.dev https://*.telos.net https://*.aurora.dev https://*.metis.io https://*.velas.com https://rpc.publicmint.io:8545 https://*.p2pify.com https://*.myhbarwallet.com https://gwan-ssl.wandevs.org:56891 https://*.aptoslabs.com https://*.hedera.com https://*.swirldslabs.com https://*.swirlds.com https://*.chainweb.com https://*.zetachain.com https://*.blockpi.network https://zetachain-rpc.lavenderfive.com https://zetachain-mainnet-archive.allthatnode.com:* wss://zetachain-mainnet-archive.allthatnode.com:* https://rpc.ankr.com/chiliz https://spicy-rpc.chiliz.com https://alphanet.stble.io https://*.stabilityprotocol.com https://*.paypal.com https://*.ankr.com https://*.rpc.thirdweb.com https://rpc.decentraland.org https://erpc.apothem.network https://erpc.xinfin.network https://api.avax.network/ https://api.avax-test.network/ https://*.rpc.scs.startale.com https://*.plume.org https://rpc.morphl2.io https://rpc-hoodi.morphl2.io https://rpc-quicknode.morphl2.io https://*.convex.cloud wss://*.convex.cloud https://*.mirrornode.hedera.com https://api.coingecko.com https://openrouter.ai https://sandbox.safaricom.co.ke https://api.safaricom.co.ke https://mainnet.hashio.io https://testnet.hashio.io https://*.hashio.io https://explorer-api.walletconnect.com wss://*.walletconnect.com wss://*.walletconnect.org https://*.walletconnect.com https://relay.walletconnect.com https://relay.walletconnect.org https://va.vercel-scripts.com https://cdn.jsdelivr.net https://unpkg.com https://metamask-sdk.api.cx.metamask.io https://ipapi.co https://pulse.walletconnect.org",
              // Frames for Magic Link auth
              "frame-src 'self' https://*.magic.link https://auth.magic.link https://challenges.cloudflare.com https://verify.walletconnect.com https://verify.walletconnect.org",
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
