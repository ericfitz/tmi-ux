#!/bin/bash
#
# push-oci.sh - Build and push TMI-UX container to OCI Container Registry
#
# This script builds the TMI-UX container image and pushes it to Oracle Cloud
# Infrastructure (OCI) Container Registry. Registry configuration (namespace,
# repository) is auto-discovered from OCI unless overridden via environment
# variables.
#
# Prerequisites:
#   - OCI CLI installed and configured (oci session authenticate or API key)
#   - Docker installed and running
#   - jq installed
#   - Access to the target OCI Container Repository
#
# Usage:
#   ./scripts/push-oci.sh [options]
#
# Options:
#   --region REGION       OCI region (default: us-ashburn-1)
#   --repo-ocid OCID      Container repository OCID (auto-discovered if not set)
#   --tag TAG             Image tag (default: latest)
#   --platform PLATFORM   Docker platform (default: linux/arm64)
#   --no-cache            Build without Docker cache
#   --help                Show this help message
#
# Environment Variables:
#   CONTAINER_REPO_OCID   Container repository OCID (alternative to --repo-ocid)
#   OCI_REGION            OCI region (alternative to --region)
#   OCI_TENANCY_NAMESPACE Override tenancy namespace (auto-detected if not set)
#
# Example:
#   ./scripts/push-oci.sh
#   ./scripts/push-oci.sh --tag v1.2.0
#   ./scripts/push-oci.sh --region us-phoenix-1 --no-cache
#

set -euo pipefail

# Script directory for relative paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions - all output to stderr to avoid polluting command substitution
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Default values
REGION="${OCI_REGION:-us-ashburn-1}"
REPO_OCID="${CONTAINER_REPO_OCID:-}"
TAG="latest"
PLATFORM="linux/arm64"
NO_CACHE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --region)
            REGION="$2"
            shift 2
            ;;
        --repo-ocid)
            REPO_OCID="$2"
            shift 2
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --help)
            sed -n '2,/^$/p' "$0" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    if ! command -v oci &> /dev/null; then
        log_error "OCI CLI is not installed or not in PATH"
        log_info "Install it from: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed or not in PATH"
        log_info "Install it: brew install jq"
        exit 1
    fi

    # Verify OCI CLI is configured
    if ! oci iam region list --output json &> /dev/null; then
        log_error "OCI CLI is not configured. Run 'oci session authenticate' or configure API keys"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Get tenancy namespace from OCI
get_tenancy_namespace() {
    if [[ -n "${OCI_TENANCY_NAMESPACE:-}" ]]; then
        echo "$OCI_TENANCY_NAMESPACE"
        return
    fi

    log_info "Fetching tenancy namespace from OCI..."
    local namespace
    namespace=$(oci os ns get --query 'data' --raw-output 2>/dev/null)

    if [[ -z "$namespace" ]]; then
        log_error "Failed to get tenancy namespace from OCI"
        exit 1
    fi

    echo "$namespace"
}

# Search for container repositories in a compartment, return JSON array or empty
search_repos_in_compartment() {
    local comp_id="$1"
    local comp_name="${2:-}"
    if [[ -n "$comp_name" ]]; then
        log_info "Searching compartment: ${comp_name}..."
    fi
    oci artifacts container repository list \
        --compartment-id "$comp_id" \
        --query 'data.items[*].{name:"display-name",id:id}' \
        --output json 2>/dev/null || echo "[]"
}

