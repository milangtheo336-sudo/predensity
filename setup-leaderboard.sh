#!/bin/bash

# Leaderboard Route Setup Script (Bash)
# 
# This script automates the creation of the leaderboard route directory and page file.
# Usage: bash setup-leaderboard.sh [--force]
# 
# Options:
#   --force  Overwrite existing page.tsx if it exists

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LEADERBOARD_DIR="$SCRIPT_DIR/frontend/src/app/leaderboard"
PAGE_FILE_PATH="$LEADERBOARD_DIR/page.tsx"

# Check for --force flag
FORCE_FLAG=false
if [[ "$1" == "--force" ]]; then
    FORCE_FLAG=true
fi

# Page content
read -r -d '' PAGE_CONTENT << 'EOF' || true
'use client';

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
EOF

echo -e "${CYAN}🚀 Setting up leaderboard route...${NC}\n"

{
    # Step 1: Check if directory exists
    if [ -d "$LEADERBOARD_DIR" ]; then
        echo -e "${GREEN}✅ Directory already exists: $LEADERBOARD_DIR${NC}"
    else
        # Create directory
        mkdir -p "$LEADERBOARD_DIR"
        echo -e "${GREEN}✅ Created directory: $LEADERBOARD_DIR${NC}"
    fi

    # Step 2: Check if page.tsx exists
    if [ -f "$PAGE_FILE_PATH" ]; then
        if [ "$FORCE_FLAG" != true ]; then
            echo -e "\n${YELLOW}⚠️  File already exists: $PAGE_FILE_PATH${NC}"
            echo -e "${YELLOW}Use --force flag to overwrite: bash setup-leaderboard.sh --force${NC}\n"
            exit 0
        fi
        echo -e "${YELLOW}⚠️  Overwriting existing file: $PAGE_FILE_PATH${NC}"
    fi

    # Step 3: Write page.tsx
    echo "$PAGE_CONTENT" > "$PAGE_FILE_PATH"
    echo -e "${GREEN}✅ Created file: $PAGE_FILE_PATH${NC}"

    # Step 4: Verify
    FILE_SIZE=$(stat -f%z "$PAGE_FILE_PATH" 2>/dev/null || stat -c%s "$PAGE_FILE_PATH" 2>/dev/null)
    echo -e "${GREEN}✅ File size: $FILE_SIZE bytes${NC}"

    echo -e "\n${GREEN}✨ Leaderboard route setup completed successfully!${NC}\n"

    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Restart your dev server: npm run dev (or npx convex dev)"
    echo "2. Navigate to http://localhost:3000/leaderboard"
    echo "3. Verify leaderboard loads correctly"
    echo ""

} || {
    echo -e "\n${RED}❌ Error during setup:${NC}\n"
    echo -e "${RED}$@${NC}"
    echo -e "\n${YELLOW}Please ensure:${NC}"
    echo "- You're running this script from the repo root"
    echo "- Bash has write permissions to the frontend directory"
    echo "- The frontend/src/app directory exists"
    echo ""
    exit 1
}
