#!/usr/bin/env node

/**
 * Leaderboard Route Setup Script
 * 
 * This script automates the creation of the leaderboard route directory and page file.
 * Usage: node setup-leaderboard.js [--force]
 * 
 * Options:
 *   --force  Overwrite existing page.tsx if it exists
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const forceFlag = args.includes('--force');

// Paths
const rootDir = path.resolve(__dirname);
const leaderboardDir = path.join(rootDir, 'frontend', 'src', 'app', 'leaderboard');
const pageFilePath = path.join(leaderboardDir, 'page.tsx');

// Page content
const pageContent = `'use client';

import { Header } from '@/components/header';
import { LeaderboardComponent } from '@/components/leaderboard-page';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <LeaderboardComponent />
      </main>
    </div>
  );
}
`;

async function setupLeaderboard() {
  console.log('🚀 Setting up leaderboard route...\n');

  try {
    // Step 1: Check if directory exists
    if (fs.existsSync(leaderboardDir)) {
      console.log(`✅ Directory already exists: ${leaderboardDir}`);
    } else {
      // Create directory recursively
      fs.mkdirSync(leaderboardDir, { recursive: true });
      console.log(`✅ Created directory: ${leaderboardDir}`);
    }

    // Step 2: Check if page.tsx exists
    if (fs.existsSync(pageFilePath)) {
      if (!forceFlag) {
        console.log(`\n⚠️  File already exists: ${pageFilePath}`);
        console.log('Use --force flag to overwrite: node setup-leaderboard.js --force\n');
        process.exit(0);
      }
      console.log(`⚠️  Overwriting existing file: ${pageFilePath}`);
    }

    // Step 3: Write page.tsx
    fs.writeFileSync(pageFilePath, pageContent, 'utf-8');
    console.log(`✅ Created file: ${pageFilePath}`);

    // Step 4: Verify
    const stats = fs.statSync(pageFilePath);
    console.log(`✅ File size: ${stats.size} bytes`);

    console.log('\n✨ Leaderboard route setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your dev server: npm run dev (or npx convex dev)');
    console.log('2. Navigate to http://localhost:3000/leaderboard');
    console.log('3. Verify leaderboard loads correctly\n');

  } catch (error) {
    console.error('\n❌ Error during setup:\n');
    console.error(error.message);
    console.error('\nPlease ensure:');
    console.error('- You\'re running this script from the repo root');
    console.error('- Node.js has write permissions to the frontend directory');
    console.error('- The frontend/src/app directory exists\n');
    process.exit(1);
  }
}

setupLeaderboard();
