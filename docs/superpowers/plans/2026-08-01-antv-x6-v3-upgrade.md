# @antv/x6 v2 → v3 Upgrade Implementation Plan (issue #446)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Graphify rule:** any subagent exploring code MUST run `graphify query "<question>"` before reading/grepping raw source files (project rule; graphify-out/graph.json exists).

**Goal:** Upgrade `@antv/x6` 2.19.2 → 3.1.7, remove the six now-consolidated `@antv/x6-plugin-*` packages, and work around the upstream ESM/CJS packaging bug so build, unit tests, and E2E all pass.

**Architecture:** v3 merges all plugins plus `@antv/x6-common`/`@antv/x6-geometry` into the core package; `graph.use(new Plugin())` is unchanged, only import paths move. The DFD module's x6 access is already funneled through infrastructure adapters/services, so source changes are confined to four files. The one real engineering obstacle is upstream [antvis/X6#5048](https://github.com/antvis/X6/issues/5048): `@antv/x6@3.1.7` declares `"type": "module"` with `"main": "lib/index.js"` (CJS content, no `exports` map), so Node's ESM loader crashes on it — which breaks Vitest. We fix it with a `pnpm patch` that points `main` at the real ESM build (`es/index.js`).

**Tech Stack:** Angular 22, Vitest 4 (jsdom), Playwright E2E (incl. visual regression), pnpm 10 (`pnpm patch`).

## Global Constraints

- `@antv/x6` must be pinned **exact** at `3.1.7`: the pnpm patch is keyed to `@antv/x6@3.1.7`, and a range bump would silently invalidate it. Keep a `comments.dependencies` entry explaining this.
- All six `@antv/x6-plugin-*` packages are removed, including the never-imported `@antv/x6-plugin-history`. Do **not** adopt `@antv/x6-plugin-clipboard@3.0.0` — clipboard lives in core now.
- Use pnpm scripts only: `pnpm run build`, `pnpm test`, `pnpm run lint:all`, `pnpm test:e2e`. No bespoke `ng`/`vitest`/`playwright` invocations.
- Conventional commits; branch `feature/x6-v3-upgrade` off `main`; integrate via PR (main ruleset requires PR + CodeQL).
- After code changes land, run `graphify update .` (project rule).

## Verified v3 facts (from the shipped 3.1.7 tarball, not guesswork)

| v2 usage                                                                       | v3 replacement                                                                                        | Where used                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `import { Snapline/Transform/Export/Clipboard } from '@antv/x6-plugin-*'`      | same names `from '@antv/x6'`                                                                          | `infra-x6-graph.adapter.ts:26-31`   |
| `import { Selection, Transform } from '@antv/x6-plugin-*'`                     | same names `from '@antv/x6'`                                                                          | `infra-x6-selection.adapter.ts:3-4` |
| `Edge.Properties` (namespace type — **removed**, TS2702)                       | flat `EdgeProperties` interface                                                                       | `infra-edge.service.ts:266` (×2)    |
| `Markup.JSONMarkup`                                                            | flat `MarkupJSONMarkup` type                                                                          | `edge-markup.util.ts:12`            |
| `Shape.Rect.define` / `Shape.Edge.define`                                      | unchanged (`Shape` is still a module-object export)                                                   | `infra-x6-shape-definitions.ts`     |
| `Cell, Edge, Graph, Model, Node, NumberExt, Shape, Markup` value/class imports | all still exported from core                                                                          | 76 files — no change needed         |
| `.transition()` animation API (removed in v3)                                  | not used anywhere in src (verified)                                                                   | —                                   |
| `panning` now default-enabled                                                  | we already configure panning explicitly in `infra-x6-graph.adapter.ts` (~L369) — verify, don't change | —                                   |

Behavioral note for testing: in v3, when panning and the Selection plugin conflict, **selection takes priority**. We use both; E2E + manual smoke must confirm rubber-band select and canvas pan still behave as before.

## Decision points (approve before executing)

