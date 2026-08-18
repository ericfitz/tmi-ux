# HANDOFF — CI quality gate (#860), 2026-08-18

Session context for resuming work. Read this first, then start with **Next session** at the bottom.

## Where things stand

**Branch `feature/ci-quality-gate`, one commit `c408f924`, NOT pushed.** The push failed with `Permission denied (publickey)` — the SSH key needs Touch ID. Nothing has been opened on GitHub yet; #860 has no PR.

Everything from the previous batch (v1.11.0, PR #861) is merged and on `main`. Its handoff content is superseded by this file; the only carry-overs are listed under **Still open from the last batch**.

Working tree also carries untracked, uncommitted `.claude/settings.json`, `CLAUDE.md`, and `graphify-out/` — machine-local noise, deliberately not staged. Do not `git add -A`.

## What `c408f924` contains

**`.github/workflows/quality.yml`** — new. `on: pull_request` (any base branch) + `push: main`; a concurrency group cancels superseded PR runs. Three parallel jobs, each doing its own `pnpm install --frozen-lockfile` with `setup-node` pnpm caching, Node from `.nvmrc` (24.15.0):

| Job (check name)                     | Steps                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Checks (lint, typecheck, validate)` | `format:check` → `lint:all:check` → `typecheck:e2e` → `typecheck:vitest:ratchet` → `validate-json:test` → `validate-json:i18n` → `validate-jsonc:tsconfig`. Every step after the first has `if: ${{ !cancelled() }}` so one failure does not hide the rest. Also installs uv (`astral-sh/setup-uv@v7`) for `lint:i18n`. |
| `Unit tests`                         | `pnpm run test`                                                                                                                                                                                                                                                                                                         |
| `Build`                              | `pnpm run build`                                                                                                                                                                                                                                                                                                        |

**`package.json`** — four check-only lint scripts next to the fixing ones: `lint:check`, `lint:e2e:check`, `lint:scss:check`, `lint:all:check`. `lint:all` (with `--fix`) is unchanged for local use.

**`.prettierignore`** — adds `src/assets/i18n/*.usage.json` with a comment explaining why.

## Decisions made — do not relitigate

- **Three jobs, not one.** Timed locally: build 14s, 6070 tests 43s, all lint ~19s. Parallel jobs are cheap and name the failing check in the PR UI. `!cancelled()` on the checks steps means one CI run reports every problem, not just the first.
- **`build` runs unconditionally.** `codeql.yml` builds only for pushes/PRs targeting `main`; a PR into a `release/*` branch has no other build coverage. Duplicating ~14s on main-targeted PRs is cheaper than conditional-skip logic, and a skipped required check is a trap.
- **`en-US.usage.json` is ignored, not reformatted.** `scripts/build-i18n-usage-map.py` writes it with `json.dump(indent=2)`; prettier reformats it, the next regeneration reverts, and a strict `format:check` gate would flap forever.
- **CI does not run `validate-all`.** Its `unused-i18n` step takes 3m16s and always exits 0 — a report, not a gate. CI runs the two validators that can fail plus the validator's `--test` self-check.
- **`lint:all` keeps `--fix`.** Only CI needs check-only. All three linters were verified clean without `--fix`, so nothing was hiding behind the auto-fix.
- **`astral-sh/setup-uv@v7`.** Upstream is on v10 but stopped publishing floating major tags after v7. Nobody bumps actions here (dependabot has no `github-actions` ecosystem), so a floating major that still receives patches beats an exact pin that rots.

## Verified locally before committing (all on this branch)

`format:check` clean · `lint:all:check` clean · `typecheck:e2e` clean · `typecheck:vitest:ratchet` at baseline 342 · `validate-json:test` 8/8 · `validate-json:i18n` + `validate-jsonc:tsconfig` pass · `build` exit 0 · `test` 309 files / 6070 tests pass · `quality.yml` parses (checked with PyYAML).

**Not verified: the workflow has never run on GitHub.** The first PR run is the real test — expect the usual first-run surprises (uv/pnpm setup on the runner, cache keys, the ratchet's `tsc` under Linux).

## Next session

1. **Push and open the PR.** Push needs Touch ID: `git push -u origin feature/ci-quality-gate`. Then `gh pr create` against `main` for #860. Because the PR touches `.github/workflows/`, CodeQL will not trigger on the initial open — push an **empty synchronize commit** (`git commit --allow-empty`) afterward. Pushing workflow files needs the gh `workflow` OAuth scope; if `gh` refuses, that is why. Watch the version-bump `bump` job: `ops:` → patch, but a change touching only non-`src` files does not bump. Here `package.json` changed, so expect a patch bump to `1.11.1` — that is fine.
2. **Watch the first run and fix what breaks.** Do not merge red.
3. **Prove the "demonstrably blocked" acceptance criterion.** Push a throwaway commit that introduces a lint error (or a failing spec) and confirm the `Checks`/`Unit tests` job goes red; then revert it. Record the run URLs in a comment on #860.
4. **Merge, then add the three checks to the `main` ruleset as required** — `Checks (lint, typecheck, validate)`, `Unit tests`, `Build`. After merge, not before: a required check that has never reported on `main` blocks everything. The ruleset currently requires only the CodeQL check with no bypass.
5. **Close #860** with a comment referencing the merge commit. Then follow up:
   - Add a `github-actions` ecosystem to `.github/dependabot.yml` so action majors get bumped (motivated by the setup-uv decision above). File as a `chore:` issue or just do it.
   - Update the `no-ci-quality-gates` memory (`~/.claude/projects/-Users-efitz-Projects-tmi-ux/memory/`) — it will be wrong once this merges.
   - Update the `main-ruleset-codeql-trigger-gotcha` memory to list the three new required checks.
   - Delete this file when #860 is closed and the follow-ups are done or filed.

## Still open from the last batch (untouched this session)

- **#858 — spec type errors, 342 at baseline.** The user has not yet decided ratchet-vs-zero. No mechanical class remains; the rest are mocks whose shape drifted from their interfaces. If driving down, start with `dfd/utils/cell-property-filter.util.spec.ts` (34) and `tm/resolvers/threat-model.resolver.spec.ts` (27). Prior recommendation: keep the ratchet, lower opportunistically. **Fixing spec types requires lowering the baseline in the same commit** (`node scripts/typecheck-vitest-ratchet.mjs --update`) or the ratchet fails — and once `quality.yml` merges, that failure is now a blocked PR.
- **Browser verification debt** — merged in v1.11.0 without ever being exercised in a browser:
  - #812 page-header close buttons: confirm white-on-red in all four palettes (light/dark × normal/colorblind) and that no button lost its hit area.
  - #821 triage search: click through the no-match state and the column-sort fix (the sort wiring was broken since inception; unit-tested now, never clicked).
  - #831 e2e: `pnpm run test:e2e:field-coverage` with `pnpm dev:e2e` plus a backend on `:8080` — the stroke/fill tests were fixed by reading the gating logic, never executed.

## Gotchas (carried forward, still true)

- `pnpm run lint:i18n` enforces sentence-final punctuation; 143 keys use the `.lint-skip` hatch. Locale terminals: `。` ja/zh, `।` hi, `۔` ur, none for th/bn.
- `pnpm run check-i18n` re-sorts every locale file; isolate its churn in a separate `style:` commit.
- Script/heredoc edits bypass the formatting PostToolUse hook — run `prettier --write` on them or `format:check` (now a CI gate) fails.
- graphify does not index HTML templates; grep directly for template/CSS sweeps.
- The SSH key is Touch ID gated. A push failure with `Permission denied (publickey)` means the user has not touched — wait, do not retry or work around.
