#!/usr/bin/env bash
# Self-test for deps-bump-apply-patches.sh. Builds throwaway git repos under a
# temp directory, feeds the script patches that a bump should and shouldn't
# produce, and checks its output, exit code and the resulting HEAD.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/deps-bump-apply-patches.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
n=0

git_q() { git -c init.defaultBranch=main -c user.name=t -c user.email=t@example.com "$@"; }

# Fresh repo with a base commit and an empty patch dir. Sets REPO, PATCHES, BASE.
new_repo() {
  n=$((n + 1))
  REPO="$WORK/repo$n"
  PATCHES="$WORK/patches$n"
  mkdir -p "$REPO" "$PATCHES"
  git_q -C "$REPO" init -q
  git_q -C "$REPO" config user.name t
  git_q -C "$REPO" config user.email t@example.com
  printf '{\n  "name": "x",\n  "packageManager": "pnpm@10.0.0",\n  "dependencies": { "a": "1.0.0" }\n}\n' > "$REPO/package.json"
  printf 'lockfileVersion: 9.0\na: 1.0.0\n' > "$REPO/pnpm-lock.yaml"
  mkdir -p "$REPO/.github/workflows"
  printf 'name: ci\n' > "$REPO/.github/workflows/ci.yml"
  git_q -C "$REPO" add -A
  git_q -C "$REPO" commit -qm base
  BASE="$(git -C "$REPO" rev-parse HEAD)"
}

# Commit the working tree's changes, export the commits since BASE as patches,
# and put HEAD back on BASE (as the publish job's fresh checkout would be).
make_patches() {
  git_q -C "$REPO" add -A
  git_q -C "$REPO" commit -q --author="${2:-t <t@example.com>}" -m "${1:-bump}"
  git -C "$REPO" format-patch -q -o "$PATCHES" "$BASE..HEAD" >/dev/null
  git -C "$REPO" reset -q --hard "$BASE"
}

# check <name> <expected exit> <expected stdout> <expect HEAD moved: yes|no>
check() {
  local name="$1" want_rc="$2" want_out="$3" want_moved="$4" out rc moved
  set +e
  out="$(cd "$REPO" && bash "$SCRIPT" "$BASE" "$PATCHES" 2>"$WORK/stderr")"
  rc=$?
  set -e
  moved=no
  squashed=ok
  if [ "$(git -C "$REPO" rev-parse HEAD)" != "$BASE" ]; then
    moved=yes
    # One commit, fixed subject and body, the repo's identity (not the patch author).
    [ "$(git -C "$REPO" rev-list --count "$BASE..HEAD")" = 1 ] &&
      [ "$(git -C "$REPO" log -1 --format='%an <%ae>|%cn|%B' | tr -d '\n')" = "t <t@example.com>|t|chore(deps): automated bump" ] ||
      squashed=bad
  fi
  if [ "$rc" = "$want_rc" ] && [ "$out" = "$want_out" ] && [ "$moved" = "$want_moved" ] &&
    [ "$squashed" = ok ] && [ -z "$(git -C "$REPO" status --porcelain)" ]; then
    pass=$((pass + 1))
    echo "ok   $name"
  else
    fail=$((fail + 1))
    echo "FAIL $name: rc=$rc (want $want_rc) out='$out' (want '$want_out') moved=$moved (want $want_moved) squash=$squashed"
    sed 's/^/     stderr: /' "$WORK/stderr"
    git -C "$REPO" status --porcelain | sed 's/^/     dirty: /'
  fi
}

new_repo
check "no patches: nothing to apply" 0 "changes=false" no

new_repo
sed -i.bak 's/"a": "1.0.0"/"a": "1.0.1"/' "$REPO/package.json" && rm "$REPO/package.json.bak"
printf 'lockfileVersion: 9.0\na: 1.0.1\n' > "$REPO/pnpm-lock.yaml"
make_patches
check "package.json + lockfile: applied" 0 "changes=true" yes

new_repo
printf 'lockfileVersion: 9.0\na: 1.0.1\n' > "$REPO/pnpm-lock.yaml"
make_patches first
printf 'name: pwned\n' > "$REPO/.github/workflows/ci.yml"
git_q -C "$REPO" add -A && git_q -C "$REPO" commit -qm tmp
git -C "$REPO" format-patch -q -o "$PATCHES" --start-number 2 "HEAD~1..HEAD" >/dev/null
git -C "$REPO" reset -q --hard "$BASE"
check "second patch edits a workflow: refused" 1 "" no

new_repo
printf 'evil\n' > "$REPO/.npmrc"
make_patches
check "new file outside the allowlist: refused" 1 "" no

new_repo
git -C "$REPO" rm -q .github/workflows/ci.yml
make_patches
check "deleting a file outside the allowlist: refused" 1 "" no

# A base without a lockfile, so the move is a pure rename that diff's rename
# detection would report under the allowed destination name only.
new_repo
git -C "$REPO" rm -q pnpm-lock.yaml
git_q -C "$REPO" commit -qm "no lockfile"
BASE="$(git -C "$REPO" rev-parse HEAD)"
git -C "$REPO" mv .github/workflows/ci.yml pnpm-lock.yaml
make_patches
check "rename into an allowed path: refused" 1 "" no