1. **ESM/CJS workaround = `pnpm patch` of `@antv/x6@3.1.7`** (change `"main"` to `"es/index.js"`). Alternative considered: Vitest-only `resolve.alias` to `@antv/x6/es/index.js`. The patch is preferred because it fixes every Node-resolution consumer in one place and is self-documenting in `package.json` `patchedDependencies`; the alias fixes only Vitest and can drift. Drop the patch when upstream ships a fixed release (leave a follow-up note on #446).
2. **Exact-pin 3.1.7** (see Global Constraints). This keeps the package out of `/bump` auto-updates, which is intended while the patch exists.

---

### Task 1: Branch, dependency swap, ESM/CJS patch

**Files:**

- Modify: `package.json` (deps + `comments.dependencies` + `pnpm.patchedDependencies` added by pnpm)
- Create: `patches/@antv__x6@3.1.7.patch` (generated by `pnpm patch-commit`)
- Modify: `pnpm-lock.yaml` (generated)

**Interfaces:**

- Consumes: nothing (first task)
- Produces: an installed `@antv/x6@3.1.7` that loads under Node ESM; plugin packages gone. Later tasks assume `import { EdgeProperties, MarkupJSONMarkup, Export, Snapline, Transform, Clipboard, Selection } from '@antv/x6'` resolves.

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main && git pull && git checkout -b feature/x6-v3-upgrade
```

- [ ] **Step 2: Swap dependencies**

```bash
pnpm remove @antv/x6-plugin-clipboard @antv/x6-plugin-export @antv/x6-plugin-history @antv/x6-plugin-selection @antv/x6-plugin-snapline @antv/x6-plugin-transform
pnpm add --save-exact @antv/x6@3.1.7
```

Expected: install succeeds, no `@antv/x6-plugin-*` remains in `package.json`.

- [ ] **Step 3: Demonstrate the upstream bug (failing check first)**

```bash
node -e "import('@antv/x6').then(m => console.log(typeof m.Graph))"
```

Expected: **FAIL** — an ESM/CJS error (e.g. `require is not defined` or `Unexpected token 'module.exports'`) because `main` points CJS `lib/index.js` at Node's ESM loader.

- [ ] **Step 4: Patch the package**

```bash
pnpm patch @antv/x6@3.1.7
# pnpm prints an editable dir, e.g. /private/var/.../antv-x6@3.1.7
```

In the printed directory, edit `package.json`: change `"main": "lib/index.js"` to `"main": "es/index.js"`. Then:

```bash
pnpm patch-commit <printed-dir>
```

- [ ] **Step 5: Verify the check now passes**

```bash
node -e "import('@antv/x6').then(m => console.log(typeof m.Graph))"
```

Expected: prints `function`.

- [ ] **Step 6: Update the pin-reason comment**

In `package.json`, replace the `comments.dependencies["@antv/x6"]` value with:

```json
"@antv/x6": "Pinned exact at 3.1.7: pnpm patch (patches/@antv__x6@3.1.7.patch) fixes upstream antvis/X6#5048 (type:module + CJS main); a version bump invalidates the patch. Remove patch + relax pin when upstream ships a fix. See issue #446."
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml patches/
git commit -m "deps: upgrade @antv/x6 to 3.1.7, drop consolidated plugin packages

Removes @antv/x6-plugin-{clipboard,export,history,selection,snapline,transform}
(merged into @antv/x6 core in v3; history was never imported).
Adds a pnpm patch pointing main at the ESM build to work around antvis/X6#5048."
```

Note: the build is **expected to be broken** at this commit (TS2702 in `infra-edge.service.ts`); Task 2 fixes it. Do not push yet.

---

### Task 2: Source migration (4 files)

**Files:**

- Modify: `src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts:25-31`
- Modify: `src/app/pages/dfd/infrastructure/adapters/infra-x6-selection.adapter.ts:2-4`
- Modify: `src/app/pages/dfd/infrastructure/services/infra-edge.service.ts:2,266`
- Modify: `src/app/pages/dfd/infrastructure/utils/edge-markup.util.ts:1,12`

**Interfaces:**

- Consumes: Task 1's installed/patched `@antv/x6@3.1.7`.
- Produces: a compiling app (`pnpm run build` green). No public API of any adapter/service changes — this is import-path and type-name substitution only.

- [ ] **Step 1: Capture the failing baseline**

```bash
pnpm run build 2>&1 | grep -E "ERROR|error TS" | head -30
```

Expected: FAIL with `TS2702: 'Edge' only refers to a type...` at `infra-edge.service.ts` and module-not-found for the removed `@antv/x6-plugin-*` imports. Save the full list — any error beyond these four files is new information; handle it in Step 4.

- [ ] **Step 2: Apply the four edits**

`infra-x6-graph.adapter.ts` — replace lines 25–31:

```typescript
// Before
import { Graph, Node, Edge, Cell } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Export } from '@antv/x6-plugin-export';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import '@antv/x6-plugin-clipboard';
import { Clipboard } from '@antv/x6-plugin-clipboard';

// After
import { Graph, Node, Edge, Cell, Export, Snapline, Transform, Clipboard } from '@antv/x6';
```

(The two bare side-effect imports existed only to register the plugins' module augmentation; v3 core needs neither.)

`infra-x6-selection.adapter.ts` — replace lines 2–4:

```typescript
// Before
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { Selection } from '@antv/x6-plugin-selection';
import { Transform } from '@antv/x6-plugin-transform';

