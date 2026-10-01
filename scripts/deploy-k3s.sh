#!/bin/bash
# Deploy tmi-ux to the local k3s dev cluster.
#
# Builds Dockerfile.chainguard for the host architecture (no buildx/--platform:
# the host and the cluster nodes must share an architecture), pushes the image
# to the in-cluster registry, renders deployments/k8s/dev/k3s/tmi-ux.yml from
# .local/k3s.json, applies it and waits for the rollout. Mirrors the server
# repo's `make dev-up CLUSTER=k3s` image path (see the tmi repo's k3s node setup
# notes for the one-time host/node setup: the node host in /etc/hosts, the
# registry as an insecure registry in Docker Desktop, and the containerd mirror
# on each node).
#
# Usage:
#   pnpm run deploy:k3s            # build, push, apply, rollout
#   pnpm run deploy:k3s -- --skip-build   # re-apply/restart with the existing image
#
# Cluster details are machine-local and never tracked: copy
# deployments/k8s/dev/k3s/k3s.json.example to .local/k3s.json and fill it in
# (context, registry, node_host, ui_host). Environment overrides:
#   K3S_CONTEXT   kube context
#   K3S_REGISTRY  registry host:port
#   K3S_NODE_HOST node hostname for the NodePort URL
#   K3S_UI_HOST   public hostname for the Traefik ingress
#   IMAGE_TAG     image tag (default: dev)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOCAL_CONFIG="$PROJECT_ROOT/.local/k3s.json"
local_setting() {
  [ -f "$LOCAL_CONFIG" ] && jq -r --arg k "$1" '.[$k] // empty' "$LOCAL_CONFIG" || true
}
K3S_CONTEXT="${K3S_CONTEXT:-$(local_setting context)}"
K3S_REGISTRY="${K3S_REGISTRY:-$(local_setting registry)}"
K3S_NODE_HOST="${K3S_NODE_HOST:-$(local_setting node_host)}"
K3S_UI_HOST="${K3S_UI_HOST:-$(local_setting ui_host)}"
for var in K3S_CONTEXT K3S_REGISTRY K3S_NODE_HOST K3S_UI_HOST; do
  if [ -z "${!var}" ]; then
    echo "$var is not set. Copy deployments/k8s/dev/k3s/k3s.json.example to" >&2
    echo ".local/k3s.json and fill it in, or export $var." >&2
    exit 1
  fi
done
IMAGE_TAG="${IMAGE_TAG:-dev}"
NAMESPACE="tmi-platform"
MANIFEST="$PROJECT_ROOT/deployments/k8s/dev/k3s/tmi-ux.yml"
IMAGE="${K3S_REGISTRY}/tmi-ux:${IMAGE_TAG}"
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

echo "=== tmi-ux -> k3s (${K3S_CONTEXT}) ==="
echo "Image:    ${IMAGE}"
echo "Manifest: ${MANIFEST}"
echo ""

# Pre-flight: the cluster must be reachable and the registry service present.
kubectl --context "$K3S_CONTEXT" get svc registry -n "$NAMESPACE" >/dev/null
if ! docker info 2>/dev/null | grep -A5 "Insecure Registries" | grep -q "$K3S_REGISTRY"; then
  echo "Docker daemon does not list ${K3S_REGISTRY} as an insecure registry; push will fail." >&2
  echo "See the tmi repo's k3s node setup notes." >&2
  exit 1
fi

if [ "$SKIP_BUILD" = false ]; then
  APP_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
  # build-info.json is generated on the host (no git inside the container build).
  sh "$SCRIPT_DIR/generate-build-info.sh"
  echo "Building ${IMAGE} (version ${APP_VERSION})..."
  docker build \
    --build-arg APP_VERSION="${APP_VERSION}" \
    -f "$PROJECT_ROOT/Dockerfile.chainguard" \
    -t "$IMAGE" \
    "$PROJECT_ROOT"
  echo "Pushing ${IMAGE}..."
  docker push "$IMAGE"
fi

echo "Applying manifest..."
sed -e "s|__K3S_REGISTRY__|${K3S_REGISTRY}|g" \
  -e "s|__IMAGE_TAG__|${IMAGE_TAG}|g" \
  -e "s|__UI_HOST__|${K3S_UI_HOST}|g" \
  -e "s|__NODE_HOST__|${K3S_NODE_HOST}|g" \
  "$MANIFEST" | kubectl --context "$K3S_CONTEXT" apply -f -
# imagePullPolicy: Always + a fixed tag means a re-push needs a restart to pick
# up the new digest.
kubectl --context "$K3S_CONTEXT" -n "$NAMESPACE" rollout restart deployment/tmi-ux
kubectl --context "$K3S_CONTEXT" -n "$NAMESPACE" rollout status deployment/tmi-ux --timeout=180s

NODE_IP=$(kubectl --context "$K3S_CONTEXT" get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
NODE_PORT=$(kubectl --context "$K3S_CONTEXT" -n "$NAMESPACE" get svc tmi-ux -o jsonpath='{.spec.ports[0].nodePort}')
PROXY_TARGET=$(kubectl --context "$K3S_CONTEXT" -n "$NAMESPACE" get deploy tmi-ux -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TMI_PROXY_TARGET")].value}')
INGRESS_HOST=$(kubectl --context "$K3S_CONTEXT" -n "$NAMESPACE" get ingress tmi-ux -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || true)
echo ""
echo "=== Deployed ==="
if [ -n "$INGRESS_HOST" ]; then
  echo "UI:      https://${INGRESS_HOST}/  (Traefik ingress)"
fi
echo "UI:      http://${K3S_NODE_HOST}:${NODE_PORT}/  (also http://${NODE_IP}:${NODE_PORT}/)"
echo "API:     same-origin /api -> ${PROXY_TARGET}"
echo ""
echo "Note: OAuth login requires the browser origins in the server's"
echo "auth.oauth.client_callback_allowlist (live tmi-server-config ConfigMap):"
if [ -n "$INGRESS_HOST" ]; then
  echo "  https://${INGRESS_HOST}/*"
fi
echo "  http://${K3S_NODE_HOST}:${NODE_PORT}/*"
