#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm ci

# Fix Metro watcher issue — some packages ship without their dist directory
mkdir -p node_modules/@emnapi/runtime/dist

echo "Database migrations are a separate, reviewed operation. None were run."

echo "=== Post-merge setup complete ==="
