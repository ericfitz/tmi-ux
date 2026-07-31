# TMI-UX Integration Test Plan

Produced by `/itest:design` on 2026-07-31. Discovery was read-only: nothing was built, run, or deployed.

Contracts behind this plan (all in the session scratchpad): `stack`, `docs`, `topology`, `journeys`, `conventions`, `critique`, `state`, `scenarios`.

---

## 1. Boundary

**Playwright drives the real Angular SPA (e2e build, `enableE2eTools` on) at `E2E_APP_URL` against a real TMI server at `E2E_API_URL` with its real Postgres and Redis.** Seed data is provisioned out-of-band and idempotently by `make e2e-seed` in the sibling `tmi` repo; identity comes from the server's built-in `tmi` test OAuth provider via `login_hint` (requires the server's dev/test `build_mode`). Where a scenario claims persistence, it additionally reads state back through an independent REST call using the page's authenticated session, rather than re-reading the page it just wrote.

|                     |                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real**            | SPA bundle, REST API, WebSocket (ticket-auth), Postgres, Redis, the `tmi` test OAuth provider                                                                         |
| **Stubbed**         | External IdPs (Google/GitHub/Microsoft) — the `tmi` provider stands in; Google/Microsoft file pickers — left to the human-attended opt-in `google-drive-live` project |
| **Out of boundary** | Server egress (webhook delivery, email); server-internal behavior with no client-observable effect                                                                    |

**Rationale.** This is the only boundary the repo owns end to end, and the one already built out (four Playwright projects, flows/page-objects/dialog-objects, delete-via-api teardown, server-side seeding). It is also the only boundary at which the product's authorization model is observable — which is where most of the untested risk sits. Everything below it (calculator math, input-validation permutations, SurveyJS's own `visibleIf` engine, X6 rendering) is disqualified by the tier rule and pushed down to Vitest.

**Consequence to accept:** requirements enforceable only server-to-server — CSP/HSTS headers, CSRF token mechanics, refresh-token rotation internals, container non-root — are **unobservable at this boundary**. They appear in the gap map as findings, not tests.

---

## 2. Scenario set

27 scenarios: 9 p0, 16 p1, 2 p2. Provenance: 22 `both`, 2 `journey`, 3 `requirement`. Full detail in `scenarios.contract.json`.

| Journey                       | Scenarios                                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J01 TM lifecycle (critical)   | S-J1-1 create/edit/delete with API read-back · S-J1-2 child entities persist · S-J1-3 export/import round-trip + `is_confidential` write-once                                                                         |
| J02 Auth/session (critical)   | S-J2-1 login → cross-tab → logout revocation · S-J2-2 deep link preserved through login                                                                                                                               |
| J03 DFD authoring (critical)  | S-J3-1 UI-built diagram persists and survives reload · S-J3-2 reader read-only, no persisted mutation                                                                                                                 |
| J04 Threats (critical)        | S-J4-1 cell-linked threat + scores persist across reload · S-J4-2 framework determines threat-type options                                                                                                            |
| J05 Intake (critical)         | S-J5-1 fill + submit + persisted response · S-J5-2 draft save/resume                                                                                                                                                  |
| J06 Triage (high)             | S-J6-1 six-step cross-role lifecycle, no early exit · S-J6-2 non-reviewer denied list and actions                                                                                                                     |
| J07 Permissions (high)        | S-J7-1 writer grant · **S-J7-2 reader denied in UI and at API** · **S-J7-3 confidential invisible (with positive control)** · S-J7-4 `everyone` + highest-role-wins · S-J7-5 ownership transfer preserves prior owner |
| J08 Collaboration (high)      | S-J8-1 propagation + graceful solo-mode exit · S-J8-2 reader blocked in session · S-J8-3 reader cannot start session · S-J8-4 concurrent edits converge                                                               |
| J09 Survey authoring (medium) | S-J9-1 publish offers / deactivate withdraws                                                                                                                                                                          |
| J10 Teams & projects (medium) | S-J10-1 non-admin CRUD + dashboard filter with absence control                                                                                                                                                        |
| J13 Timmy (medium)            | S-J13-1 TM-scoped chat honoring `timmy_enabled`                                                                                                                                                                       |
| — cross-cutting               | **S-CC-1 markdown XSS sweep** · S-CC-2 admin/service-account denial + immutable server fields                                                                                                                         |

**Pushed down to Vitest (tier rule):** CVSS/SSVC calculator math, CWE lookup, form-validation permutations and error wording, SurveyJS `visibleIf` mechanics, embedding-rule validators, zoom bounds, import file-size/type rejection, X6 attribute rendering.

**Deferred with reason:** session expiry-warning dialog and 401-refresh-retry (need a short-TTL server token config that cannot be injected at this boundary).

---

## 3. Preconditions and isolation