# Prompt user to select a repo from a JSON array, sets REPO_OCID
select_repo_from_list() {
    local repos_json="$1"
    local repo_count
    repo_count=$(echo "$repos_json" | jq 'length')

    if [[ "$repo_count" -eq 1 ]]; then
        REPO_OCID=$(echo "$repos_json" | jq -r '.[0].id')
        REPO_NAME=$(echo "$repos_json" | jq -r '.[0].name')
        log_info "Auto-selected repository: ${REPO_NAME}"
    else
        log_info "Found ${repo_count} container repositories:"
        echo ""
        for i in $(seq 0 $((repo_count - 1))); do
            NAME=$(echo "$repos_json" | jq -r ".[$i].name")
            echo "  $((i + 1)). ${NAME}"
        done
        echo ""
        read -rp "Select repository [1-${repo_count}]: " SELECTION

        if [[ -z "$SELECTION" ]] || ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || \
           [[ "$SELECTION" -lt 1 ]] || [[ "$SELECTION" -gt "$repo_count" ]]; then
            log_error "Invalid selection"
            exit 1
        fi

        local idx=$((SELECTION - 1))
        REPO_OCID=$(echo "$repos_json" | jq -r ".[$idx].id")
        REPO_NAME=$(echo "$repos_json" | jq -r ".[$idx].name")
        log_info "Selected repository: ${REPO_NAME}"
    fi
}

# Auto-discover container repository OCID
discover_repo() {
    log_info "CONTAINER_REPO_OCID not set, discovering from OCI..."

    # Get tenancy OCID (root compartment)
    TENANCY_OCID=$(oci iam compartment list --query 'data[0]."compartment-id"' --raw-output 2>/dev/null || true)
    if [[ -z "$TENANCY_OCID" ]]; then
        log_error "Could not determine tenancy. Set CONTAINER_REPO_OCID or use --repo-ocid"
        exit 1
    fi

    # Search root compartment
    local repos_json
    repos_json=$(search_repos_in_compartment "$TENANCY_OCID" "root tenancy")

    # If not found in root, search child compartments
    if [[ "$repos_json" == "[]" || "$repos_json" == "null" || -z "$repos_json" ]]; then
        log_info "No repos in root tenancy, searching child compartments..."

        local compartments_json
        compartments_json=$(oci iam compartment list \
            --compartment-id "$TENANCY_OCID" \
            --compartment-id-in-subtree true \
            --access-level ACCESSIBLE \
            --lifecycle-state ACTIVE \
            --query 'data[*].{name:name,id:id}' \
            --output json 2>/dev/null || echo "[]")

        local comp_count
        comp_count=$(echo "$compartments_json" | jq 'length')
        for i in $(seq 0 $((comp_count - 1))); do
            local comp_id comp_name
            comp_id=$(echo "$compartments_json" | jq -r ".[$i].id")
            comp_name=$(echo "$compartments_json" | jq -r ".[$i].name")
            repos_json=$(search_repos_in_compartment "$comp_id" "$comp_name")
            if [[ "$repos_json" != "[]" && "$repos_json" != "null" && -n "$repos_json" ]]; then
                break
            fi
        done
    fi

    # Validate we found repos
    if [[ -z "$repos_json" || "$repos_json" == "[]" || "$repos_json" == "null" ]]; then
        log_error "No container repositories found in any compartment"
        log_info "Create one in OCI Console > Developer Services > Container Registry"
        exit 1
    fi

    # Select repo
    select_repo_from_list "$repos_json"

    log_info "Repository OCID: ${REPO_OCID}"
    export CONTAINER_REPO_OCID="$REPO_OCID"
}

# Get repository name from OCID
get_repo_name() {
    log_info "Fetching repository details from OCI..."
    local repo_name
    repo_name=$(oci artifacts container repository get \
        --repository-id "$REPO_OCID" \
        --query 'data."display-name"' \
        --raw-output 2>/dev/null)

    if [[ -z "$repo_name" ]]; then
        log_error "Failed to get repository name from OCID: $REPO_OCID"
        exit 1
    fi

    echo "$repo_name"
}

