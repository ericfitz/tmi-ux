#!/bin/zsh

# Heroku Container Deployment Script
# This script bumps the version, builds the Docker container, and deploys to Heroku

set -e  # Exit on any error

echo "🚀 Starting Heroku deployment process..."
echo ""

# Step 1: Bump version
echo "📦 Bumping version..."
./node_modules/.bin/tsx scripts/version-bump.ts

if [ $? -ne 0 ]; then
  echo "❌ Version bump failed. Aborting deployment."
  exit 1
fi

echo ""
echo "🐳 Building and pushing Docker container..."
heroku container:push web --app=tmi-ux

echo ""
echo "🚢 Releasing container to Heroku..."
heroku container:release web --app=tmi-ux

echo ""
echo "✨ Deployment complete!"