// After
import { Graph, Node, Edge, Cell, Selection, Transform } from '@antv/x6';
```

`infra-edge.service.ts` — line 2 and line 266:

```typescript
// Before (line 2)
import { Edge, Node } from '@antv/x6';
// After
import { Edge, Node, type EdgeProperties } from '@antv/x6';

// Before (line 266)
private _ensureEdgeAttrs(attrs: Edge.Properties['attrs']): Edge.Properties['attrs'] {
// After
private _ensureEdgeAttrs(attrs: EdgeProperties['attrs']): EdgeProperties['attrs'] {
```

If nothing else in the file still uses `Edge` as a value after this change, drop `Edge` from the import (lint will flag it).

`edge-markup.util.ts` — line 1 and line 12:

```typescript
// Before
import { Markup } from '@antv/x6';
export function getEdgeMarkup(): Markup.JSONMarkup[] {
// After
import type { MarkupJSONMarkup } from '@antv/x6';
export function getEdgeMarkup(): MarkupJSONMarkup[] {
```

- [ ] **Step 3: Rebuild**

```bash
pnpm run build
```

Expected: PASS, or a strictly smaller error list than Step 1's baseline.

- [ ] **Step 4: Triage any residual compile errors (spike loop)**

For each remaining error: find the v3 replacement by inspecting the installed typings under `node_modules/@antv/x6/lib/**/*.d.ts` (v3 pattern: namespace types became flat `<Class><Member>` interfaces, e.g. `Cell.Properties` → `CellProperties`, `Node.Metadata` → `NodeMetadata`). Apply the same substitution style as Step 2. If an API was _removed_ (not renamed) — stop and surface it for discussion before inventing a workaround; that would be new scope beyond this plan's verified facts.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dfd/
git commit -m "refactor: migrate DFD x6 imports and namespace types to v3 API"
```

---

### Task 3: Unit test pass

**Files:**

- Modify: only what failures dictate (most likely candidates: `src/app/pages/dfd/**/*.spec.ts`, `src/app/pages/dfd/application/services/test-helpers/mock-services.ts`, `src/app/shared/services/cell-data-extraction.service.spec.ts`)

**Interfaces:**

- Consumes: compiling app from Task 2.
- Produces: green unit suite; proves the pnpm patch works for Vitest's Node-ESM resolution (this is the load-bearing validation of the Task 1 decision).

- [ ] **Step 1: Run the DFD-scoped tests first (fast signal)**

```bash
pnpm test -- src/app/pages/dfd src/app/shared/services/cell-data-extraction.service.spec.ts
```

Expected: PASS. If x6 fails to _load_ (ESM/CJS errors), the Task 1 patch is insufficient — check whether Vitest resolved a different copy (`pnpm why @antv/x6`), and fix the patch rather than adding config workarounds.

- [ ] **Step 2: Run the full unit suite**

```bash
pnpm test
```

Expected: PASS. Fix any failures to root cause — never skip tests (repo rule). Assertion-level failures (not load failures) mean a v3 behavior change; compare against the v2 behavior before adjusting the assertion, and note each such change in the PR description.

- [ ] **Step 3: Commit (only if test files changed)**

```bash
git add -u src/
git commit -m "test: adjust DFD specs for @antv/x6 v3 behavior"
```

---

### Task 4: Full local gate — build, lint, tests

**Files:** none new; fixes only if the gate fails.

**Interfaces:**

- Consumes: Tasks 2–3 complete.
- Produces: the repo's standard completion gate, all green, ready for E2E.

- [ ] **Step 1: Run the gate**

```bash
pnpm run build && pnpm run lint:all && pnpm test
```

Expected: all PASS. Fix lint fallout (e.g. now-unused `Edge` import from Task 2) and commit as `style:` or fold into the relevant fix commit.

---

### Task 5: E2E — DFD workflows, field coverage, visual regression

**Files:**

- Possibly modify: `e2e/tests/visual-regression/dfd-visual-regression.spec.ts-snapshots/*` (baseline updates, only with justification)

**Interfaces:**

- Consumes: green local gate from Task 4.
- Produces: evidence the rendered DFD canvas and interactions are unchanged (or a documented, approved list of intentional visual deltas).

- [ ] **Step 1: Run the DFD E2E specs**

```bash
pnpm test:e2e -- --grep "dfd"
```

(If the project's e2e script doesn't accept `--grep`, run the suites by path: `e2e/tests/workflows/dfd-*.spec.ts`, `e2e/tests/field-coverage/dfd-*.spec.ts`, `e2e/tests/visual-regression/dfd-*.spec.ts` — but prefer whatever the pnpm script supports.)

Expected: PASS. Pay particular attention to `dfd-interactions.spec.ts` and `dfd-controls.spec.ts` — the v3 "selection beats panning on conflict" change would surface here.

- [ ] **Step 2: Triage any visual-regression mismatch with the `ui:vrt` skill**

Per repo rule: on screenshot mismatch invoke `ui:vrt`, present baseline/actual/diff, and decide bug vs. intentional change. Do **not** silently regenerate baselines; each updated snapshot needs a stated reason (e.g. sub-pixel antialiasing change in v3 renderer).

- [ ] **Step 3: Commit any approved baseline updates**

```bash
git add e2e/tests/visual-regression/
git commit -m "test: update DFD visual baselines for x6 v3 rendering deltas"
```

---

### Task 6: Manual smoke + behavior verification

**Files:** none (verification only; findings loop back into Tasks 2–5 fixes).

- [ ] **Step 1: Verify panning config is still explicit** — confirm the `panning` option in `infra-x6-graph.adapter.ts` (~L369) is set explicitly (v3 default flipped to enabled; explicit config means no behavior change).
- [ ] **Step 2: Launch the app (`run` skill / dev server) and exercise, in one seeded diagram:** node create (all shapes: actor, process, store, security-boundary, text), edge draw between ports, node resize (Transform), snapline appearance while dragging, copy/paste (Clipboard, incl. paste offset), delete, undo/redo (app-level history), selection rubber-band + multi-select, canvas pan + zoom, node embedding into security boundary, z-order operations, label editing, SVG export and diagram thumbnail capture, autosave, and a two-tab collaborative session sanity check.
- [ ] **Step 3: Record results** — note anything off as a finding; fix before PR or explicitly defer with a filed issue.

---

### Task 7: Review, PR, issue closure

- [ ] **Step 1: Code review** — run `superpowers:requesting-code-review` on the branch diff (repo rule before committing/merging significant work).
- [ ] **Step 2: Update the knowledge graph**

```bash
graphify update .
```

Commit any graphify-out changes if the repo tracks them.

- [ ] **Step 3: Push and open the PR** (SSH push may require a physical key touch; on failure stop and hand off, never work around)

```bash
git push -u origin feature/x6-v3-upgrade
gh pr create --title "deps: upgrade @antv/x6 to v3.1.7 (consolidated plugins, ESM patch)" --body "<summary: what changed, the pnpm patch rationale w/ link to antvis/X6#5048, v3 behavior notes (selection-vs-panning), test evidence incl. E2E/VRT results. Closes #446>"
```

The `deps:` type produces a patch version bump via the version-bump workflow; CodeQL must pass (required check).

- [ ] **Step 4: After merge** — comment on #446 referencing the merge commit (repo rule) and close it (the `Closes #446` in the PR body should do this automatically; verify). Add a follow-up note (or new issue) : "when antvis/X6#5048 is fixed upstream, remove `patches/@antv__x6@3.1.7.patch`, relax the exact pin, and let `/bump` manage x6 again."

---

## Test plan summary

| Layer                        | What                       | Command                           | What it proves                                                                                        |
| ---------------------------- | -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Package load                 | Node ESM import probe      | `node -e "import('@antv/x6')..."` | the pnpm patch neutralizes antvis/X6#5048                                                             |
| Compile                      | Angular build              | `pnpm run build`                  | namespace-type migration complete; no missed v3 renames                                               |
| Unit (82 DFD specs + shared) | Vitest/jsdom               | `pnpm test`                       | adapters/services behave identically on v3; x6 loads under Vitest                                     |
| Lint                         | ESLint + i18n checks       | `pnpm run lint:all`               | no dead imports left by the migration                                                                 |
| E2E functional               | 8 DFD workflow/field specs | `pnpm test:e2e` (dfd specs)       | real-browser interactions: draw, edit, history, autosave, controls                                    |
| E2E visual                   | DFD VRT snapshots          | same run; triage via `ui:vrt`     | pixel-level rendering parity of the v3 canvas                                                         |
| Manual                       | smoke checklist (Task 6)   | —                                 | plugin behaviors (clipboard/snapline/transform/export), selection-vs-panning priority, collab session |

## Risks

- **Upstream instability:** 3.2.7/3.3.7 were published-then-unpublished (2026-05-19); the exact pin + patch insulate us, at the cost of manual future upgrades.
- **Hidden v3 type renames** beyond the four verified files — bounded by Task 2 Step 4's triage loop; the error baseline makes any surprise visible immediately.
- **Behavioral deltas** (selection/panning priority, renderer changes) — covered by E2E + VRT + manual smoke rather than assumptions.
- **Patch fragility:** anyone bumping x6 without reading the comment invalidates the patch; the exact pin plus the `comments.dependencies` note is the guard.
