#!/usr/bin/env bash

# Build and deploy tmi-ux to the AWS S3 + CloudFront stack in terraform/aws.
#
# Usage:
#   ./scripts/deploy-aws.sh [--no-build]
#
# Options:
#   --no-build   Deploy whatever is already in dist/tmi-ux/browser
#   --help       Show this help message
#
# Prerequisites:
#   - AWS CLI configured with the "tmi" profile
#   - terraform/aws applied (see docs/reference/aws-deployment.md)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$ROOT_DIR/terraform/aws"
DIST_DIR="$ROOT_DIR/dist/tmi-ux/browser"

export AWS_PROFILE="${AWS_PROFILE:-tmi}"

RUN_BUILD=true
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            RUN_BUILD=false
            shift
            ;;
        --help)
            sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

echo "==> Reading Terraform outputs"
BUCKET="$(terraform -chdir="$TF_DIR" output -raw content_bucket)"
DISTRIBUTION_ID="$(terraform -chdir="$TF_DIR" output -raw distribution_id)"
SITE_URL="$(terraform -chdir="$TF_DIR" output -raw site_url)"
echo "    bucket=$BUCKET distribution=$DISTRIBUTION_ID"

if [[ "$RUN_BUILD" == true ]]; then
    echo "==> Building (configuration=aws)"
    (cd "$ROOT_DIR" && pnpm run build:aws)
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
    echo "Error: $DIST_DIR/index.html not found; run without --no-build." >&2
    exit 1
fi

# src/main.ts fetches /config.json before bootstrap in production builds. On
# S3 a missing key would be rewritten to index.html by the SPA fallback,
# return 200, and fail JSON parsing — a warning on every page load. Publishing
# an empty object keeps the load clean and leaves a hook for overriding
# apiUrl / operator strings later without a rebuild.
echo "==> Writing config.json"
echo '{}' > "$DIST_DIR/config.json"

# Pass 1 — stable-named assets. outputHashing only hashes build-emitted files,
# so everything from public/ (favicon.ico, TMI-Logo.svg, site.webmanifest,
# robots.txt) and src/assets/ (including i18n JSON) keeps a stable name and
# must NOT be marked immutable. --delete is scoped by the same filters, so it
# will not remove the hashed output uploaded by pass 2.
echo "==> Pass 1/3: stable-named assets (max-age=3600)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete \
    --cache-control "public,max-age=3600" \
    --exclude "*.js" --exclude "*.css" --exclude "media/*" \
    --exclude "index.html" --exclude "config.json"

# Pass 2 — hash-named build output. Syncing from local (rather than an S3-to-S3
# copy with --metadata-directive REPLACE) keeps the guessed Content-Type.
echo "==> Pass 2/3: hashed build output (immutable)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "*" --include "*.js" --include "*.css" --include "media/*"

echo "==> Pass 3/3: entry points (no-store)"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" \
    --cache-control "no-store" --content-type "text/html"
aws s3 cp "$DIST_DIR/config.json" "s3://$BUCKET/config.json" \
    --cache-control "no-store" --content-type "application/json"

# Hashed files never need invalidating and the entry points sit on
# CachingDisabled behaviors; this exists for the stable-named assets above.
# One /* path counts as a single invalidation against the 1000/month free tier.
echo "==> Invalidating CloudFront cache"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths '/*' \
    --query 'Invalidation.Id' --output text)"

echo "==> Deployed to $SITE_URL (invalidation $INVALIDATION_ID)"
