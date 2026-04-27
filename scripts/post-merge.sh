#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps

# Fix Metro watcher issue — some packages ship without their dist directory
mkdir -p node_modules/@emnapi/runtime/dist

echo "Running database migrations..."
tsx scripts/migrate.ts

echo "=== Post-merge setup complete ==="
