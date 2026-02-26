#!/bin/zsh

# Heroku Container Deployment Script
# Builds the Docker container and deploys to Heroku
# Note: Version bumping now happens automatically via prepare-commit-msg hook

set -e  # Exit on any error

echo "🚀 Starting Heroku deployment process..."
echo ""

echo "🔐 Authenticating with Heroku container registry..."
docker login --username=_ --password=$(heroku auth:token) registry.heroku.com 2>&1 | grep -v "WARNING"
echo ""

APP_VERSION=$(node -p "require('./package.json').version")
HEROKU_IMAGE="registry.heroku.com/tmi-ux/web"

echo "🐳 Building Docker container (version: ${APP_VERSION})..."
docker build --platform linux/amd64 --provenance=false --build-arg APP_VERSION="${APP_VERSION}" -t "${HEROKU_IMAGE}" .

echo ""
echo "📤 Pushing Docker container to Heroku registry..."
docker push "${HEROKU_IMAGE}"

echo ""
echo "🚢 Releasing container to Heroku..."
heroku container:release web --app=tmi-ux

echo ""
echo "✨ Deployment complete!"
