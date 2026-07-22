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

# Every Angular build configuration emits to the same dist/tmi-ux/browser, so
# the presence of index.html proves nothing about *which* environment was
# compiled in. A dist/ left over from `pnpm run build:prod` or `build:test`
# would deploy the wrong apiUrl to app.aws.tmi.dev, and the failure mode (login
# and API calls silently pointed at another server) is not obvious in the
# browser. environment.aws.ts is the only environment file carrying this host,
# so its presence in the emitted bundles is a reliable fingerprint. This runs
# for built and --no-build deploys alike.
echo "==> Verifying dist/ was built with configuration=aws"
if ! grep -rqlF 'server.aws.tmi.dev' "$DIST_DIR" --include='*.js'; then
    echo "Error: no bundle in $DIST_DIR references server.aws.tmi.dev." >&2
    echo "       This dist/ was built with a different configuration and must" >&2
    echo "       not be deployed to app.aws.tmi.dev. Run: pnpm run build:aws" >&2
    exit 1
fi

# src/main.ts fetches /config.json before bootstrap in production builds. On
# S3 a missing key would be rewritten to index.html by the SPA fallback,
# return 200, and fail JSON parsing — a warning on every page load. Publishing
# an empty object keeps the load clean.
#
# NOTE: this is rewritten to {} and re-uploaded on EVERY deploy. It is not a
# durable override hook — anything hand-edited into s3://…/config.json is lost
# on the next deploy. src/environments/environment.aws.ts is the durable place
# to configure this deployment.
echo "==> Writing config.json"
echo '{}' > "$DIST_DIR/config.json"

# ---------------------------------------------------------------------------
# Upload ordering matters — do not "simplify" this into a single sync --delete.
#
# index.html references hashed bundles by name. If deletion of the previous
# build's bundles happens before the new index.html is published, the origin
# serves an index.html whose bundles are gone. CloudFront rewrites those origin
# 403s to /index.html with status 200 (SPA fallback), so the browser receives
# HTML where JavaScript was expected: "Uncaught SyntaxError: Unexpected token
# '<'". With `set -e`, an interruption anywhere in that window leaves the site
# permanently in that state.
#
# So: add everything new first (no --delete), publish the entry points, and
# only then prune what is no longer referenced. Between passes 1 and 3 the
# bucket holds both builds and serves the old one correctly.
# ---------------------------------------------------------------------------

# Pass 1 — hash-named build output, added alongside the previous build's.
# Syncing from local (rather than an S3-to-S3 copy with --metadata-directive
# REPLACE) keeps the guessed Content-Type.
echo "==> Pass 1/4: hashed build output (immutable, no delete)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "*" --include "*.js" --include "*.css" --include "media/*"

# Pass 2 — stable-named assets. outputHashing only hashes build-emitted files,
# so everything from public/ (favicon.ico, TMI-Logo.svg, site.webmanifest,
# robots.txt) and src/assets/ (including i18n JSON) keeps a stable name and
# must NOT be marked immutable.
echo "==> Pass 2/4: stable-named assets (max-age=3600, no delete)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" \
    --cache-control "public,max-age=3600" \
    --exclude "*.js" --exclude "*.css" --exclude "media/*" \
    --exclude "index.html" --exclude "config.json" \
    --exclude "site.webmanifest"

# Python's mimetypes table has no .webmanifest entry, so the sync above would
# upload it as binary/octet-stream and browsers would ignore the manifest.
if [[ -f "$DIST_DIR/site.webmanifest" ]]; then
    aws s3 cp "$DIST_DIR/site.webmanifest" "s3://$BUCKET/site.webmanifest" \
        --cache-control "public,max-age=3600" \
        --content-type "application/manifest+json"
fi

# Pass 3 — entry points. This is the cutover: from here the site references the
# bundles uploaded in pass 1.
echo "==> Pass 3/4: entry points (no-store)"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" \
    --cache-control "no-store" --content-type "text/html"
aws s3 cp "$DIST_DIR/config.json" "s3://$BUCKET/config.json" \
    --cache-control "no-store" --content-type "application/json"

# Pass 4 — prune. Everything local is now in the bucket, so this only issues
# deletes for keys the current build no longer produces (the previous build's
# hashed bundles, removed assets). --size-only keeps it from re-uploading and
# clobbering the per-class Cache-Control set above.
echo "==> Pass 4/4: pruning objects no longer in dist/"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete --size-only

# Hashed files never need invalidating and the entry points sit on
# CachingDisabled behaviors; this exists for the stable-named assets above.
# One /* path counts as a single invalidation against the 1000/month free tier.
echo "==> Invalidating CloudFront cache"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths '/*' \
    --query 'Invalidation.Id' --output text)"

echo "==> Waiting for invalidation $INVALIDATION_ID to complete"
aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" --id "$INVALIDATION_ID"

# Post-deploy verification. The SPA fallback turns origin 403/404 into a 200
# HTML response, so a 200 on "/" alone does not prove the deploy is intact —
# check a hashed bundle that the freshly built index.html actually references.
echo "==> Verifying deployment"

http_status() {
    curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$1"
}

ROOT_STATUS="$(http_status "$SITE_URL/")"
if [[ "$ROOT_STATUS" != "200" ]]; then
    echo "Error: GET $SITE_URL/ returned HTTP $ROOT_STATUS (expected 200)." >&2
    exit 1
fi
echo "    $SITE_URL/ -> 200"

BUNDLE="$(grep -oE '(src|href)="[^"]+\.js"' "$DIST_DIR/index.html" |
    head -n 1 | sed -E 's/^(src|href)="//; s/"$//; s#^/##')"
if [[ -z "$BUNDLE" ]]; then
    echo "Error: could not find a .js reference in $DIST_DIR/index.html." >&2
    exit 1
fi

BUNDLE_PROBE="$(curl -sS -o /dev/null --max-time 30 \
    -w '%{http_code} %{content_type}' "$SITE_URL/$BUNDLE")"
BUNDLE_STATUS="${BUNDLE_PROBE%% *}"
BUNDLE_TYPE="${BUNDLE_PROBE#* }"
# A missing bundle also answers 200: the distribution's custom_error_response
# rewrites the origin's 403 to /index.html. Content-Type is what distinguishes
# the two, so check it as well as the status.
if [[ "$BUNDLE_STATUS" != "200" || "$BUNDLE_TYPE" != *javascript* ]]; then
    echo "Error: GET $SITE_URL/$BUNDLE returned HTTP $BUNDLE_STATUS ($BUNDLE_TYPE);" >&2
    echo "       expected 200 with a JavaScript Content-Type. The published" >&2
    echo "       index.html references a bundle the origin does not have," >&2
    echo "       and the SPA fallback is serving HTML in its place." >&2
    exit 1
fi
echo "    $SITE_URL/$BUNDLE -> 200 ($BUNDLE_TYPE)"

echo "==> Deployed to $SITE_URL (invalidation $INVALIDATION_ID)"
