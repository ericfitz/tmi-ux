# HANDOFF — state as of 2026-08-20 (v1.13.0)

Read this first when resuming. Everything below is on `main` unless noted.

## Where things stand

- **v1.13.0 on `main`** (`2c1b2ec7`). Landed 2026-08-20:
  - **PR #876 (v1.12.0)**: small-batch backlog cleanup — #865 (dead `_isLocalProviderOffline()` cast), #871 (export `PageSize`/`MarginSize`), #827, #874. E2E now boots its own dev server. Follow-up filed: **#877** (retire the now-dead localStorage persistence fallback in `AppPersistenceCoordinator`).
  - **PR #878 (v1.13.0)**: #805 admin users — linked accounts dialog with admin unlink.
- **CI quality gate** (v1.11.1): `.github/workflows/quality.yml` runs `Checks (lint, typecheck, validate)`, `Unit tests`, `Build` on every PR; all three + CodeQL are required by the `main` ruleset (id 17854947), no bypass.
- **Spec typecheck at zero** (v1.11.2): `pnpm run typecheck:vitest` is a CI gate at **zero** errors. Rules: fix fixtures to the real interface; never `any`/`@ts-expect-error`/widening; `as unknown as T` only for deliberately malformed input, commented, and never when a plain `as T` compiles. ESLint's typed rules use `tsconfig.json` — run `lint:check` as well as tsc.

## k3s deployment (kube context `k3s-rp`, namespace `tmi-platform`)

- **`https://tmi.efitz.net/`** (Traefik Ingress, MetalLB VIP 192.168.1.6, cert-manager `tmi-ux-tls`) and **`http://rp2:30081/`** (NodePort). Deploy/redeploy with **`pnpm run deploy:k3s`** (`scripts/deploy-k3s.sh` → `deployments/k8s/dev/k3s/tmi-ux.yml`), image `rp2:30500/tmi-ux:dev`.
- Uses the container's **same-origin API proxy** (`TMI_ENABLE_API_PROXY=true`, `TMI_PROXY_TARGET=http://tmi-server:8080`; config.json `apiUrl: "/api"`, WebSockets proxied). `changeOrigin: false` + top-level `/oauth2/authorize` pass-through in server.js are required (d20b561f).
- **Login allowlist — behavior CHANGED (verified 2026-08-20)**: the server was redeployed with the new "bootstrap keys only" ConfigMap, and the allowlist is now **DB-first for real** (the #419 request-time DB preference the old YAML comment falsely claimed is now actual behavior; the old env>YAML>DB precedence note no longer applies). Probing `/oauth2/authorize` (now requires PKCE: `scope`, `response_type=code`, `code_challenge`, `code_challenge_method=S256`):
  - `http://rp2:30081/*` → **302 with code (login works)** — the `system_settings` DB row carries it.
  - `https://tmi.efitz.net/*` → **400 "not in the allowlist"** — missing from the DB row. Fix is a DB update (see "Pending user actions"); no server restart should be needed (read at request time).
  - ConfigMap patching is no longer the fix path; the YAML only carries localhost bootstrap entries. tmi#774 (sync config/docs) still open.
- **Cluster DB state**: reseeded — e2e seed users/entities are GONE; only `charlie` remains (Administrators + Security Reviewers). `test:e2e:field-coverage` needs a re-seed first (tmi-dbtool, e2e seed spec).
- Latest deploy: **v1.13.0 deployed 2026-08-20** (image digest `45a530a5…` confirmed running; `https://tmi.efitz.net/` 200, `http://rp2:30081/` serving) for the #812/#821 verification pass.

## Pending user actions

- **Add `https://tmi.efitz.net/*` to the allowlist DB row** (classifier blocked `kubectl exec` into postgres). Inspect first, then update to match the stored format:
  ```
  kubectl --context k3s-rp -n tmi-platform exec deploy/postgres -- psql -U tmi_dev -d tmi_dev -c "SELECT key, value FROM system_settings WHERE key LIKE '%allowlist%';"
  ```
  Then append `https://tmi.efitz.net/*` to that row's value (format as shown by the SELECT — likely a JSON array) with an UPDATE, or via `tmi-dbtool` if it has a settings command. Re-verify with the PKCE probe (302 expected). Not blocking: #812/#821 can be verified at `http://rp2:30081/` right now.

## Next session — task list

1. **Verify #812 and #821 in a browser against the k3s deployment** (`https://tmi.efitz.net/` or `http://rp2:30081/`):
   - #812: fixed error tones 40/100/30 (white-on-red) in **all four palettes** — deliberate M3 break, user-approved.
   - #821: threat-model list no-match message, clear, and sort behavior.
   - (Both were previously verified only against `ng serve --configuration=e2e` + port-forward, never against the deployed container.)
2. **Run `pnpm run test:e2e:field-coverage`** against the cluster:
   - Prerequisite: re-seed the cluster DB with the e2e seed spec (tmi-dbtool) — last run was 8 passed / ~106 failed / 3 not run, almost all from the missing seed data.
   - One real finding from that run still open: palette-slot stroke edit doesn't propagate to the node's `body/stroke` (`#ff0000` set, stays `#000000`) — **file this issue**.
3. **File the step-up re-auth issue**: expired-auth admin actions loop on "Wrong account — you must re-authenticate as charlie@tmi.local"; silent re-auth doesn't pass `login_hint` to the dev tmi provider.
4. Decide whether to add the k3s origins to `tmi/config-development.yml` (tmi#774) and whether to file the settings-precedence server issue.
5. Backlog follow-ups from #858/#876 (all Backlog, TMI project): **#877** (localStorage fallback retirement — needs a product decision first), #866 (divergent `LoadResult` types), #867 (validator `unknown` param), #868 (shared `createTestUser()` factories — do before #870), #869 (`'peer'` literal in specs), #870 (spec `as any` sweep).
6. #810 (group quota UI) is "This milestone" but **blocked** on server API tmi#647.

## Gotchas (still true)

- `pnpm run lint:i18n` enforces sentence-final punctuation; 143 keys use `.lint-skip`. `pnpm run check-i18n` re-sorts locale files — isolate in a `style:` commit.
- Script/heredoc edits bypass the formatting hook — `format:check` is a CI gate for `src/**` (not `.github/`, `package.json`).
- graphify does not index HTML templates.
- SSH key is Touch ID gated; a `Permission denied (publickey)` push means wait for the user, do not retry.
- `rp2` must resolve (pinned in `/etc/hosts`); Docker Desktop trusts `rp2:30500` as insecure; see `tmi/deployments/k8s/dev/k3s/README-node-setup.md`.
- Pi 5 nodes run a 16KB-page kernel: jemalloc-built images abort; Node images are fine.
- Dockerfiles must `COPY patches` before `pnpm install` (x6 pnpm patch) and runtime-deps must list every `server.js` import — nothing in CI builds the container image.
