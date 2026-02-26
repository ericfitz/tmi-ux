#!/bin/bash

# Chainguard Container Deployment Script
# Builds the Docker container using Chainguard base images and pushes to a registry.
#
# Usage:
#   ./scripts/push-chainguard.sh [tag]
#
# Environment variables:
#   TMI_REGISTRY  - Container registry (default: ghcr.io)
#   TMI_REPO      - Repository name (default: ericfitz/tmi-ux)
#
# Examples:
#   ./scripts/push-chainguard.sh                    # Push as ghcr.io/ericfitz/tmi-ux:latest
#   ./scripts/push-chainguard.sh v1.2.0             # Push as ghcr.io/ericfitz/tmi-ux:v1.2.0
#   TMI_REGISTRY=docker.io ./scripts/push-chainguard.sh  # Push to Docker Hub

set -e

REGISTRY="${TMI_REGISTRY:-ghcr.io}"
REPO_NAME="${TMI_REPO:-ericfitz/tmi-ux}"
IMAGE_TAG="${1:-latest}"
FULL_IMAGE_NAME="${REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

echo "=== TMI-UX Chainguard Container Deployment ==="
echo ""
echo "Registry:  ${REGISTRY}"
echo "Image:     ${FULL_IMAGE_NAME}"
echo ""

# Verify Docker is available
if ! command -v docker &> /dev/null; then
  echo "Error: docker is not installed or not in PATH"
  exit 1
fi

APP_VERSION=$(node -p "require('./package.json').version")

echo "Building Docker image with Chainguard base (version: ${APP_VERSION})..."
docker build --build-arg APP_VERSION="${APP_VERSION}" -f Dockerfile.chainguard -t "${FULL_IMAGE_NAME}" .

echo ""
echo "Pushing image to registry..."
docker push "${FULL_IMAGE_NAME}"

echo ""
echo "=== Deployment complete ==="
echo "Image: ${FULL_IMAGE_NAME}"
echo ""
echo "Run locally with runtime configuration:"
echo "  docker run -p 8080:8080 \\"
echo "    -e TMI_API_URL=https://your-api.example.com \\"
echo "    -e TMI_OPERATOR_NAME=\"Your Organization\" \\"
echo "    ${FULL_IMAGE_NAME}"
