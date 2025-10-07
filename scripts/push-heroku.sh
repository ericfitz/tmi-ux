#!/bin/zsh

# Heroku Container Deployment Script
# Builds the Docker container and deploys to Heroku
# Note: Version bumping now happens automatically via prepare-commit-msg hook

set -e  # Exit on any error

echo "🚀 Starting Heroku deployment process..."
echo ""

echo "🐳 Building and pushing Docker container..."
heroku container:push web --app=tmi-ux

echo ""
echo "🚢 Releasing container to Heroku..."
heroku container:release web --app=tmi-ux

echo ""
echo "✨ Deployment complete!"
