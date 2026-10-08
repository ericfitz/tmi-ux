#!/usr/bin/env bash
# Apply the deps-bump agent's patches to the checked-out base branch, refusing
# anything a dependency bump has no reason to do (#989).
#
# Usage: deps-bump-apply-patches.sh <base-ref> <patch-dir>
#
# The patches come from the untrusted agent job of .github/workflows/deps-bump.yml.
# This script runs in the publish job from the base branch's checkout, before the
# GitHub App token exists. It accepts the patches only if, together, they:
#   - change package.json and pnpm-lock.yaml and nothing else, and
#   - leave package.json "packageManager" unchanged (pnpm would switch to it).
#
# Prints "changes=true" or "changes=false" on stdout (for $GITHUB_OUTPUT).
# Exits 0 when there is nothing to apply or the patches were applied and passed;
# exits 1, with the current branch reset to <base-ref>, when they were refused.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <base-ref> <patch-dir>" >&2
  exit 2
fi
base="$1"
dir="$2"

if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  echo "error: base ref '${base}' is not a commit" >&2
  exit 2
fi
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "${base}^{commit}")" ]; then
  echo "error: HEAD must be at '${base}' before applying patches" >&2
  exit 2
fi
if [ ! -d "$dir" ]; then
  echo "error: patch directory '${dir}' does not exist" >&2
  exit 2
fi

shopt -s nullglob
patches=("$dir"/*.patch)
if [ "${#patches[@]}" -eq 0 ]; then
  echo "No patches in ${dir}: nothing to apply." >&2
  echo "changes=false"
  exit 0
fi

refuse() {
  echo "::error::$1; not opening a PR." >&2
  git am --abort >/dev/null 2>&1 || true
  git reset -q --hard "$base"
  exit 1
}

package_manager() {
  if [ -f package.json ]; then
    jq -r '.packageManager // ""' package.json
  fi
}

pm_before="$(package_manager)"
if ! git -c core.hooksPath=/dev/null am --no-3way --quiet "${patches[@]}" >&2; then
  refuse "The bump's patches do not apply to ${base}"
fi

unexpected="$(git diff --no-renames --name-only "${base}..HEAD" | grep -vxE 'package\.json|pnpm-lock\.yaml' || true)"
if [ -n "$unexpected" ]; then
  printf '%s\n' "$unexpected" >&2
  refuse "The bump touched files other than package.json and pnpm-lock.yaml"
fi
pm_after="$(package_manager)" || refuse "The bump left package.json unparseable"
if [ "$pm_after" != "$pm_before" ]; then
  refuse "The bump changed package.json \"packageManager\""
fi

echo "changes=true"