new_repo
sed -i.bak 's/pnpm@10.0.0/pnpm@10.0.1/' "$REPO/package.json" && rm "$REPO/package.json.bak"
make_patches
check "packageManager changed: refused" 1 "" no

new_repo
sed -i.bak 's/"a": "1.0.0"/"a": "1.0.1"/' "$REPO/package.json" && rm "$REPO/package.json.bak"
make_patches $'feat!: take over\n\nCloses #1\nCo-authored-by: Mallory <m@example.com>' 'Eric Fitzgerald <github@efitz.net>'
printf 'lockfileVersion: 9.0\na: 1.0.1\n' > "$REPO/pnpm-lock.yaml"
git_q -C "$REPO" add -A && git_q -C "$REPO" commit -qm "second"
git -C "$REPO" format-patch -q -o "$PATCHES" --start-number 2 "HEAD~1..HEAD" >/dev/null
git -C "$REPO" reset -q --hard "$BASE"
check "two good patches, hostile metadata: squashed, metadata dropped" 0 "changes=true" yes

new_repo
printf 'evil\n' > "$REPO/.npmrc"
make_patches add
git_q -C "$REPO" am -q "$PATCHES"/*.patch
git -C "$REPO" rm -q .npmrc
git_q -C "$REPO" commit -qm del
git -C "$REPO" format-patch -q -o "$PATCHES" --start-number 2 "HEAD~1..HEAD" >/dev/null
git -C "$REPO" reset -q --hard "$BASE"
check "add then delete a file: nets to nothing" 0 "changes=false" no

# The lockfile holds valid JSON with the same packageManager, so only the mode
# check can refuse it.
new_repo
cp "$REPO/package.json" "$REPO/pnpm-lock.yaml"
rm "$REPO/package.json"
ln -s pnpm-lock.yaml "$REPO/package.json"
make_patches
check "package.json becomes a symlink: refused" 1 "" no

new_repo
chmod +x "$REPO/pnpm-lock.yaml"
make_patches
check "mode change: refused" 1 "" no

new_repo
git -C "$REPO" rm -q --cached pnpm-lock.yaml
rm "$REPO/pnpm-lock.yaml"
git -C "$REPO" update-index --add --cacheinfo "160000,$BASE,pnpm-lock.yaml"
git_q -C "$REPO" commit -qm gitlink
git -C "$REPO" format-patch -q -o "$PATCHES" "$BASE..HEAD" >/dev/null
git -C "$REPO" reset -q --hard "$BASE"
check "lockfile becomes a gitlink: refused" 1 "" no

new_repo
sed -i.bak 's/"name": "x",/"name": "x", "devEngines": { "packageManager": { "name": "pnpm", "version": "^11" } },/' "$REPO/package.json" && rm "$REPO/package.json.bak"
make_patches
check "devEngines.packageManager added: refused" 1 "" no

new_repo
printf '{ not json\n' > "$REPO/package.json"
make_patches
check "package.json left unparseable: refused" 1 "" no

new_repo
printf 'lockfileVersion: 9.0\na: 9.9.9\n' > "$REPO/pnpm-lock.yaml"
make_patches
printf 'lockfileVersion: 9.0\nother: 1\n' > "$REPO/pnpm-lock.yaml"
git_q -C "$REPO" commit -qam "base moved"
BASE="$(git -C "$REPO" rev-parse HEAD)"
check "patch doesn't apply: refused" 1 "" no

new_repo
printf 'not a patch\n' > "$PATCHES/0001-junk.patch"
check "malformed patch file: refused" 1 "" no

new_repo
set +e
(cd "$REPO" && bash "$SCRIPT" "$BASE") >/dev/null 2>&1
rc=$?
set -e
if [ "$rc" = 2 ]; then pass=$((pass + 1)); echo "ok   missing argument: usage error"; else fail=$((fail + 1)); echo "FAIL missing argument: rc=$rc (want 2)"; fi

new_repo
check_rc2() {
  local name="$1"
  shift
  set +e
  (cd "$REPO" && bash "$SCRIPT" "$@") >/dev/null 2>&1
  local rc=$?
  set -e
  if [ "$rc" = 2 ]; then pass=$((pass + 1)); echo "ok   $name"; else fail=$((fail + 1)); echo "FAIL $name: rc=$rc (want 2)"; fi
}
check_rc2 "unknown base ref: usage error" no-such-ref "$PATCHES"
printf 'junk\n' > "$PATCHES/0001-x.patch"
printf '{ not json\n' > "$REPO/package.json" && git_q -C "$REPO" commit -qam "bad base"
check_rc2 "base package.json not JSON: usage error" HEAD "$PATCHES"
rm "$PATCHES/0001-x.patch"
check_rc2 "missing patch dir: usage error" "$BASE" "$WORK/nope"
printf 'x\n' > "$REPO/x" && git_q -C "$REPO" add x && git_q -C "$REPO" commit -qm ahead
check_rc2 "HEAD not at base: usage error" "$BASE" "$PATCHES"

echo "deps-bump-apply-patches: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
