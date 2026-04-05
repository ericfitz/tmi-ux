#!/bin/bash
#
# container-runtime.sh - Shared container runtime detection and flag helpers
#
# Source this file from container build/push scripts to get portable
# Docker/Podman support.
#
# Usage:
#   CONTAINER_RUNTIME=""  # set by --runtime arg parsing, or leave empty
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/container-runtime.sh"
#   resolve_container_runtime
#   # Now $CONTAINER_RUNTIME is set to "docker" or "podman"
#   $CONTAINER_RUNTIME build $(container_build_flags) -t myimage .
#

# Validate and resolve the container runtime.
# If CONTAINER_RUNTIME is already set (e.g., from --runtime flag), validate it.
# Otherwise auto-detect: prefer docker, fall back to podman.
resolve_container_runtime() {
  if [[ -n "${CONTAINER_RUNTIME:-}" ]]; then
    case "$CONTAINER_RUNTIME" in
      docker|podman) ;;
      *)
        echo "Error: --runtime must be 'docker' or 'podman', got '${CONTAINER_RUNTIME}'" >&2
        exit 1
        ;;
    esac
    if ! command -v "$CONTAINER_RUNTIME" &>/dev/null; then
      echo "Error: ${CONTAINER_RUNTIME} is not installed or not in PATH" >&2
      exit 1
    fi
  else
    if command -v docker &>/dev/null; then
      CONTAINER_RUNTIME="docker"
    elif command -v podman &>/dev/null; then
      CONTAINER_RUNTIME="podman"
    else
      echo "Error: neither docker nor podman found in PATH" >&2
      exit 1
    fi
  fi
  export CONTAINER_RUNTIME
}

# Echo runtime-specific build flags.
# Docker: suppress BuildKit attestations that some registries reject.
# Podman: produce Docker-format manifests for registry compatibility.
container_build_flags() {
  case "$CONTAINER_RUNTIME" in
    docker)
      echo "--provenance=false --sbom=false"
      ;;
    podman)
      echo "--format docker"
      ;;
  esac
}
