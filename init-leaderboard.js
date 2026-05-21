#!/usr/bin/env node

/**
 * Quick script to initialize missing user stats for existing users.
 * This calls the leaderboard repair mutation via Convex CLI.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Initializing missing user stats...\n');

// Run via npx convex
const convexBin = path.join(__dirname, 'node_modules', '.bin', 'convex');

const proc = spawn('npx', ['convex', 'run', 'leaderboard:initializeAllMissingUserStats'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit',
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Done! Users should now appear on the leaderboard.');
  } else {
    console.log(`\n❌ Error: Process exited with code ${code}`);
  }
  process.exit(code);
});
