#!/usr/bin/env bash
#
# Compute the PR's target package.json version for the Version Bump workflow
# (.github/workflows/version-bump.yml). Shared by the `bump` and `check-bump`
# jobs so their version math can never drift.
#
# Inputs (environment):
#   BASE_REF  PR base branch, e.g. `main` (github.base_ref). Required.
#   HEAD_REF  PR head branch name (github.head_ref). Optional; used only for the
#             `release/*` durable signal, so it works for fork PRs too (the name
#             is still known even though the branch lives in the fork).
#
# Requires a full-history checkout (fetch-depth: 0) and node on PATH.
#
# Emits eval-able KEY=VALUE lines on stdout; all diagnostics go to stderr:
#   BASE=<package.json version on BASE_REF at the merge base>
#   HEAD_VER=<package.json version in the current checkout>
#   BUMP=<minor|patch|"">   (conventional-commit bump for the PR range)
#   TARGET=<computed next version>
#
# Idempotency: TARGET for a plain bump is computed from BASE (the merge-base
# version), never from HEAD_VER, so re-running on `synchronize` — including the
# synchronize fired by the bump job's own push — resolves to the same TARGET and
# no-ops. Human-owned versions (release/* finalization, manual major raise) are
# computed from HEAD_VER and preserved via durable signals that survive re-runs.
set -euo pipefail

: "${BASE_REF:?BASE_REF is required}"
HEAD_REF="${HEAD_REF:-}"

ROOT=$(git rev-parse --show-toplevel)

# git fetch chatter belongs on stderr so it never pollutes the KEY=VALUE stdout.
git fetch --no-tags origin "$BASE_REF" 1>&2
MERGE_BASE=$(git merge-base "origin/$BASE_REF" HEAD)

read_version() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"
}

BASE=$(git show "$MERGE_BASE:package.json" | read_version)
HEAD_VER=$(node -p "require('$ROOT/package.json').version")

major() { printf '%s' "$1" | sed -E 's/^([0-9]+)\..*/\1/'; }
has_pre() { printf '%s' "$1" | grep -q '-'; }

# Relevant-files filter: bump only for package.json or src/, excluding tests,
# testing utilities, and environment configs. Infra-only changes (.github/,
# scripts/, docs) do not bump.
CHANGED=$(git diff --name-only "$MERGE_BASE" HEAD)
RELEVANT=$(printf '%s\n' "$CHANGED" \
  | grep -E '^(package\.json|src/)' \
  | grep -v '\.spec\.ts$' \
  | grep -v '^src/testing/' \
  | grep -v '^src/environments/' || true)

# Derive the conventional-commit bump type from the PR range, dropping our own
# bump commits. minor wins over patch.
SUBJECTS=$(git log --format='%s' "${MERGE_BASE}..HEAD")
TYPES=$(printf '%s\n' "$SUBJECTS" \
  | grep -vE '^chore: bump version' \
  | sed -nE 's/^([a-z]+)(\(.+\))?!?: .+/\1/p' || true)
if printf '%s\n' "$TYPES" | grep -qE '^(feat|refactor)$'; then
  BUMP='minor'
elif printf '%s\n' "$TYPES" | grep -qE '^(fix|docs|perf|test|build|ci|chore|deps|ops)$'; then
  BUMP='patch'
else
  BUMP=''
fi
if [ -z "$RELEVANT" ]; then
  BUMP=''
fi

# Human-owned versions are preserved/finalized (computed from HEAD_VER), never
# auto-incremented; their signals survive re-runs. Everything else is a plain
# bump computed from BASE.
if printf '%s' "$HEAD_REF" | grep -qE '^release/' \
  || has_pre "$HEAD_VER" \
  || [ "$(major "$HEAD_VER")" -gt "$(major "$BASE")" ]; then
  TARGET=$(node "$ROOT/scripts/compute-next-version.mjs" "$HEAD_VER" "$BASE" "")
else
  TARGET=$(node "$ROOT/scripts/compute-next-version.mjs" "$BASE" "$BASE" "$BUMP")
fi

printf 'BASE=%s\nHEAD_VER=%s\nBUMP=%s\nTARGET=%s\n' "$BASE" "$HEAD_VER" "$BUMP" "$TARGET"
