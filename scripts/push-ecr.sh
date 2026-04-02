#!/bin/bash

# AWS ECR Container Deployment Script
# Builds the container using Chainguard base images and pushes to AWS ECR.
# The image is built for linux/amd64 (required by EKS Fargate).
#
# Usage:
#   ./scripts/push-ecr.sh [options]
#
# Options:
#   --tag TAG               Image tag (default: latest)
#   --runtime docker|podman Container runtime (auto-detected if omitted)
#   --help                  Show this help message
#
# Prerequisites:
#   - AWS CLI installed and configured with credentials for account 706702818127
#   - Docker or Podman installed and running
#
# Examples:
#   ./scripts/push-ecr.sh             # Push as tmi-ux:latest
#   ./scripts/push-ecr.sh --tag v1.2.0  # Push as tmi-ux:v1.2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REGION="us-east-1"
ACCOUNT_ID="706702818127"
REPO_NAME="tmi-ux"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
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

ECR_IMAGE="${ECR_REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

# Resolve container runtime
source "${SCRIPT_DIR}/lib/container-runtime.sh"
resolve_container_runtime

echo "=== TMI-UX AWS ECR Deployment ==="
echo ""
echo "Runtime:   ${CONTAINER_RUNTIME}"
echo "Registry:  ${ECR_REGISTRY}"
echo "Image:     ${ECR_IMAGE}"
echo ""

# Verify prerequisites
if ! command -v aws &> /dev/null; then
  echo "Error: AWS CLI is not installed or not in PATH"
  echo "Install it from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

# Create ECR repository if it doesn't exist
echo "Ensuring ECR repository exists..."
aws ecr describe-repositories \
  --repository-names "${REPO_NAME}" \
  --region "${REGION}" &>/dev/null || \
aws ecr create-repository \
  --repository-name "${REPO_NAME}" \
  --region "${REGION}" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Authenticate with ECR
echo "Authenticating with ECR..."
aws ecr get-login-password --region "${REGION}" | \
  $CONTAINER_RUNTIME login --username AWS --password-stdin "${ECR_REGISTRY}"
echo ""

APP_VERSION=$(node -p "require('./package.json').version")

# Generate build-info.json on host (git not available inside container build)
sh scripts/generate-build-info.sh

echo "Building container image for linux/amd64 (version: ${APP_VERSION})..."
read -ra _rt_flags <<< "$(container_build_flags)"
$CONTAINER_RUNTIME build \
  --platform linux/amd64 \
  --build-arg APP_VERSION="${APP_VERSION}" \
  "${_rt_flags[@]}" \
  -f Dockerfile.chainguard \
  -t "${REPO_NAME}:${IMAGE_TAG}" \
  .
echo ""

echo "Tagging and pushing to ECR..."
$CONTAINER_RUNTIME tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_IMAGE}"
$CONTAINER_RUNTIME push "${ECR_IMAGE}"

echo ""
echo "=== Deployment complete ==="
echo "Image: ${ECR_IMAGE}"
