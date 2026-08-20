# HANDOFF — state as of 2026-08-19 (v1.11.2)

Read this first when resuming. Everything below is on `main` unless noted.

## Where things stand

- **v1.11.2 on `main`** (`9b271116`). Two batches landed today:
  - **#860 CI quality gate** (PR #863, v1.11.1): `.github/workflows/quality.yml` runs three required checks on every PR — `Checks (lint, typecheck, validate)`, `Unit tests`, `Build` — plus CodeQL; all four are required by the `main` ruleset (ruleset id 17854947) with no bypass. Check-only lint scripts `lint:*:check`; `pretest`/`pretypecheck:vitest` generate the gitignored `src/build-info.json` so fresh checkouts work.
  - **#858 spec type errors 342 → 0** (PR #864, v1.11.2): `pnpm run typecheck:vitest` is a CI gate at **zero**; the ratchet (script, baseline, `*:ratchet` scripts) is gone. Rules for keeping it there: fix fixtures to the real interface; never `any`/`@ts-expect-error`/widening; `as unknown as T` only for deliberately malformed input, commented, and never when a plain `as T` compiles. ESLint's typed rules use `tsconfig.json` (no `@testing/*` alias) — run `lint:check` as well as tsc.
- **tmi-ux is now deployed on the Raspberry Pi k3s cluster** (kube context `k3s-rp`, namespace `tmi-platform`): `http://rp2:30081/` (NodePort 30081; also `http://192.168.1.2:30081/`), image `rp2:30500/tmi-ux:dev`, API URL `http://rp2:30080`. Deploy/redeploy with **`pnpm run deploy:k3s`** (`scripts/deploy-k3s.sh` → `deployments/k8s/dev/k3s/tmi-ux.yml`). Verified serving the v1.11.2 bundle.
  - **Login from the cluster origin works** (verified: `/oauth2/authorize` with `client_callback=http://rp2:30081/…` → 302 with a code; bogus origins → 400). It is enabled by `http://rp2:30081/*` and `http://192.168.1.2:30081/*` in the **live `tmi-server-config` ConfigMap** (`auth.oauth.client_callback_allowlist`) on the cluster, followed by a `tmi-server` restart. **Caveat:** `make dev-up CLUSTER=k3s` in the tmi repo regenerates that ConfigMap from `tmi/config-development.yml`, which does NOT have these entries — add them there (or re-patch the ConfigMap) after any server redeploy. The `system_settings` DB row also carries them but is inert: `SettingsService.GetString` prefers env > config file > DB, so the DB row is only consulted when the YAML lacks the key (contradicts the YAML comment citing #419 — candidate server issue, not yet filed). The dev `tmi` provider redirects straight to the client callback, so `auth.oauth_callback_url` (localhost:8080) is not in play for it.
  - Container builds had two latent breaks fixed in this PR: Dockerfiles didn't `COPY patches` before `pnpm install` (x6 pnpm patch → ENOENT), and the runtime-deps stage lacked `http-proxy-middleware`. All three Dockerfiles fixed.

## Open follow-ups from #858 (Backlog, TMI project)

#865 `fix:` production `_isLocalProviderOffline()` reads phantom `authService.isUsingLocalProvider` via `as any` (always falsy) · #866 two divergent `LoadResult` types / `loadDiagram(): Observable<any>` · #867 validator param vs its `unknown` interface · #868 shared `createTestUser()` factories · #869 `'peer'` literal in related-dialog specs · #870 spec `as any` sweep (~750) · #871 export `PageSize`/`MarginSize`.

## Update 2026-08-19 (evening session)

- **#812 and #821 verified in a real browser** (all four palettes; search/no-match/clear/sort) against `ng serve --configuration=e2e` + port-forward to the k3s API. `#831 test:e2e:field-coverage` ran: 8 passed / ~106 failed / 3 not run — failures are environment seeding (the cluster DB was reseeded and has NO e2e seed users/entities; only `charlie` remains, in Administrators + Security Reviewers), plus one real finding: the stroke-color test reaches the hex input now but a palette-slot edit does not propagate to the node's `body/stroke` (`#ff0000` set, stays `#000000`) — candidate issue.
- **The rp2:30081 blank page root cause was the app itself**: `SecurityConfigService.injectDynamicCSP()` injected `upgrade-insecure-requests` for any production build (container is production:true), upgrading every fetch from the plain-http origin to https → bootstrap death. Fixed (u-i-r only when page protocol is https) alongside relative-apiUrl support (`new URL(apiUrl, window.location.origin)`).
- **TLS at `https://tmi.efitz.net`**: `tmi-ux.yml` now carries a cert-manager `Certificate` (ClusterIssuer `letsencrypt-route53`, secret `tmi-ux-tls`) and a Traefik `Ingress` (entrypoint websecure) at the MetalLB VIP `192.168.1.6`. The deployment switched from `TMI_API_URL=http://rp2:30080` to the same-origin proxy (`TMI_ENABLE_API_PROXY=true`, `TMI_PROXY_TARGET=http://tmi-server:8080`) → config.json serves `apiUrl: "/api"`; no mixed content, WebSockets proxied.
- **Pi-hole (runs in-cluster, ns `pihole`, VIP 192.168.1.10; config via `pihole-FTL --config`)**: added `dns.hosts` entry `192.168.1.6 traefik.local`. The CNAME `tmi.efitz.net,traefik.local` was blocked by the session's permission classifier — see "user actions" below. Note: the record must target the Traefik VIP, not rp2 — nothing serves 443 on node IPs (MetalLB L2 pool 192.168.1.6-15).
- **Step-up re-auth bug candidate**: expired-auth admin actions loop on "Wrong account — you must re-authenticate as charlie@tmi.local"; the silent re-auth doesn't pass the current user's login_hint to the dev tmi provider. Not yet filed.

### Completed later the same evening (user-approved)

- Pi-hole CNAME `tmi.efitz.net -> traefik.local` applied; resolves to 192.168.1.6.
- OAuth allowlist patched in the live `tmi-server-config` ConfigMap (`https://tmi.efitz.net/*`, `http://rp2:30081/*`, `http://192.168.1.2:30081/*`) + tmi-server restart; verified 302-with-code for the allowed origin, 400 for others. Tracked in tmi#774: sync `tmi/config-development.yml` + docs with the live ConfigMap (`make dev-up` overwrites it).
- Two more proxy-mode fixes (d20b561f): `changeOrigin: false` + top-level `/oauth2/authorize` pass-through in server.js (the server mirrors request host into provider auth_urls — with changeOrigin:true browsers were sent to `https://tmi-server:8080`), and the server-connection health check now uses a relative apiUrl as-is (stripping `/api` reduced it to `''` -> SPA page -> "Server offline").
- **Verified end-to-end in Chrome: `https://tmi.efitz.net/` — login (dev user), dashboard, green connected indicator. `http://rp2:30081/` also boots.**

## Next session

1. ~~Verify a full browser login at `https://tmi.efitz.net/`~~ Done (see above).
2. Re-seed the cluster DB with the e2e seed spec (tmi-dbtool) and rerun `test:e2e:field-coverage`; file the palette-slot stroke-propagation issue and the step-up re-auth issue.
3. Decide whether to add the k3s origins to `tmi/config-development.yml` and whether to file the settings-precedence server issue.
4. Pick from #865–#871 (start with #865 — real dead code behind a cast).

## Gotchas (still true)

- `pnpm run lint:i18n` enforces sentence-final punctuation; 143 keys use `.lint-skip`. `pnpm run check-i18n` re-sorts locale files — isolate in a `style:` commit.
- Script/heredoc edits bypass the formatting hook — `format:check` is a CI gate for `src/**` (not `.github/`, `package.json`).
- graphify does not index HTML templates.
- SSH key is Touch ID gated; a `Permission denied (publickey)` push means wait for the user, do not retry.
- `rp2` must resolve (it is pinned in `/etc/hosts`); Docker Desktop trusts `rp2:30500` as insecure; see `tmi/deployments/k8s/dev/k3s/README-node-setup.md`.
- Pi 5 nodes run a 16KB-page kernel: jemalloc-built images (e.g. Chainguard redis) abort; Node images are fine.
