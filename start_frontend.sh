#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting Smart Academic Platform Frontend ==="

# Clean Next.js build cache if requested/stale
if [ -d "frontend/.next" ]; then
    echo "Cleaning Next.js build cache..."
    rm -rf "frontend/.next"
fi

cd frontend

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting Next.js Dev Server on http://localhost:3000..."
npm run dev
