# E2E Phase 0: Foundation Infrastructure Design

**Issue:** [#574](https://github.com/ericfitz/tmi-ux/issues/574)
**Parent spec:** `docs/superpowers/specs/2026-04-10-e2e-comprehensive-test-plan-design.md`
**Date:** 2026-04-10

## Overview

Build the cross-cutting E2E test infrastructure that all subsequent phases (1-6) depend on. No new feature coverage — just the machinery. This includes directory restructuring, role-aware authentication fixtures, helper utilities, schema-driven field definitions, a seed data contract, and a visual regression triage skill.

## Decisions Made During Design

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth fixture architecture | Hybrid: per-role exports + multi-role export (Approach C) | Cross-role tests are first-class in Phases 1, 3, 4. Building the multi-role fixture now avoids retrofitting. |
| Test directory structure | Subdirectories per project (`tests/workflows/`, etc.) | Playwright `testDir` maps cleanly; scales to ~325 tests across phases; matches existing page/flow/helper organization. |
| Seed data strategy | Contract document only (no ingestion in Phase 0) | Server team builds ingestion tooling around our format. Tests continue creating data via UI for now. |
| Field definitions source of truth | JSON file consumed by both TypeScript and Python | Single source of truth avoids TS parsing in validator. Python validator uses `uv run` with inline deps. |
| Schema validator language | Python (not JavaScript) | User preference for standalone validation scripts. |
| Auth login mechanism | Go through login UI with `login_hint` parameter | TMI OAuth provider accepts `login_hint` in the sign-in dialog to select a specific test user. |
| Backwards compatibility | None — clean break | Framework is still being built; no legacy shims or re-exports. |
| Visual regression triage agent | Included in Phase 0 | Subsequent phases produce baselines that benefit from the triage workflow. |

## Deliverables

### 1. Directory Structure & Playwright Projects

#### New directory layout

```
e2e/
├── config/test.config.ts              # existing, unchanged
├── setup/global-setup.ts              # existing, unchanged
├── fixtures/
│   ├── test-fixtures.ts               # existing page/flow fixtures, unchanged
│   └── auth-fixtures.ts               # NEW: role-aware auth fixtures
├── schema/
│   ├── field-definitions.json         # NEW: source of truth for field defs
│   ├── field-definitions.ts           # NEW: typed re-export for Playwright
│   └── validate-fields.py            # NEW: OpenAPI validator (Python)
├── seed/
│   └── seed-spec.json                 # NEW: contract doc for server team
├── helpers/
│   ├── translation-scanner.ts         # NEW
│   ├── icon-checker.ts                # NEW
│   ├── screenshot.ts                  # NEW: theme matrix screenshots
│   └── accessibility.ts              # NEW: accessibility snapshot helper
├── pages/                             # existing, unchanged
├── dialogs/                           # existing, unchanged
├── flows/                             # existing, unchanged
└── tests/
    ├── workflows/                     # NEW subdirectory
    │   ├── core-lifecycle.spec.ts     # migrated + refactored
    │   ├── threat-editing.spec.ts     # migrated + refactored
    │   ├── navigation-routing.spec.ts # migrated + refactored + role variants
    │   └── error-scenarios.spec.ts    # migrated + refactored + role variants
    ├── field-coverage/                # NEW, .gitkeep placeholder
    ├── visual-regression/             # NEW, .gitkeep placeholder
    └── admin/                         # NEW, .gitkeep placeholder
```

Old `e2e/tests/*.spec.ts` files are deleted after migration — no re-exports or shims.

#### Playwright config changes

Replace the single `chromium` project with four independent projects:

```typescript
projects: [
  {
    name: 'workflows',
    testDir: './e2e/tests/workflows',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'field-coverage',
    testDir: './e2e/tests/field-coverage',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'visual-regression',
    testDir: './e2e/tests/visual-regression',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'admin',
    testDir: './e2e/tests/admin',
    use: { ...devices['Desktop Chrome'] },
  },
]
```

Each project runs independently via `--project=workflows`, etc. Empty directories get `.gitkeep` so the config doesn't error on missing dirs.

### 2. Role-Aware Auth Fixtures

#### Architecture

File: `e2e/fixtures/auth-fixtures.ts`

Four exports:
- `userTest` — provides `userPage: Page` authenticated as `test-user`
- `reviewerTest` — provides `reviewerPage: Page` authenticated as `test-reviewer`
- `adminTest` — provides `adminPage: Page` authenticated as `test-admin`
- `multiRoleTest` — provides all three (`userPage`, `reviewerPage`, `adminPage`)

#### Login mechanism

The TMI OAuth provider supports a `login_hint` parameter. The login UI flow is:

1. Navigate to `/login`
2. Click the `tmi` provider button (`button[data-provider="tmi"]`)
3. Dialog appears with a login hint input field
4. Type the user identifier (e.g., `test-user`)
5. Click "Sign In"
6. OAuth callback completes, lands on authenticated page

`AuthFlow` gets a `loginAs(userId: string)` method:

```typescript
async loginAs(userId: string): Promise<void> {
  await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  await this.loginPage.providerButton().waitFor({ state: 'visible', timeout: 30000 });
  await this.loginPage.providerButton().click();

  // Dialog appears — type the login hint
  await this.loginPage.loginHintInput().fill(userId);
  await this.loginPage.signInButton().waitFor({ state: 'visible', timeout: 5000 });
  await this.loginPage.signInButton().click();

  await this.page.waitForURL(
    url => !url.pathname.includes('/login') && !url.pathname.includes('/oauth2/callback'),
    { timeout: 30000 }
  );
}
```

`LoginPage` gets a new `loginHintInput()` locator for the hint input field in the dialog.

The existing `AuthFlow.login()` method (no args) is replaced by `loginAs()`. No backwards compatibility wrapper. The `AuthFlow` class in `e2e/flows/auth.flow.ts` is modified in place — `login()` becomes `loginAs(userId: string)`. The existing `test-fixtures.ts` that provides `authFlow` as a fixture is unchanged (it just instantiates `AuthFlow`, doesn't call `login()` directly).

#### Fixture implementation

```typescript
export const userTest = base.extend<{ userPage: Page }>({
  userPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-user');
    await use(page);
    await ctx.close();
  },
});

export const reviewerTest = base.extend<{ reviewerPage: Page }>({
  reviewerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-reviewer');
    await use(page);
    await ctx.close();
  },
});

export const adminTest = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-admin');
    await use(page);
    await ctx.close();
  },
});

export const multiRoleTest = base.extend<{
  userPage: Page;
  reviewerPage: Page;
  adminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-user');
    await use(page);
    await ctx.close();
  },
  reviewerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-reviewer');
    await use(page);
    await ctx.close();
  },
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-admin');
    await use(page);
    await ctx.close();
  },
});
```

#### Page object usage

Tests instantiate page objects inline from the role page:

```typescript
import { userTest as test } from '../../fixtures/auth-fixtures';

test('create a TM', async ({ userPage }) => {
  const dashboard = new DashboardPage(userPage);
  // ...
});
```

No combinatorial fixture explosion (3 roles x N page objects). Explicit and clear.

### 3. Seed Data Specification

File: `e2e/seed/seed-spec.json`

A contract document defining all data the server must provision before E2E tests run. The server team builds idempotent ingestion tooling around this format. Phase 0 writes and versions the file; it is not executed.

Structure adopted from the comprehensive test plan spec (lines 79-305) with these specifics:

- **Users**: `test-user`, `test-reviewer`, `test-admin` — IDs match `login_hint` values
- **Teams**: 1 seed team with members from test users
- **Projects**: 1 seed project linked to team
- **Threat models**: 1 "Full Fields" TM with all child entities populated (threats, assets, documents, repositories, notes, diagrams including a complex 10-node DFD)
- **Surveys**: 2 placeholders (Kitchen Sink, Simple Workflow) — JSON authored in Phase 3
- **Survey responses**: 1 placeholder — authored in Phase 3
- **Admin entities**: groups, quotas, webhooks, settings

Fields marked `_placeholder` are completed during the implementing phase. The `version` field is `"1.0"`.

### 4. Schema-Driven Field Definitions

#### Source of truth: JSON

File: `e2e/schema/field-definitions.json`

```json
{
  "version": "1.0",
  "entities": {
    "threat_model": [
      {
        "apiName": "name",
        "uiSelector": "[data-testid='tm-name']",
        "type": "text",
        "required": true,
        "editable": true
      }
    ],
    "threat": [ ... ],
    "asset": [ ... ],
    "document": [ ... ],
    "repository": [ ... ],
    "note": [ ... ],
    "team": [ ... ],
    "project": [ ... ]
  }
}
```

Each entry has: `apiName`, `uiSelector`, `type` (text | textarea | select | multiselect | checkbox | toggle | date | chips), `required`, `editable`, and optional `options` and `validationRules` arrays.

Field definitions are populated by reading the TMI OpenAPI spec. `uiSelector` values reference `data-testid` attributes — some may not exist in the UI yet. Phase 1 field-coverage tests will surface those gaps.

#### TypeScript re-export

File: `e2e/schema/field-definitions.ts`

```typescript
import fieldData from './field-definitions.json';

export interface FieldDef {
  apiName: string;
  uiSelector: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'toggle' | 'date' | 'chips';
  required: boolean;
  editable: boolean;
  options?: string[];
  validationRules?: string[];
}

export const THREAT_MODEL_FIELDS: FieldDef[] = fieldData.entities.threat_model;
export const THREAT_FIELDS: FieldDef[] = fieldData.entities.threat;
export const ASSET_FIELDS: FieldDef[] = fieldData.entities.asset;
export const DOCUMENT_FIELDS: FieldDef[] = fieldData.entities.document;
export const REPOSITORY_FIELDS: FieldDef[] = fieldData.entities.repository;
export const NOTE_FIELDS: FieldDef[] = fieldData.entities.note;
export const TEAM_FIELDS: FieldDef[] = fieldData.entities.team;
export const PROJECT_FIELDS: FieldDef[] = fieldData.entities.project;
```

#### OpenAPI validator (Python)

File: `e2e/schema/validate-fields.py`

Uses `uv run` with inline TOML dependencies:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx"]
# ///
```

Behavior:
1. Fetches the OpenAPI spec from `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json`
2. Reads `e2e/schema/field-definitions.json`
3. For each entity, compares `apiName` values against the OpenAPI schema properties
4. Reports:
   - Fields in API but missing from field definitions (UI doesn't expose it)
   - Field definitions referencing nonexistent API fields (stale definition)
5. Exits with non-zero status if any stale definitions are found (missing UI fields are warnings, not errors — the UI may intentionally omit some API fields)

pnpm script: `"e2e:validate-schema": "uv run e2e/schema/validate-fields.py"`

### 5. Translation Scanner Helper

File: `e2e/helpers/translation-scanner.ts`

Scans the page DOM for unresolved Transloco translation keys.

```typescript
export async function assertNoMissingTranslations(page: Page): Promise<void>
```

Detection strategy:
1. Query all text nodes in the page via `page.evaluate()`
2. Flag text matching the Transloco unresolved key pattern: 3+ dot-separated segments, alphanumeric/camelCase only, no spaces (e.g., `dashboard.threatModels.title`)
3. Check elements with `[transloco]` attribute that have empty text content
4. Collect all failures as `{ element: string, text: string, selector: string }`
5. Throw with a descriptive error listing all missing translations if any are found

Called after significant page navigations across all test suites in subsequent phases.

### 6. Icon Integrity Checker

File: `e2e/helpers/icon-checker.ts`

Verifies all Material icons on the page rendered correctly.

```typescript
export async function assertIconsRendered(page: Page): Promise<void>
```

Detection strategy:
1. Find all `mat-icon` elements via `page.locator('mat-icon')`
2. For each icon, assert:
   - Non-zero bounding box (width > 0, height > 0)
   - Visible content: either an SVG child element or non-empty text content (ligature name)
3. Collect failures as `{ iconName: string, selector: string, reason: string }`
4. Throw with a descriptive error listing all broken icons if any are found

### 7. Screenshot Baseline Helper

File: `e2e/helpers/screenshot.ts`

Wraps Playwright's `toHaveScreenshot()` with theme matrix support.

```typescript
export interface ScreenshotOptions {
  mask?: Locator[];
  threshold?: number;
  fullPage?: boolean;
}

export async function takeThemeScreenshots(
  page: Page,
  name: string,
  options?: ScreenshotOptions
): Promise<void>
```

Behavior:
1. Iterates over 4 theme modes: `light`, `dark`, `light-colorblind`, `dark-colorblind`
2. For each mode:
   - Toggles theme by manipulating CSS classes on `document.body` and the CDK overlay container:
     - `dark-theme` class for dark modes
     - `colorblind-palette` class for colorblind modes
   - Waits for repaint (`page.waitForTimeout(300)` or `requestAnimationFrame`)
   - Masks dynamic content if specified (timestamps, UUIDs)
   - Calls `expect(page).toHaveScreenshot(`${name}-${mode}.png`, { threshold, fullPage, mask })`
3. Restores the original theme after all screenshots

Theme toggling via direct CSS class manipulation (matching `ThemeService._applyThemeClasses()` behavior) rather than going through Angular DI. More reliable from Playwright, doesn't depend on Angular internals.

Screenshot files use Playwright's default storage location, named `{name}-light.png`, `{name}-dark.png`, `{name}-light-colorblind.png`, `{name}-dark-colorblind.png`.

### 8. Accessibility Snapshot Helper

File: `e2e/helpers/accessibility.ts`

Wraps Playwright's accessibility assertions across all 4 theme modes.

```typescript
export interface AccessibilityOptions {
  skipThemes?: ('light' | 'dark' | 'light-colorblind' | 'dark-colorblind')[];
}

export async function assertAccessibility(
  page: Page,
  options?: AccessibilityOptions
): Promise<void>
```

Behavior:
1. For each theme mode (unless skipped):
   - Toggle theme via CSS classes (same mechanism as screenshot helper)
   - Run checks:
     - All interactive elements are keyboard-focusable
     - All form fields have associated `label` or `aria-label`
     - No duplicate `id` attributes on the page
     - Color contrast meets minimum thresholds (via Playwright accessibility snapshot)
   - Collect failures grouped by theme mode
2. Restore original theme
3. Throw with descriptive error if any failures found

Uses Playwright's `expect(page).toMatchAriaSnapshot()` pattern where available, falling back to manual `page.accessibility.snapshot()` checks.

### 9. Visual Regression Triage Agent

A Claude Code skill that helps resolve visual regression test failures.

#### Skill file

Path: `.claude/skills/visual-regression-triage.md`

#### Trigger conditions

- A visual regression test fails during `pnpm test:e2e` (screenshot mismatch)
- The user mentions or asks about a screenshot test failure

#### Behavior

**Step 1: Gather task context**

Before examining images, understand what the user is working on:

1. Check git branch name — often contains an issue number (e.g., `feature/123-add-widget`)
2. Check recent commit messages — conventional commit prefixes and issue references
3. If a GitHub issue is referenced, fetch its title and body
4. Note which files changed (`git diff --name-only`) and whether they relate to the failing page/component

**Step 2: Parse failure output**

Extract which screenshot(s) failed from Playwright test output. Playwright stores three files per failure in the test results directory:
- `{name}-actual.png` — what the test produced
- `{name}-expected.png` — the baseline
- `{name}-diff.png` — visual diff highlighting changes

**Step 3: Present evidence with context**

Read and display all three images using Claude Code's image reading capability. Describe the visual differences observed. Frame the analysis against the task context:

- If the diff is on a page related to the current issue: "You're working on #123 (feat: add widget to page Y). The screenshot diff for page Y shows [description]. This is likely an expected change from your feature work."
- If the diff is on an unrelated page: "You're working on #456 (fix: auth token refresh). The screenshot diff for page Y shows [description]. This page isn't related to your current work — this looks like an unintended regression."

**Step 4: Ask for decision**

- **Bug** — the change is unintended. The skill helps identify the responsible code change (recent git diff, CSS/template changes near the affected component), suggests a fix, and offers to re-run the failing test to verify.
- **Expected change** — the change is intentional. The skill copies actual → expected to update the baseline, and re-runs the test to confirm it passes.

#### CLAUDE.md integration

Add to `.claude/CLAUDE.md` under a new "Automated Workflows" section:

```markdown
### Visual Regression Triage

When visual regression E2E tests fail (screenshot mismatch in `pnpm test:e2e`),
invoke the `visual-regression-triage` skill to present the baseline, actual, and
diff images, describe the differences, and guide resolution (fix bug or update baseline).
```

### 10. Test Migration & Role Variants

#### Migration

| Source | Destination | Changes |
|--------|-------------|---------|
| `e2e/tests/core-lifecycle.spec.ts` | `e2e/tests/workflows/core-lifecycle.spec.ts` | Replace manual context/login with `userTest` fixture + `loginAs('test-user')`. Keep serial pattern. |
| `e2e/tests/threat-editing.spec.ts` | `e2e/tests/workflows/threat-editing.spec.ts` | Replace manual context/login with `userTest` fixture + `loginAs('test-user')`. Keep serial pattern. |
| `e2e/tests/navigation-routing.spec.ts` | `e2e/tests/workflows/navigation-routing.spec.ts` | Replace `test-fixtures` import with `userTest`. Add role variant tests. |
| `e2e/tests/error-scenarios.spec.ts` | `e2e/tests/workflows/error-scenarios.spec.ts` | Replace `test-fixtures` import with `userTest`. Add role variant tests. |

Old files in `e2e/tests/` are deleted. No re-exports or compatibility wrappers.

#### Serial test handling

`core-lifecycle` and `threat-editing` use `test.describe.serial` with shared state across steps. These need a single page instance across all tests in the `describe` block. The fixture's `loginAs()` is called in `beforeAll` to get the authenticated page, similar to the current pattern but using the new auth mechanism.

#### New role variant tests for navigation-routing

- **Reviewer navbar**: `reviewerTest` — verify triage link visible, dashboard and intake links present
- **Admin navbar**: `adminTest` — verify admin link visible, all nav links present
- **Role guard (reviewer)**: `reviewerTest` — can access `/triage`, blocked from `/admin`
- **Role guard (admin)**: `adminTest` — can access `/admin` and `/triage`
- **User role guard**: existing tests already cover normal user blocked from `/triage`

#### New role variant tests for error-scenarios

- **Unauthorized page per role**: test with each role to verify the unauthorized page renders correctly regardless of role

Form validation tests are role-independent — stay as `userTest` only.

## Acceptance Criteria

- [ ] Seed spec JSON (`e2e/seed/seed-spec.json`) is valid, versioned, and documents all required test data
- [ ] Three role-aware fixtures (`userTest`, `reviewerTest`, `adminTest`) plus `multiRoleTest` authenticate successfully via `login_hint`
- [ ] Field definitions JSON covers all entities; TypeScript re-exports are typed; Python OpenAPI validator runs via `pnpm run e2e:validate-schema`
- [ ] Translation scanner detects intentionally planted missing keys
- [ ] Icon checker detects intentionally hidden/broken icons
- [ ] Screenshot helper produces 4 screenshots per call (light, dark, light-colorblind, dark-colorblind)
- [ ] Accessibility helper runs checks across all 4 theme modes
- [ ] All 4 Playwright projects (`workflows`, `field-coverage`, `visual-regression`, `admin`) can be run independently
- [ ] Existing tests pass in the new `tests/workflows/` location with role fixtures
- [ ] Role variant tests for navigation-routing and error-scenarios pass
- [ ] Visual regression triage skill is defined and referenced in CLAUDE.md
- [ ] README updated to reflect new structure and commands
