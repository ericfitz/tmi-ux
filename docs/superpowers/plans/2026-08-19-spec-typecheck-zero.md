# Plan: drive tsconfig.vitest.json type errors to zero (#858)

Issue: https://github.com/ericfitz/tmi-ux/issues/858 — decision taken 2026-08-19: option B, drive to zero and replace the ratchet with plain `typecheck:vitest`.

Branch: `feature/spec-typecheck-zero` off `main` @ `9ce220ee` (v1.11.1). Starting count: **342 errors in 83 files** (`typecheck-vitest-baseline.json`).

## Global Constraints

These bind every task. The reviewer checks the diff against them.

1. **Fix the fixture, not the checker.** The error is a mock/fixture/helper whose shape has drifted from the real interface, or a spec whose inference is too loose. Make the spec's values match the real types (add missing required fields, rename drifted fields, type helpers/generics properly). Consult the real interface in `src/app/**` (not the spec) to decide what "correct" is.
2. **Forbidden loosening:** no `any` (explicit or via `as any`), no `// @ts-expect-error`, no `// @ts-ignore`, no `eslint-disable` additions, no widening of a real interface/type to accept the spec's wrong shape, no `Partial<T>` wrappers that hide missing required fields.
3. **`as unknown as T` is allowed in exactly one case:** the test *deliberately* feeds malformed or partial data to exercise an error/edge path, and the cast is the narrowest that compiles. Each such cast must carry a one-line comment saying why the data is intentionally malformed. Any other `as unknown as` is a defect.
4. **No test-semantics changes.** Do not alter assertions, expected values, `describe`/`it` names, or control flow; do not delete, `.skip`, or `.todo` tests. If a type error exposes a test whose fixture could never have exercised what it claims (e.g. the field it sets does not exist on the model), fix the fixture so it *does* exercise it and report it as a finding; if that makes the test fail, the failure is real — **stop and report it (DONE_WITH_CONCERNS), do not paper over it.**
5. **Files you may edit:** only the `.spec.ts` files listed in your task, plus non-spec `.ts` files **inside your task's own directories** when the right fix is tightening a type signature there (e.g. a util returning `{}` that should return a typed value) — type-only, no behavior change, and name it in the report. **Never edit `src/testing/**`** or any file outside your task's directories; if you need a change there, report NEEDS_CONTEXT with the exact change.
6. **Verification per task** (all must pass before DONE):
   - `pnpm exec tsc --noEmit -p tsconfig.vitest.json 2>&1 | grep -F "<each file in your list>"` prints nothing for every file in your list (zero errors in your files; other files' errors are not yours).
   - `pnpm run test <space-separated list of your spec files>` — every test passes, same test count as before your change (report before/after counts).
   - `pnpm run lint:check` and `pnpm run format:check` clean.
7. **Do not touch** `typecheck-vitest-baseline.json`, `scripts/typecheck-vitest-ratchet.mjs`, `package.json`, or `.github/**` in Tasks 1–7. The baseline is lowered once, in Task 8.
8. **Commits:** do NOT commit. The controller commits each task after review. (Parallel tasks share one working tree; disjoint file sets are what keeps that safe — so stay inside your file list.)

Error shapes seen so far, to set expectations: (a) fixture literal missing required fields or using a renamed field (`url` vs `uri`, `_subject` on `User`); (b) result typed `{}` so property reads fail → type the helper/fixture; (c) `service as Record<string, unknown>` to reach privates → use a typed private-access helper or `vi.spyOn` / proper typing; (d) `Object is possibly null` on resolver/observable results → narrow properly with a guard or `expect(x).not.toBeNull()` + non-null after, not `!` sprinkled blindly.

## Tasks 1–7 (independent, parallel-safe, disjoint files)

Each task: read the Global Constraints; for each file run tsc (command above) to list its errors; fix; verify; write the report.

### Task 1: pages/dfd — utils, types, presentation, infrastructure (53 errors)
Files:
  - `src/app/pages/dfd/utils/cell-property-filter.util.spec.ts` (34)
  - `src/app/pages/dfd/types/label-position.types.spec.ts` (1)
  - `src/app/pages/dfd/presentation/components/style-panel/style-panel.component.spec.ts` (3)
  - `src/app/pages/dfd/presentation/services/ui-presenter-coordinator.service.spec.ts` (2)
  - `src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/services/infra-node.service.spec.ts` (4)
  - `src/app/pages/dfd/infrastructure/strategies/infra-websocket-persistence.strategy.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/services/infra-visual-effects.service.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/services/infra-selection.service.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/services/infra-port-state.service.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/services/infra-edge.service.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/embedding-operations-integration.spec.ts` (1)
  - `src/app/pages/dfd/infrastructure/adapters/infra-x6-embedding.adapter.spec.ts` (1)
Note: `cell-property-filter.util.spec.ts` has 34 errors that are almost all "Property 'x' does not exist on type '{}'" — likely one root cause (the util's return type or a fixture helper). Fix the root cause, not 34 sites.

### Task 2: pages/dfd/application (38 errors)
Files:
  - `src/app/pages/dfd/application/executors/node-operation-executor.spec.ts` (8)
  - `src/app/pages/dfd/application/services/app-history.service.spec.ts` (6)
  - `src/app/pages/dfd/application/services/app-cell-operation-converter.service.spec.ts` (4)
  - `src/app/pages/dfd/application/services/app-remote-operation-handler.service.spec.ts` (3)
  - `src/app/pages/dfd/application/services/app-diagram-loading.service.spec.ts` (3)
  - `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.spec.ts` (3)
  - `src/app/pages/dfd/application/executors/edge-operation-executor.spec.ts` (3)
  - `src/app/pages/dfd/application/services/app-diagram-resync.service.spec.ts` (2)
  - `src/app/pages/dfd/application/validators/node-operation-validator.spec.ts` (1)
  - `src/app/pages/dfd/application/validators/general-operation-validator.spec.ts` (1)
  - `src/app/pages/dfd/application/validators/edge-operation-validator.spec.ts` (1)
  - `src/app/pages/dfd/application/services/app-graph-operation-manager.service.spec.ts` (1)
  - `src/app/pages/dfd/application/services/app-edge.service.spec.ts` (1)
  - `src/app/pages/dfd/application/executors/load-diagram-executor.spec.ts` (1)

### Task 3: pages/tm/services (59 errors)
Files:
  - `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts` (20)
  - `src/app/pages/tm/services/report/threat-model-report.service.spec.ts` (18)
  - `src/app/pages/tm/services/providers/authorization-prepare.service.spec.ts` (7)
  - `src/app/pages/tm/services/threat-model.service.spec.ts` (6)
  - `src/app/pages/tm/services/report/pdf-section-renderers.spec.ts` (4)
  - `src/app/pages/tm/services/report/pdf-layout-engine.spec.ts` (3)
  - `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts` (1)
Note: `reference-rewriter.service.spec.ts` fixtures use fields that do not exist on the model types (e.g. `url` where the model has `uri`; `diagram_id`/`asset_id` where the type has none). Check whether the service actually reads those fields — if the fixture names a field the service rewrites, and the real model spells it differently, that test may not exercise the rewrite. See Global Constraint 4. `threat-model-report.service.spec.ts` casts a service to `Record<string, unknown>` to reach privates and casts partial literals to model types.

### Task 4: pages/tm/resolvers + pages/tm/validation (53 errors)
Files:
  - `src/app/pages/tm/resolvers/threat-model.resolver.spec.ts` (27)
  - `src/app/pages/tm/validation/threat-model-validator.service.spec.ts` (12)
  - `src/app/pages/tm/validation/validation-integration.spec.ts` (11)
  - `src/app/pages/tm/validation/diagram-validators.spec.ts` (3)
Note: `threat-model.resolver.spec.ts`: the resolver's return type is a union (`T | RedirectCommand | Observable<…> | Promise<…>`); the spec calls `.pipe` on it. Narrow with a typed helper (e.g. assert `isObservable`) rather than casting; `User` has no `_subject`.

### Task 5: pages/tm/components + pages/surveys + pages/triage + pages/chat + pages/admin (46 errors)
Files:
  - `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts` (5)
  - `src/app/pages/tm/components/threat-page/threat-page.component.spec.ts` (4)
  - `src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.spec.ts` (4)
  - `src/app/pages/tm/components/note-page/note-page.component.spec.ts` (3)
  - `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.spec.ts` (2)
  - `src/app/pages/tm/components/audit-trail-page/audit-trail-page.component.spec.ts` (2)
  - `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts` (1)
  - `src/app/pages/tm/components/invoke-addon-dialog/invoke-addon-dialog.component.spec.ts` (1)
  - `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.spec.ts` (1)
  - `src/app/pages/tm/components/export-dialog/export-dialog.component.spec.ts` (1)
  - `src/app/pages/tm/components/cwe-picker-dialog/cwe-picker-dialog.component.spec.ts` (1)
  - `src/app/pages/surveys/components/survey-list/survey-list.component.spec.ts` (5)
  - `src/app/pages/surveys/services/survey.service.spec.ts` (2)
  - `src/app/pages/surveys/services/survey-response.service.spec.ts` (2)
  - `src/app/pages/surveys/services/survey-draft.service.spec.ts` (1)
  - `src/app/pages/surveys/components/response-detail/response-detail.component.spec.ts` (1)
  - `src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts` (2)
  - `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.spec.ts` (2)
  - `src/app/pages/chat/components/chat-page/chat-page.component.spec.ts` (1)
  - `src/app/pages/admin/users/admin-users.component.spec.ts` (3)
  - `src/app/pages/admin/surveys/components/template-builder/template-builder.component.spec.ts` (1)
  - `src/app/pages/admin/audit/components/audit-table.component.spec.ts` (1)

### Task 6: core/** (49 errors)
Files:
  - `src/app/core/components/navbar/navbar.component.spec.ts` (9)
  - `src/app/core/services/websocket.adapter.spec.ts` (8)
  - `src/app/core/services/dfd-collaboration.service.spec.ts` (7)
  - `src/app/core/interceptors/security-headers.interceptor.spec.ts` (7)
  - `src/app/core/services/theme.service.spec.ts` (5)
  - `src/app/core/services/quota.service.spec.ts` (4)
  - `src/app/core/services/security-config.service.spec.ts` (3)
  - `src/app/core/services/webhook.service.spec.ts` (2)
  - `src/app/core/services/addon.service.spec.ts` (2)
  - `src/app/core/services/access-diagnostics-coverage.spec.ts` (2)

### Task 7: auth/** + shared/** + i18n (44 errors)
Files:
  - `src/app/auth/components/auth-callback/auth-callback.component.spec.ts` (9)
  - `src/app/auth/guards/reviewer.guard.spec.ts` (4)
  - `src/app/auth/guards/admin.guard.spec.ts` (4)
  - `src/app/auth/guards/auth.guard.spec.ts` (3)
  - `src/app/auth/interceptors/jwt.interceptor.spec.ts` (2)
  - `src/app/auth/auth-integration.spec.ts` (2)
  - `src/app/shared/components/provider-display/provider-display.component.spec.ts` (12)
  - `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.spec.ts` (2)
  - `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.spec.ts` (2)
  - `src/app/shared/utils/blob-download.util.spec.ts` (1)
  - `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.spec.ts` (1)
  - `src/app/i18n/language.service.spec.ts` (2)

## Task 8: retire the ratchet (after Tasks 1–7 are complete and the count is 0)

Depends on all of Tasks 1–7. Single implementer, sequential.

1. Confirm `pnpm exec tsc --noEmit -p tsconfig.vitest.json` exits 0 with no diagnostics.
2. Delete `scripts/typecheck-vitest-ratchet.mjs` and `typecheck-vitest-baseline.json`.
3. `package.json`: remove `typecheck:vitest:ratchet` and `pretypecheck:vitest:ratchet`; keep `typecheck:vitest` and `pretypecheck:vitest`.
4. `.github/workflows/quality.yml`: change the step named `Typecheck unit-test sources (ratchet)` to run `pnpm run typecheck:vitest` and rename it `Typecheck unit-test sources`. Nothing else in the workflow changes.
5. Search the repo (`rg -n "ratchet"` excluding `node_modules`, `graphify-out`, `.superpowers`) for remaining references — docs, comments, CLAUDE.md files — and update or remove each. Report the list.
6. Verify: `pnpm run typecheck:vitest` exit 0; `pnpm run lint:check`; `pnpm run format:check`; `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/quality.yml'))"`; `pnpm run validate-json:test`.
7. Do not commit; the controller commits.

## Out of scope
- e2e typecheck (`tsconfig.e2e.json`) — already clean and gated.
- Any refactor of the tests beyond what a type error requires.