# Authenticate with OCI Container Registry
authenticate_ocir() {
    local registry="$1"
    local namespace="$2"

    log_info "Authenticating with OCI Container Registry..."

    # Try to use docker credential helper if available
    if docker-credential-oci-container-registry list &> /dev/null 2>&1; then
        log_info "Using OCI credential helper for Docker authentication"
        return 0
    fi

    # Check if already logged in
    if docker login "${registry}" --get-login &> /dev/null 2>&1; then
        log_info "Already authenticated with ${registry}"
        return 0
    fi

    # For session-based auth, prompt for interactive login
    log_warn "Docker login to OCI Container Registry required"
    log_info "To authenticate, you need an OCI Auth Token:"
    log_info "  1. Go to OCI Console > Identity > Users > Your User > Auth Tokens"
    log_info "  2. Generate a new token (save it, shown only once)"
    log_info "  3. Run: docker login ${registry}"
    log_info "     Username: ${namespace}/your-email@example.com"
    log_info "     Password: your-auth-token"
    log_info ""
    log_info "Attempting interactive login..."

    if ! docker login "${registry}"; then
        log_error "Failed to authenticate with OCI Container Registry"
        exit 1
    fi

    log_success "Authenticated with OCI Container Registry"
}

# Main execution
main() {
    log_info "TMI-UX OCI Container Registry Deployment"
    log_info "========================================="

    # Check prerequisites
    check_prerequisites

    # Auto-discover repository if not provided
    if [[ -z "$REPO_OCID" ]]; then
        discover_repo
    fi

    # Get OCI configuration
    local namespace
    namespace=$(get_tenancy_namespace)
    log_info "Tenancy namespace: ${namespace}"

    local repo_name
    repo_name=$(get_repo_name)
    log_info "Repository name: ${repo_name}"

    # Construct image name
    local registry="${REGION}.ocir.io"
    local full_image_name="${registry}/${namespace}/${repo_name}:${TAG}"
    log_info "Image: ${full_image_name}"

    # Get version from package.json
    local app_version
    app_version=$(node -p "require('./package.json').version")
    log_info "App version: ${app_version}"

    # Authenticate with OCIR
    authenticate_ocir "$registry" "$namespace"

    # Build the image
    log_info "Building Docker image for OCI..."
    local build_args=(
        --platform "${PLATFORM}"
        --file Dockerfile.oci
        --tag "${full_image_name}"
        --build-arg "APP_VERSION=${app_version}"
    )

    if [[ "$TAG" == "latest" ]]; then
        build_args+=(--tag "${registry}/${namespace}/${repo_name}:v${app_version}")
    fi

    if [[ "$NO_CACHE" == true ]]; then
        build_args+=(--no-cache)
    fi

    if ! docker build "${build_args[@]}" .; then
        log_error "Docker build failed"
        exit 1
    fi

    local image_size
    image_size=$(docker images "${full_image_name}" --format "{{.Size}}")
    log_success "Image built successfully (${image_size})"

    # Push to OCIR
    log_info "Pushing ${full_image_name}..."
    if ! docker push "${full_image_name}"; then
        log_error "Failed to push ${full_image_name}"
        exit 1
    fi

    # Push version tag if we created one
    if [[ "$TAG" == "latest" ]]; then
        local version_image="${registry}/${namespace}/${repo_name}:v${app_version}"
        log_info "Pushing ${version_image}..."
        if ! docker push "${version_image}"; then
            log_warn "Failed to push version tag (non-fatal)"
        fi
    fi

    log_success "Deployment complete!"
    log_info "Image pushed to: ${full_image_name}"
    echo ""
    log_info "To create/update a Container Instance:"
    echo "  oci container-instances container-instance create \\"
    echo "    --compartment-id <your-compartment-ocid> \\"
    echo "    --availability-domain <your-ad> \\"
    echo "    --shape CI.Standard.E4.Flex \\"
    echo "    --shape-config '{\"ocpus\":1,\"memoryInGBs\":2}' \\"
    echo "    --containers '[{\"imageUrl\":\"${full_image_name}\",\"displayName\":\"tmi-ux\"}]' \\"
    echo "    --vnics '[{\"subnetId\":\"<your-subnet-ocid>\"}]'"
}

# Run main
main "$@"
