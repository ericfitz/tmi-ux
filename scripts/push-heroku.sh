#!/bin/bash

# Heroku Container Deployment Script
# Builds the container and deploys to Heroku.
# Note: Version bumping now happens automatically via prepare-commit-msg hook
#
# Usage:
#   ./scripts/push-heroku.sh [options]
#
# Options:
#   --runtime docker|podman   Container runtime (auto-detected if omitted)
#   --help                    Show this help message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_RUNTIME=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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

# Resolve container runtime
source "${SCRIPT_DIR}/lib/container-runtime.sh"
resolve_container_runtime

echo "Starting Heroku deployment process..."
echo "Using container runtime: ${CONTAINER_RUNTIME}"
echo ""

echo "Authenticating with Heroku container registry..."
$CONTAINER_RUNTIME login --username=_ --password=$(heroku auth:token) registry.heroku.com
echo ""

APP_VERSION=$(node -p "require('./package.json').version")
HEROKU_IMAGE="registry.heroku.com/tmi-ux/web"

# Generate build-info.json on host (git not available inside container build)
sh scripts/generate-build-info.sh

echo "Building container (version: ${APP_VERSION})..."
read -ra _rt_flags <<< "$(container_build_flags)"
$CONTAINER_RUNTIME build --no-cache --platform linux/amd64 "${_rt_flags[@]}" --build-arg APP_VERSION="${APP_VERSION}" -t "${HEROKU_IMAGE}" .

echo ""
echo "Pushing container to Heroku registry..."
$CONTAINER_RUNTIME push "${HEROKU_IMAGE}"

echo ""
echo "Releasing container to Heroku..."
heroku container:release web --app=tmi-ux

echo ""
echo "Deployment complete!"
