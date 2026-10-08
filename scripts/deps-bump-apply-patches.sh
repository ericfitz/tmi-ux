#!/usr/bin/env bash
# Apply the deps-bump agent's patches to the checked-out base branch, refusing
# anything a dependency bump has no reason to do (#989).
#
# Usage: deps-bump-apply-patches.sh <base-ref> <patch-dir>
#
# The patches come from the untrusted agent job of .github/workflows/deps-bump.yml.
# This script runs in the publish job from the base branch's checkout, before the
# GitHub App token exists. It accepts the patches only if, together, they:
#   - modify the regular files package.json and/or pnpm-lock.yaml and nothing
#     else (no new, deleted or renamed files, no mode, symlink or submodule changes),
#   - leave package.json "packageManager" and "devEngines.packageManager"
#     unchanged (pnpm switches to the version they name).
# Accepted patches are squashed into one commit with a fixed message and the
# repository's configured identity, so none of the agent's commit metadata
# (author, subject, trailers such as "Closes #N") reaches the pushed branch.
#
# Prints "changes=true" or "changes=false" on stdout (for $GITHUB_OUTPUT).
# Exits 0 when there is nothing to apply or the patches were applied and passed;
# exits 1, with the current branch reset to <base-ref>, when they were refused.
set -euo pipefail

COMMIT_MESSAGE='chore(deps): automated bump'

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

# Both package-manager fields, as one comparable string.
package_managers() {
  jq -c '[.packageManager, .devEngines.packageManager]' package.json
}

if ! pm_before="$(package_managers 2>/dev/null)"; then
  echo "error: package.json on '${base}' is missing or not valid JSON" >&2
  exit 2
fi

if ! git -c core.hooksPath=/dev/null am --no-3way --quiet "${patches[@]}" >&2; then
  refuse "The bump's patches do not apply to ${base}"
fi

# Raw diff: ":<old mode> <new mode> <old sha> <new sha> <status>\t<path>".
# Only in-place modifications of the two regular files are allowed.
allowed=$'^:100644 100644 [0-9a-f]+ [0-9a-f]+ M\t(package\\.json|pnpm-lock\\.yaml)$'
unexpected="$(git diff --raw --no-abbrev --no-renames "${base}..HEAD" | grep -vE "$allowed" || true)"
if [ -n "$unexpected" ]; then
  printf '%s\n' "$unexpected" >&2
  refuse "The bump changed something other than the contents of package.json and pnpm-lock.yaml"
fi
pm_after="$(package_managers 2>/dev/null)" || refuse "The bump left package.json unparseable"
if [ "$pm_after" != "$pm_before" ]; then
  refuse "The bump changed package.json \"packageManager\" or \"devEngines.packageManager\""
fi

git reset -q --soft "$base"
if git diff --cached --quiet; then
  git reset -q --hard "$base"
  echo "The bump's patches cancel out: nothing to apply." >&2
  echo "changes=false"
  exit 0
fi
git -c core.hooksPath=/dev/null commit -q --no-verify -m "$COMMIT_MESSAGE"

echo "changes=true"
