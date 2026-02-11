#!/bin/bash

# OCI Container Registry Deployment Script
# Builds the Docker container and pushes to Oracle Cloud Infrastructure Container Registry
# Uses OCI CLI with session authentication (profile: tmi)

set -e

# Configuration
OCI_REGION="us-ashburn-1"
OCI_TENANCY_NAMESPACE="idqeh6gjpmoe"
OCI_REPO_NAME="tmi-ux"
OCI_PROFILE="tmi"
IMAGE_TAG="${1:-latest}"

REGISTRY="${OCI_REGION}.ocir.io"
FULL_IMAGE_NAME="${REGISTRY}/${OCI_TENANCY_NAMESPACE}/${OCI_REPO_NAME}:${IMAGE_TAG}"

echo "Starting OCI Container Registry deployment..."
echo ""
echo "Configuration:"
echo "  Registry: ${REGISTRY}"
echo "  Image: ${FULL_IMAGE_NAME}"
echo "  OCI Profile: ${OCI_PROFILE}"
echo ""

# Check if OCI CLI is installed
if ! command -v oci &> /dev/null; then
    echo "Error: OCI CLI is not installed or not in PATH"
    echo "Install it from: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
    exit 1
fi

# Verify OCI session is valid
echo "Verifying OCI session authentication..."
if ! oci session validate --profile "${OCI_PROFILE}" &> /dev/null; then
    echo "OCI session expired or invalid. Refreshing session..."
    oci session authenticate --profile-name "${OCI_PROFILE}" --region "${OCI_REGION}"
fi
echo ""

# Get auth token for Docker login
echo "Authenticating with OCI Container Registry..."
# OCI Container Registry uses the session token for authentication
OCI_TOKEN=$(oci iam region-subscription list --profile "${OCI_PROFILE}" --query 'data[0]' 2>/dev/null && echo "session_valid")
if [ -z "${OCI_TOKEN}" ]; then
    echo "Error: Could not validate OCI session"
    exit 1
fi

# Docker login to OCIR using OCI session
# For session auth, we use 'oci session authenticate' which handles the token
echo "Logging into Docker registry..."
oci raw-request --profile "${OCI_PROFILE}" \
    --http-method GET \
    --target-uri "https://${REGISTRY}/20180419/docker/token" \
    --query 'data.token' --raw-output 2>/dev/null | \
    docker login "${REGISTRY}" --username "${OCI_TENANCY_NAMESPACE}/oracleidentitycloudservice/$(oci iam user list --profile "${OCI_PROFILE}" --query 'data[0].name' --raw-output 2>/dev/null || echo 'user')" --password-stdin 2>&1 | grep -v "WARNING" || true
echo ""

APP_VERSION=$(node -p "require('./package.json').version")

echo "Building Docker image for OCI (version: ${APP_VERSION})..."
docker build --build-arg APP_VERSION="${APP_VERSION}" -f Dockerfile.oci -t "${FULL_IMAGE_NAME}" .
echo ""

echo "Pushing image to OCI Container Registry..."
docker push "${FULL_IMAGE_NAME}"
echo ""

echo "Deployment complete!"
echo ""
echo "Image pushed to: ${FULL_IMAGE_NAME}"
echo ""
echo "To create/update a Container Instance, use:"
echo "  oci container-instances container-instance create \\"
echo "    --profile ${OCI_PROFILE} \\"
echo "    --compartment-id <your-compartment-ocid> \\"
echo "    --availability-domain <your-ad> \\"
echo "    --shape CI.Standard.E4.Flex \\"
echo "    --shape-config '{\"ocpus\":1,\"memoryInGBs\":2}' \\"
echo "    --containers '[{\"imageUrl\":\"${FULL_IMAGE_NAME}\",\"displayName\":\"tmi-ux\"}]' \\"
echo "    --vnics '[{\"subnetId\":\"<your-subnet-ocid>\"}]'"
