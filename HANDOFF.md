# HANDOFF — state as of 2026-08-19 (v1.11.2)

Read this first when resuming. Everything below is on `main` unless noted.

## Where things stand

- **v1.11.2 on `main`** (`9b271116`). Two batches landed today:
  - **#860 CI quality gate** (PR #863, v1.11.1): `.github/workflows/quality.yml` runs three required checks on every PR — `Checks (lint, typecheck, validate)`, `Unit tests`, `Build` — plus CodeQL; all four are required by the `main` ruleset (ruleset id 17854947) with no bypass. Check-only lint scripts `lint:*:check`; `pretest`/`pretypecheck:vitest` generate the gitignored `src/build-info.json` so fresh checkouts work.
  - **#858 spec type errors 342 → 0** (PR #864, v1.11.2): `pnpm run typecheck:vitest` is a CI gate at **zero**; the ratchet (script, baseline, `*:ratchet` scripts) is gone. Rules for keeping it there: fix fixtures to the real interface; never `any`/`@ts-expect-error`/widening; `as unknown as T` only for deliberately malformed input, commented, and never when a plain `as T` compiles. ESLint's typed rules use `tsconfig.json` (no `@testing/*` alias) — run `lint:check` as well as tsc.
- **tmi-ux is now deployed on the Raspberry Pi k3s cluster** (kube context `k3s-rp`, namespace `tmi-platform`): `http://rp2:30081/` (NodePort 30081; also `http://192.168.1.2:30081/`), image `rp2:30500/tmi-ux:dev`, API URL `http://rp2:30080`. Deploy/redeploy with **`pnpm run deploy:k3s`** (`scripts/deploy-k3s.sh` → `deployments/k8s/dev/k3s/tmi-ux.yml`). Verified serving the v1.11.2 bundle.
  - **Pending (needs you, blocked for Claude by the permission classifier):** browser login from that origin needs `http://rp2:30081/*` (and `http://192.168.1.2:30081/*`) in the server's runtime `auth.oauth.client_callback_allowlist` — a **DB row** (`system_settings`) that overrides the YAML. One-liner in the last session transcript / or: `kubectl --context k3s-rp -n tmi-platform exec sts/postgres -- psql …` appending to the JSON array. Also note the server's `auth.oauth_callback_url` is `http://localhost:8080/oauth2/callback`; if login still fails after the allowlist change, that redirect URI is the next suspect (it assumes a `localhost:8080` port-forward). Consider adding the k3s origin to `tmi/config-development.yml` so a fresh DB seeds it.
  - Container builds had two latent breaks fixed in this PR: Dockerfiles didn't `COPY patches` before `pnpm install` (x6 pnpm patch → ENOENT), and the runtime-deps stage lacked `http-proxy-middleware`. All three Dockerfiles fixed.

## Open follow-ups from #858 (Backlog, TMI project)

#865 `fix:` production `_isLocalProviderOffline()` reads phantom `authService.isUsingLocalProvider` via `as any` (always falsy) · #866 two divergent `LoadResult` types / `loadDiagram(): Observable<any>` · #867 validator param vs its `unknown` interface · #868 shared `createTestUser()` factories · #869 `'peer'` literal in related-dialog specs · #870 spec `as any` sweep (~750) · #871 export `PageSize`/`MarginSize`.

## Next session

1. **Browser verification debt** (merged in v1.11.0, never exercised in a browser) — the k3s deployment now gives you a real target: #812 page-header close buttons white-on-red in all four palettes (light/dark × normal/colorblind); #821 triage search no-match state + column sort; #831 `pnpm run test:e2e:field-coverage` (needs `pnpm dev:e2e` + a backend on `:8080`).
2. Complete the k3s login config (above), then smoke-test login at `http://rp2:30081/`.
3. Pick from #865–#871 (start with #865 — real dead code behind a cast).

## Gotchas (still true)

- `pnpm run lint:i18n` enforces sentence-final punctuation; 143 keys use `.lint-skip`. `pnpm run check-i18n` re-sorts locale files — isolate in a `style:` commit.
- Script/heredoc edits bypass the formatting hook — `format:check` is a CI gate for `src/**` (not `.github/`, `package.json`).
- graphify does not index HTML templates.
- SSH key is Touch ID gated; a `Permission denied (publickey)` push means wait for the user, do not retry.
- `rp2` must resolve (it is pinned in `/etc/hosts`); Docker Desktop trusts `rp2:30500` as insecure; see `tmi/deployments/k8s/dev/k3s/README-node-setup.md`.
- Pi 5 nodes run a 16KB-page kernel: jemalloc-built images (e.g. Chainguard redis) abort; Node images are fine.