**Composition is the default.** Every prerequisite in this plan is reachable through a journey already under test, ids are server-assigned (so they must be captured, not chosen), and the test process holds no database credential — direct injection is not available from inside a test. The one injection-shaped affordance (`make e2e-seed` via the sibling repo's dbtool) runs out-of-band before the suite and establishes the shared baseline only.

Three rules this plan adopts, each closing a systemic defect the critique found:

1. **Per-test composition, not hoisted serial fixtures.** 23 existing files hoist a `beforeAll` context whose mutations later tests consume; one early failure cascades into misattributed failures. Every scenario here composes its own state.
2. **Composed setup is asserted.** Each precondition carries `assert_established`, so a half-failed create reports as a setup failure rather than as a bug in the step under test.
3. **Cleanup is asserted, never swallowed.** `delete-via-api` is the strategy throughout (the only teardown affordance this project has from inside a test); `catch(() => undefined)` is banned — 12 existing files leak `Date.now()`-named entities onto the one shared backend.

Isolation otherwise comes from serial execution (`workers: 1`) plus run-unique naming. No transaction rollback, namespacing, or ephemeral containers are available here.

---

## 4. Assertion design

- **Observable at this boundary:** rendered UI state, the independent REST read-back, WebSocket-driven convergence, HTTP status codes, absence from a list _gated behind a positive control_.
- **Never assert:** X6 attribute paths, private fields, logger message strings, mock call counts.
- **Negative assertions carry the authorization invariants:** "no other TM changed", "the threat still exists", "no admin route returned 200 to the service-account token", "no `javascript:` href reached the DOM".
- **Determinism:** bounded polling with explicit failure on timeout; wait on the response, never `waitForTimeout`; never `waitForLoadState('networkidle')` — TMI's session/token pollers keep the network busy, as `dfd-autosave.spec.ts:101` already documents.

Vocabulary follows the project glossary: threat model, DFD, cell, `is_confidential`, `everyone` pseudo-group, `update_vector`, solo mode, triage, CCG.

---

## 5. Gap map

### 5a. Journey coverage vs. existing tests

| Journey                             | Status         | Note                                                                                                                                     |
| ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| J01 TM lifecycle                    | **weak**       | `tm-workflows` asserts outcomes already true before the action; no server read-back                                                      |
| J02 Auth/session                    | **weak**       | Login is exercised by every fixture but never asserted as a subject; logout/cross-tab untested                                           |
| J03 DFD authoring                   | **misleading** | Four DFD specs drive `window.__e2e`/raw X6 and never observe the server; two plates would pass with the app's own node/edge code deleted |
| J04 Threats                         | **weak**       | `scoring-systems` fails the tier rule (calculator math) and never reloads to check persistence                                           |
| J05 Intake                          | **weak**       | `survey-fill` rewrites shared seed fixtures in `beforeAll`; list assertions hold regardless of the feature                               |
| J06 Triage                          | **misleading** | Assignment test has zero `expect` calls and four unconditional early returns; cross-role spec silently drops steps 4–6                   |
| J07 Permissions                     | **missing**    | No reader-denial test anywhere; confidential negative assertion satisfiable by an unrendered dashboard                                   |
| J08 Collaboration                   | **missing**    | Deliberately out of scope in the original plan (R-S01-05); no fixtures exist                                                             |
| J09 Survey authoring                | **weak**       | Status-toggle assertion matches "Inactive" via `/active/i`; archive unasserted; clone leaks a fixture duplicate                          |
| J10 Teams & projects                | **weak**       | Runs as `test-admin`, erasing the API-scoping dimension; filter assertions lack an absence control                                       |
| J13 Timmy                           | **missing**    | No tests; feature status itself unclear                                                                                                  |
| Admin surface (no longer a journey) | **weak**       | 8 specs, all weak/repair; quotas and webhooks never create the entity they name                                                          |

### 5b. Requirements coverage (highest-priority findings first)

**Contradicted** — a normative document disagrees with the code:

- **R-W13-2** — the wiki's Testing page states Playwright runs Chromium, Firefox and WebKit with an auto-started dev server; `playwright.config.ts` defines Chrome-only projects and `global-setup.ts` _fails_ unless both services are already running externally.
- **R-S01-02** — the e2e design spec makes schema-driven field coverage fail when a schema field has no UI exposure, but `SKIP_FIELDS` lists silence that signal without recording _why_. The `alias` skip in `tm-fields.spec.ts` turns out to be legitimate — issue #305 states the initial release deliberately exposes no UI for it — which is exactly the problem: the mechanism cannot distinguish "intentionally not exposed, tracked by #305" from "accidentally dropped". `threat-fields.spec.ts` skips the required `threat_type` on a rationale ("chips only render when values exist") that the seed name `Seed Threat - All Fields` contradicts, and nothing in the suite would tell those two cases apart.

**Misleading coverage** — a test passes while the requirement is broken: R-S02-01 (six-step lifecycle, early return), R-S03-02 (confidential invisibility, unrendered-list negative), theme persistence (test stamps the classes it asserts), R-W09-15/selection-styling (test scrubs the artifact it detects).

**Untested** — documented `must` with no coverage: R-W10-2 (CCG 403 on every `/admin` route), R-T02-02 / R-T05-01 (markdown sanitization — a _confirmed_ finding), R-W09-1/R-W09-8 denial halves, R-W09-3 (ownership transfer re-grant), R-W09-6 (`everyone` pseudo-group), R-W6-1 (reader cannot start a session), R-W09-14 (reader mutation blocked in session), R-W09-15 (`update_vector` resync), R-S05-01/R-S05-03 (home-menu role gating), R-W14-1 (`timmy_enabled` scoping).

**Unobservable at this boundary** (findings, not tests): R-T02-03 (CSP/HSTS headers), R-T02-05 (CSRF token mechanics), R-T04-01/R-T04-02 (refresh-token rotation, absolute session lifetime), R-T02-07 (non-root container), R-W11-2 (RFC 6902 JSON-Patch shape), R-W10-8 (WebSocket origin checking), R-W12-* server-side identity-link internals.

---

## 6. Risks, assumptions, and doc/code conflicts

### Open assumptions riding into the build phase

From `topology`: the TMI server's Postgres/Redis are started by the sibling repo's tooling; `server.js`'s listen call and runtime-config key list were not read; `TMI_ENABLE_API_PROXY` is unused in production; the `tmi` provider's authorization-code flow requires dev/test `build_mode`.
From `state`: the dbtool seed is idempotent and current; the JWT lives in memory / HttpOnly cookie and not in web storage; flow-level deletes hard-delete rather than soft-delete; `make test-db-cleanup` covers all artifact types the suite creates.
Scenario-specific: server-side object-level authorization on every write (the load-bearing unconfirmed assumption of the entire threat model — S-J3-2, S-J7-2 are the scenarios that would expose its absence); autosave issues an observable request per batch; LLM credentials or a canned mode exist for Timmy.

### doc_code_conflicts

| requirement_id | doc_claim                                                                       | code_evidence                                                                                                                                                                                                                                                                                                                                    | authority                        | verdict                                        |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------- |
| R-W13-2        | Playwright runs Chromium + Firefox + WebKit with an auto-started dev server     | `playwright.config.ts:24-57` defines Chrome-only projects; `e2e/setup/global-setup.ts:40-45` throws unless both services are already up                                                                                                                                                                                                          | descriptive (wiki runbook)       | likely_stale_doc                               |
| R-S01-02       | A schema field with no corresponding FieldDef must fail the suite               | `SKIP_FIELDS` silences the signal without recording why: `tm-fields.spec.ts:8-22` skips `alias` (legitimately — #305 says no UI is exposed in the initial release), while `threat-fields.spec.ts:10-12` skips the required `threat_type` on a rationale the `Seed Threat - All Fields` seed contradicts; the mechanism cannot tell the two apart | normative (approved design spec) | likely_code_defect                             |
| R-S03-04       | All scoring calculators tested including add **and remove** of multiple entries | `scoring-systems.spec.ts:84` applies an SSVC decision without asserting it landed and never removes it                                                                                                                                                                                                                                           | normative                        | likely_code_defect                             |
| R-S02-01       | The cross-role survey test must exercise all six lifecycle steps                | `survey-cross-role.spec.ts:185` returns early when the revision row is absent, reporting success after three steps                                                                                                                                                                                                                               | normative                        | likely_code_defect                             |
| R-T05-01       | Markdown link rendering must apply a scheme allowlist and escape quotes         | TRIAGE.md records f001 as a confirmed finding against current file paths; no test covers any render surface                                                                                                                                                                                                                                      | descriptive (security triage)    | undetermined — S-CC-1 is designed to settle it |
| R-W09-15       | Server sends `state_correction` on `update_vector` mismatch, forcing resync     | The only tests referencing history/selection state are in `src/app/pages/dfd/integration/`, excluded from vitest and claimed by no Playwright project — they run nowhere                                                                                                                                                                         | normative (architecture doc)     | undetermined                                   |

_Not adjudicated: nothing here was executed._

---

## 7. Recommended sequencing

1. **S-CC-1** (markdown XSS) — a confirmed finding with no regression guard.
2. **S-J7-2, S-J7-3, S-CC-2** — the authorization boundary, entirely untested today, and the scenarios that would expose the threat model's load-bearing open question.
3. **Repair the three misleading files** the critique named: delete `theme-persistence.spec.ts`, fix `triage-workflows.spec.ts`'s assertion-free test, remove the early return in `survey-cross-role.spec.ts`.
4. **Retire or rebuild `src/app/pages/dfd/integration/`** — five files that run nowhere, three of which cannot compile (they reference the deleted `InfraX6HistoryAdapter`).
5. **S-J1-1, S-J3-1, S-J4-1** — the read-back pattern, then propagate it across the existing suite.
6. J08 collaboration scenarios last: net-new infrastructure, explicitly out of scope in the original plan.
