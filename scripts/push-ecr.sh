#!/bin/bash

# AWS ECR Container Deployment Script
# Builds the Docker container using Chainguard base images and pushes to AWS ECR.
# The image is built for linux/amd64 (required by EKS Fargate).
#
# Usage:
#   ./scripts/push-ecr.sh [tag]
#
# Prerequisites:
#   - AWS CLI installed and configured with credentials for account 706702818127
#   - Docker installed and running
#
# Examples:
#   ./scripts/push-ecr.sh             # Push as tmi-ux:latest
#   ./scripts/push-ecr.sh v1.2.0      # Push as tmi-ux:v1.2.0

set -euo pipefail

REGION="us-east-1"
ACCOUNT_ID="706702818127"
REPO_NAME="tmi-ux"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_TAG="${1:-latest}"
ECR_IMAGE="${ECR_REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

echo "=== TMI-UX AWS ECR Deployment ==="
echo ""
echo "Registry:  ${ECR_REGISTRY}"
echo "Image:     ${ECR_IMAGE}"
echo ""

# Verify prerequisites
if ! command -v docker &> /dev/null; then
  echo "Error: docker is not installed or not in PATH"
  exit 1
fi

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

# Authenticate Docker to ECR
echo "Authenticating with ECR..."
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ECR_REGISTRY}"
echo ""

APP_VERSION=$(node -p "require('./package.json').version")

echo "Building Docker image for linux/amd64 (version: ${APP_VERSION})..."
docker build \
  --platform linux/amd64 \
  --build-arg APP_VERSION="${APP_VERSION}" \
  -f Dockerfile.chainguard \
  -t "${REPO_NAME}:${IMAGE_TAG}" \
  .
echo ""

echo "Tagging and pushing to ECR..."
docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_IMAGE}"
docker push "${ECR_IMAGE}"

echo ""
echo "=== Deployment complete ==="
echo "Image: ${ECR_IMAGE}"
