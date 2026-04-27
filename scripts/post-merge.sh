#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Running database migrations..."
tsx scripts/migrate.ts

echo "=== Post-merge setup complete ==="
