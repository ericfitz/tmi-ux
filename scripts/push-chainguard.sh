#!/bin/bash

# Chainguard Container Deployment Script
# Builds the container using Chainguard base images and pushes to a registry.
#
# Usage:
#   ./scripts/push-chainguard.sh [options]
#
# Options:
#   --tag TAG               Image tag (default: latest)
#   --runtime docker|podman Container runtime (auto-detected if omitted)
#   --help                  Show this help message
#
# Environment variables:
#   TMI_REGISTRY  - Container registry (default: ghcr.io)
#   TMI_REPO      - Repository name (default: ericfitz/tmi-ux)
#
# Examples:
#   ./scripts/push-chainguard.sh                    # Push as ghcr.io/ericfitz/tmi-ux:latest
#   ./scripts/push-chainguard.sh --tag v1.2.0       # Push as ghcr.io/ericfitz/tmi-ux:v1.2.0
#   TMI_REGISTRY=docker.io ./scripts/push-chainguard.sh  # Push to Docker Hub

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REGISTRY="${TMI_REGISTRY:-ghcr.io}"
REPO_NAME="${TMI_REPO:-ericfitz/tmi-ux}"
IMAGE_TAG="latest"
CONTAINER_RUNTIME=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            [[ $# -lt 2 ]] && { echo "Error: --tag requires a value" >&2; exit 1; }
            IMAGE_TAG="$2"
            shift 2
            ;;
        --runtime)
            [[ $# -lt 2 ]] && { echo "Error: --runtime requires a value" >&2; exit 1; }
            CONTAINER_RUNTIME="$2"
            shift 2
            ;;
        --help)
            sed -n '2,/^$/p' "$0" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

FULL_IMAGE_NAME="${REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

# Resolve container runtime
source "${SCRIPT_DIR}/lib/container-runtime.sh"
resolve_container_runtime

echo "=== TMI-UX Chainguard Container Deployment ==="
echo ""
echo "Runtime:   ${CONTAINER_RUNTIME}"
echo "Registry:  ${REGISTRY}"
echo "Image:     ${FULL_IMAGE_NAME}"
echo ""

APP_VERSION=$(node -p "require('./package.json').version")

# Generate build-info.json on host (git not available inside container build)
sh scripts/generate-build-info.sh

echo "Building container image with Chainguard base (version: ${APP_VERSION})..."
read -ra _rt_flags <<< "$(container_build_flags)"
$CONTAINER_RUNTIME build \
  --build-arg APP_VERSION="${APP_VERSION}" \
  "${_rt_flags[@]}" \
  -f Dockerfile.chainguard \
  -t "${FULL_IMAGE_NAME}" \
  .

echo ""
echo "Pushing image to registry..."
$CONTAINER_RUNTIME push "${FULL_IMAGE_NAME}"

echo ""
echo "=== Deployment complete ==="
echo "Image: ${FULL_IMAGE_NAME}"
echo ""
echo "Run locally with runtime configuration:"
echo "  ${CONTAINER_RUNTIME} run -p 8080:8080 \\"
echo "    -e TMI_API_URL=https://your-api.example.com \\"
echo "    -e TMI_OPERATOR_NAME=\"Your Organization\" \\"
echo "    ${FULL_IMAGE_NAME}"
