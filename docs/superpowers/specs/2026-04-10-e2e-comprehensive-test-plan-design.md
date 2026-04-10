# Comprehensive E2E Test Coverage Plan

## Overview

A phased plan to expand E2E test coverage from the current 26 tests (covering basic threat model lifecycle) to comprehensive coverage of all user workflows, all editable fields, and visual regression across the entire TMI-UX application.

## Goals

1. **Workflow coverage** — Verify the expected scenarios for all three user roles (normal users, security reviewers, admins)
2. **Field coverage** — Exercise every user-editable field to prevent regressions, driven by the API schema to catch fields the UI fails to expose
3. **Visual regression** — Detect missing translation keys, broken icons, alignment issues, and layout regressions via screenshot baselines and DOM assertions
4. **Theme coverage** — All visual checks run against a 4-mode theme matrix (light, dark, light+colorblind, dark+colorblind)
5. **Cross-role workflows** — Test handoffs between user roles (e.g., survey submission → triage review)

## Current State

- 26 tests across 4 suites: core lifecycle, threat editing, navigation/routing, error scenarios
- Three-layer architecture: Tests → Flows → Page Objects
- Real backend integration (no mocks)
- Chromium only
- Single user role tested (normal user via `tmi` OAuth provider)
- No visual regression, no translation validation, no admin/survey/triage coverage

## Design Decisions

These were discussed and agreed during brainstorming:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data strategy | Hybrid: API-seeded for workflow tests, pre-seeded fixtures for field coverage | Workflow tests should create data as part of the scenario; field tests shouldn't spend time on setup |
| Visual regression | Targeted assertions + selective screenshot baselines | Assertion-based for known failure modes (translations, icons); screenshots for unexpected layout regressions |
| Role simulation | Pre-provisioned test accounts, one login per suite | Most realistic; accounts defined in seed spec; login cost amortized per suite |
| Field test granularity | Grouped by entity, parameterized per field, schema-driven | Precise failure reporting; catches "forgot to expose a field"; field definitions double as documentation |
| DFD testing depth | Controls + interaction workflows + screenshot baselines | Full depth including rendering verification for both created and pre-loaded diagrams |
| Survey testing | Infrastructure + question types (with conditional logic) + triage handoff | Cross-role workflow is critical and completely untested |
| Admin testing | Full coverage, all sub-pages | Every admin page gets field-level and workflow treatment |
| Translation validation | Static analysis (build-time) + E2E DOM scanning (runtime) | Static catches bulk issues; E2E catches dynamic key failures and empty values |
| Test organization | Multiple Playwright projects by concern | Run right tests for right change; independent setup/retry/parallelism per project |
| Collaboration testing | Out of scope — standalone GitHub issue | High effort, server-side failure modes; deserves its own design |

## Architecture

### Playwright Projects

```
playwright.config.ts projects:
├── workflows          — Scenario/lifecycle tests (serial, shared state)
├── field-coverage     — Schema-driven field validation (parallelizable per entity)
├── visual-regression  — Screenshot baselines + DOM assertions (translations, icons)
└── admin              — Admin-specific tests (admin auth context)
```

Each project has its own setup, authentication fixture, and can be triggered independently.

### Test Layers (existing, extended)

```
Tests (*.spec.ts)        — Scenarios with assertions
  └── Flows (*-flow.ts)  — Multi-step user workflows (no assertions)
    └── Page Objects     — Element locators and single-step helpers
      └── Dialog Objects — Dialog-scoped locators
```

### Theme Matrix

All visual regression screenshots and accessibility snapshots run in 4 modes:

1. Light mode
2. Dark mode
3. Light mode + color blindness setting
4. Dark mode + color blindness setting

Translation and icon sweeps are theme-independent and run once.

### Seed Data Specification

A machine-readable JSON file (`e2e/seed/seed-spec.json`) defining all data the server must provision before tests run. The server team builds ingestion automation around this format.

```json
{
  "version": "1.0",
  "description": "E2E test seed data specification",
  "users": [
    {
      "id": "test-user",
      "email": "test-user@tmi.test",
      "display_name": "Test User",
      "roles": { "is_admin": false, "is_security_reviewer": false },
      "oauth_provider": "tmi"
    },
    {
      "id": "test-reviewer",
      "email": "test-reviewer@tmi.test",
      "display_name": "Test Reviewer",
      "roles": { "is_admin": false, "is_security_reviewer": true },
      "oauth_provider": "tmi"
    },
    {
      "id": "test-admin",
      "email": "test-admin@tmi.test",
      "display_name": "Test Admin",
      "roles": { "is_admin": true, "is_security_reviewer": true },
      "oauth_provider": "tmi"
    }
  ],
  "teams": [
    {
      "name": "Seed Team Alpha",
      "status": "active",
      "members": [
        { "user_id": "test-user", "role": "member" },
        { "user_id": "test-reviewer", "role": "lead" }
      ],
      "metadata": [{ "key": "department", "value": "Engineering" }]
    }
  ],
  "projects": [
    {
      "name": "Seed Project One",
      "team": "Seed Team Alpha",
      "status": "active",
      "metadata": [{ "key": "fiscal_year", "value": "2026" }]
    }
  ],
  "threat_models": [
    {
      "name": "Seed TM - Full Fields",
      "description": "Threat model with all fields populated for field-coverage testing",
      "owner": "test-reviewer",
      "threat_model_framework": "STRIDE",
      "status": "active",
      "is_confidential": false,
      "project_id": "Seed Project One",
      "security_reviewer": "test-reviewer",
      "issue_uri": "https://example.com/issues/1",
      "alias": ["seed-tm-1", "full-fields-tm"],
      "metadata": [{ "key": "risk_level", "value": "high" }],
      "authorization": [
        { "user_id": "test-user", "role": "reader" },
        { "user_id": "test-reviewer", "role": "writer" }
      ],
      "threats": [
        {
          "name": "Seed Threat - All Fields",
          "description": "A fully populated threat for field testing",
          "threat_type": ["spoofing", "tampering"],
          "severity": "high",
          "score": "9.8",
          "priority": "critical",
          "status": "open",
          "mitigated": false,
          "mitigation": "Implement input validation and CSRF tokens",
          "cwe_id": ["CWE-79", "CWE-352"],
          "cvss": [
            { "version": "3.1", "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "score": 9.8 }
          ],
          "issue_uri": "https://example.com/issues/2",
          "include_in_report": true
        }
      ],
      "assets": [
        {
          "name": "Seed Asset - User Database",
          "description": "Primary user data store",
          "type": "data",
          "criticality": "high",
          "classification": ["confidential", "pii"],
          "sensitivity": "high",
          "include_in_report": true
        },
        {
          "name": "Seed Asset - Web Server",
          "type": "infrastructure",
          "criticality": "high"
        }
      ],
      "documents": [
        {
          "name": "Architecture Doc",
          "uri": "https://example.com/docs/architecture.pdf",
          "description": "System architecture documentation",
          "include_in_report": true
        }
      ],
      "repositories": [
        {
          "name": "Main Codebase",
          "type": "git",
          "uri": "https://github.com/example/repo",
          "description": "Primary application repository",
          "ref_type": "branch",
          "ref_value": "main",
          "subpath": "src/",
          "include_in_report": true
        }
      ],
      "notes": [
        {
          "name": "Review Notes",
          "content": "## Initial Review\n\nFindings from the first pass:\n- Input validation gaps\n- Missing CSRF protection",
          "description": "Security review findings",
          "include_in_report": true
        }
      ],
      "diagrams": [
        {
          "name": "Simple DFD",
          "type": "dfd",
          "nodes": [
            { "id": "actor-1", "type": "actor", "label": "End User", "x": 100, "y": 200 },
            { "id": "process-1", "type": "process", "label": "Web App", "x": 400, "y": 200 },
            { "id": "store-1", "type": "store", "label": "Database", "x": 700, "y": 200 }
          ],
          "edges": [
            { "source": "actor-1", "target": "process-1", "label": "HTTP Request" },
            { "source": "process-1", "target": "store-1", "label": "SQL Query" }
          ]
        },
        {
          "name": "Complex DFD",
          "type": "dfd",
          "description": "Complex diagram for rendering regression testing",
          "nodes": [
            { "id": "actor-ext", "type": "actor", "label": "External User", "x": 50, "y": 150 },
            { "id": "actor-int", "type": "actor", "label": "Internal Admin", "x": 50, "y": 450 },
            { "id": "process-gw", "type": "process", "label": "API Gateway", "x": 300, "y": 300, "parent": null },
            { "id": "process-auth", "type": "process", "label": "Auth Service", "x": 550, "y": 150 },
            { "id": "process-core", "type": "process", "label": "Core Service", "x": 550, "y": 300 },
            { "id": "process-notify", "type": "process", "label": "Notification Service", "x": 550, "y": 450 },
            { "id": "store-db", "type": "store", "label": "Primary DB", "x": 800, "y": 200 },
            { "id": "store-cache", "type": "store", "label": "Redis Cache", "x": 800, "y": 400 },
            { "id": "store-queue", "type": "store", "label": "Message Queue", "x": 800, "y": 550 },
            { "id": "process-embedded", "type": "process", "label": "Validator", "x": 320, "y": 320, "parent": "process-gw" }
          ],
          "edges": [
            { "source": "actor-ext", "target": "process-gw", "label": "HTTPS Request" },
            { "source": "actor-int", "target": "process-gw", "label": "Admin API" },
            { "source": "process-gw", "target": "process-auth", "label": "Auth Check" },
            { "source": "process-gw", "target": "process-core", "label": "Business Logic" },
            { "source": "process-auth", "target": "store-db", "label": "User Lookup" },
            { "source": "process-core", "target": "store-db", "label": "CRUD Operations" },
            { "source": "process-core", "target": "store-cache", "label": "Cache Read/Write" },
            { "source": "process-core", "target": "process-notify", "label": "Event Trigger" },
            { "source": "process-notify", "target": "store-queue", "label": "Enqueue Message" },
            { "source": "process-embedded", "target": "process-auth", "label": "Validate Token" }
          ]
        }
      ]
    }
  ],
  "surveys": [
    {
      "name": "Kitchen Sink Survey",
      "description": "Survey with all supported question types for integration testing",
      "status": "active",
      "survey_json": {
        "_comment": "SurveyJS schema including: text, textarea, dropdown, checkbox, radiogroup, matrix, rating, boolean, file, plus conditional visibility logic (e.g., show follow-up question when a specific answer is selected)",
        "_placeholder": "Full SurveyJS JSON to be authored during Phase 3 implementation"
      },
      "settings": { "link_threat_model": true }
    },
    {
      "name": "Simple Workflow Survey",
      "description": "Minimal survey for workflow testing (fill, submit, triage)",
      "status": "active",
      "survey_json": {
        "_comment": "3-5 basic questions: text name, dropdown category, textarea description",
        "_placeholder": "Full SurveyJS JSON to be authored during Phase 3 implementation"
      },
      "settings": {}
    }
  ],
  "survey_responses": [
    {
      "survey": "Simple Workflow Survey",
      "user": "test-user",
      "status": "submitted",
      "responses": {
        "_comment": "Matching answers for the simple workflow survey questions",
        "_placeholder": "Authored during Phase 3 implementation"
      }
    }
  ],
  "admin_entities": {
    "groups": [
      { "name": "Seed Group - Engineering", "members": ["test-user", "test-reviewer"] }
    ],
    "quotas": [
      { "user": "test-user", "rate_limit": 100, "period": "hour" }
    ],
    "webhooks": [
      {
        "name": "Seed Webhook",
        "url": "https://example.com/webhook",
        "events": ["threat_model.created", "threat_model.updated"],
        "hmac_secret": "test-secret-value"
      }
    ],
    "addons": [],
    "settings": [
      { "key": "default_theme", "value": "light" },
      { "key": "max_upload_size_mb", "value": "50" }
    ]
  }
}
```

The seed spec is versioned in `e2e/seed/seed-spec.json` alongside the tests. Fields marked `_placeholder` are authored during the implementing phase. The server team builds ingestion tooling that accepts this format and provisions the dataset idempotently (safe to re-run).

### Multi-Role Authentication Fixtures

Extend `e2e/fixtures/test-fixtures.ts` with role-aware browser contexts:

```typescript
// Each fixture creates a BrowserContext, runs OAuth login for its user,
// and provides an authenticated Page
export const userTest = base.extend<{ userPage: Page }>({ ... });      // test-user
export const reviewerTest = base.extend<{ reviewerPage: Page }>({ ... }); // test-reviewer
export const adminTest = base.extend<{ adminPage: Page }>({ ... });    // test-admin
```

### Schema-Driven Field Definitions

Field definitions derived from the TMI OpenAPI spec (`tmi-openapi.json`):

```typescript
// e2e/schema/field-definitions.ts
interface FieldDef {
  apiName: string;           // Field name in API schema
  uiSelector: string;        // data-testid selector or role query
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'toggle' | 'date' | 'chips';
  required: boolean;
  options?: string[];         // For select/multiselect types
  validationRules?: string[]; // e.g., 'url', 'email'
}

export const THREAT_MODEL_FIELDS: FieldDef[] = [ ... ];
export const THREAT_FIELDS: FieldDef[] = [ ... ];
export const ASSET_FIELDS: FieldDef[] = [ ... ];
// ... one export per entity
```

A validation utility compares these definitions against the OpenAPI spec at test time and fails if:

- A field exists in the API schema but has no corresponding `FieldDef` (UI doesn't expose it)
- A `FieldDef` references an `apiName` that doesn't exist in the schema (stale test definition)

### Translation Scanner

```typescript
// e2e/helpers/translation-scanner.ts
async function assertNoMissingTranslations(page: Page): Promise<void> {
  // Walks all text nodes in the DOM
  // Flags any text matching Transloco's unresolved key pattern (dotted.key.path)
  // Also flags empty text in elements that have a [transloco] attribute
}
```

Called after every significant page navigation across all test suites.

### Icon Integrity Checker

```typescript
// e2e/helpers/icon-checker.ts
async function assertIconsRendered(page: Page): Promise<void> {
  // Finds all mat-icon elements
  // Asserts each has non-zero bounding box dimensions
  // Asserts each has visible content (SVG child or text ligature)
}
```

### Screenshot Baseline Helper

```typescript
// e2e/helpers/screenshot.ts
async function takeThemeScreenshots(
  page: Page,
  name: string,
  options?: { mask?: Locator[], threshold?: number }
): Promise<void> {
  // For each mode in [light, dark, light+colorblind, dark+colorblind]:
  //   1. Apply theme via ThemeService toggle
  //   2. Wait for repaint
  //   3. Mask dynamic content (timestamps, UUIDs)
  //   4. Call expect(page).toHaveScreenshot(`${name}-${mode}.png`, ...)
}
```

Baseline storage: `e2e/screenshots/<project>/<name>-<mode>.png`

### Visual Regression Triage Agent

A Claude Code agent (skill) that activates when visual regression tests fail. Defined in the project's `.claude/` directory and referenced in `CLAUDE.md`.

**Agent behavior:**

1. Reads the Playwright test failure output to identify which screenshot(s) failed
2. Loads three images for each failure: the baseline image, the actual (new) image, and the diff image (Playwright generates all three)
3. Presents all three images to the user with a description of the differences observed (e.g., "The action button row shifted 4px down, and the save icon appears to be missing")
4. Asks the user to choose:
   - **Bug** — The regression is unintended. The agent helps identify the responsible code change and fix it, then re-runs the failing test to verify
   - **Expected change** — The regression is a side effect of an intentional code change. The agent prompts the user to confirm, then updates the baseline image with the actual image and re-runs the test to verify it passes

**CLAUDE.md integration:**

Add guidance to `.claude/CLAUDE.md` instructing Claude Code to invoke this agent whenever:
- A visual regression test fails during the normal test completion flow (i.e., after running `pnpm test:e2e`)
- The user asks about or mentions a screenshot test failure

**Deliverable:** Part of Phase 0 (Foundation Infrastructure), since all subsequent phases produce screenshot baselines that benefit from this workflow.

## Phases

### Phase 0: Foundation Infrastructure

**Goal:** Build the scaffolding that all subsequent phases depend on.

**Deliverables:**

1. **Seed data specification** (`e2e/seed/seed-spec.json`) — machine-readable, versioned, as specified above
2. **Multi-role auth fixtures** — `userTest`, `reviewerTest`, `adminTest` extending the base fixture system
3. **Schema-driven field definitions** — `e2e/schema/field-definitions.ts` with `FieldDef` types for all entities, plus the OpenAPI validation utility
4. **Translation scanner helper** — `e2e/helpers/translation-scanner.ts`
5. **Icon integrity checker** — `e2e/helpers/icon-checker.ts`
6. **Screenshot baseline helper** — `e2e/helpers/screenshot.ts` with theme matrix support
7. **Playwright projects configuration** — Update `playwright.config.ts` with `workflows`, `field-coverage`, `visual-regression`, `admin` projects
8. **Accessibility snapshot helper** — Wraps Playwright's accessibility snapshot, runs in all 4 theme modes
9. **Visual regression triage agent** — Claude Code agent (skill) that presents baseline vs. actual vs. diff images, describes differences, and guides the user to either fix the bug or update the baseline. Referenced in `.claude/CLAUDE.md` so Claude Code invokes it automatically on screenshot test failures.

**Migration of existing tests:** The existing 26 tests (core-lifecycle, threat-editing, navigation-routing, error-scenarios) are reorganized into the new Playwright project structure. `core-lifecycle` and `threat-editing` move to the `workflows` project. `navigation-routing` and `error-scenarios` stay in `workflows` but are refactored to use the new role-aware fixtures. No test behavior changes — this is purely organizational.

**Dependencies:** None. This is the starting point.

### Phase 1: Threat Model Deep Coverage

**Goal:** Fill out complete coverage for the threat model area — the most-used feature. Validates all Phase 0 patterns.

**Workflow tests:**

| Test | Role | Description |
|------|------|-------------|
| Reviewer edits assigned TM | Reviewer | Login → open assigned TM → edit threats, add scoring → update status → add notes |
| Owner shares TM | User + Reviewer | Owner creates TM → shares with reviewer (writer) → reviewer opens and edits → owner sees changes |
| Project association | User | Create TM → link to project → verify dashboard filter |
| Framework selection | User | Create TM with STRIDE → verify framework-specific threat categories |
| Confidential TM | Admin + User | Admin marks TM confidential → normal user cannot see it |
| Export workflow | User | Open TM → trigger export → verify dialog options render |

**Child entity CRUD workflows:**

| Entity | Operations tested |
|--------|-------------------|
| Assets | Create → set all fields (type, criticality, classification, sensitivity) → save → reload → verify → delete |
| Documents | Create → set URI + description → verify URL validation → save → delete |
| Repositories | Create → set type, URI, ref type/value, subpath → save → delete |
| Notes | Create → edit markdown → verify markdown renders → save → delete |
| Metadata | Add key-value → edit → delete (MetadataDialog) |
| Permissions | Add reader → upgrade to writer → remove → verify authorization list |

**Schema-driven field coverage:**

- Load seeded "Full Fields" TM → for each `FieldDef`, assert UI element exists, displays seeded value, can be edited, persists after save+reload
- Same pattern for threats (15 fields), assets (7), documents (5), repositories (8), notes (4)

**Scoring systems:**

- SSVC calculator: set decision points → verify vector → verify persistence
- Multiple CVSS scores: add 3.1 + 4.0 → verify both chips → remove one → verify other
- Multiple CWE references: add 2-3 → verify all chips → remove one → verify others
- Framework mappings: add mapping → verify display → remove

**Visual regression:**

- Screenshot baselines (×4 theme modes) for: dashboard, TM edit page, threat detail, asset/document/repository/note editors
- Translation scan on every page
- Icon integrity check on every page
- Action button alignment checks

**Dependencies:** Phase 0 complete.

### Phase 2: DFD Editor Full Coverage

**Goal:** Complete coverage of the most technically complex component.

**Controls and chrome:**

- All toolbar buttons (node creation for each type) render and function
- Style panel: open → verify controls → change property → verify applied
- History controls: undo/redo button states match graph history
- Export controls: dialog renders with format options (PNG, JPG, SVG)
- Help dialog: opens, content renders, closes
- Graph data dialog: metadata fields render, edit, save
- Close/back navigation: returns to TM edit page

**Interaction workflows:**

| Workflow | Steps |
|----------|-------|
| Node lifecycle | Add each node type → select → move (drag) → edit properties via cell dialog → delete |
| Edge lifecycle | Add two nodes → create edge → select edge → edit label/properties → delete |
| Embedding | Create process → drag node into it → verify parent-child → verify z-order |
| Multi-select | Select multiple cells → delete all → undo → verify restored |
| Undo/redo chain | 3-4 operations → undo each → redo each → verify state at each step |
| Auto-save | Make changes → wait for auto-save → reload → verify graph state |

**Complex diagram loading (from seed data):**

- Load seeded "Complex DFD" → wait for render → screenshot baseline
- Assert expected node count/types from seed spec
- Assert edges exist between expected node pairs (via `page.evaluate()` on X6 model)
- Assert embedded nodes inside parent containers
- Pan/zoom: zoom in → screenshot → zoom out → screenshot → fit-to-view → screenshot

**DFD visual regression:**

Screenshot baselines (×4 theme modes) for:
- Empty diagram
- Single node of each type
- 3-node, 2-edge simple diagram
- Complex seeded diagram
- After move/resize operation

**Icon picker:**

- Open picker → search → select → verify node icon updates in graph canvas

**Dependencies:** Phase 0 complete. Phase 1 recommended first (validates patterns).

### Phase 3: Surveys, Intake, and Triage (Cross-Role Workflows)

**Goal:** Cover the full survey lifecycle across all three user roles.

**Admin survey authoring (admin role):**

- Create survey → template builder → add questions → save → verify in list
- Kitchen sink survey: verify each question type renders in builder, including conditional visibility logic (show/hide questions based on answers)
- Survey settings: configure threat model linking → save → verify persistence
- Survey lifecycle: create → publish (active) → deactivate → archive → verify each status affects end-user visibility
- Edit existing survey: modify questions → save → verify version increments

**Normal user survey filling (user role):**

- Survey list: verify active surveys display, inactive/archived do not
- Fill simple survey: open → fill all fields → submit → verify confirmation
- Fill kitchen sink survey: interact with every question type, exercise both conditional logic branches (trigger question shows/hides dependent questions)
- Draft auto-save: partially complete → navigate away → resume → verify answers preserved
- My responses: verify submitted and draft responses with correct statuses
- View completed response: open submitted → verify read-only display

**Triage workflow (reviewer role):**

- Triage list: verify submitted responses → filter by status → filter by survey → search by name
- Review response detail: open → verify answers display → verify respondent info
- Status transitions: submitted → needs_revision → verify status updates
- Revision notes: add notes → verify visible on triage detail and to respondent
- Assign reviewer: assign → verify persistence → verify in assigned filter
- Approve response: approve → verify status change → verify filter update

**Cross-role end-to-end workflow:**

Multi-browser-context test spanning all three roles:

1. Admin creates and publishes a survey
2. Normal user fills and submits
3. Reviewer sees in triage, requests revision with notes
4. Normal user sees revision request, updates, resubmits
5. Reviewer approves
6. Normal user sees approved status

**Visual regression:**

- Screenshot baselines (×4 theme modes) for: survey list, survey fill (with various question types), my-responses list, triage list, triage detail
- Translation scan on all survey/triage pages
- SurveyJS theme integration verification

**Dependencies:** Phase 0 complete. Independent of Phases 1-2.

### Phase 4: Teams, Projects, and Shared Entities

**Goal:** Cover team and project management and their integration with other features.

**Team management workflows:**

- Create team → fill name, status → save → verify in list
- Team members: add via dialog → assign roles → verify list → remove → verify
- Responsible parties: assign → verify persistence
- Related teams: link teams → verify display → remove
- Metadata: add/edit/delete via MetadataDialog
- Edit/delete: rename → verify → delete → verify removed
- Pagination/filtering: verify list pagination, name search, status filter

**Project management workflows:**

- Create project → associate with team (autocomplete) → set status → save → verify
- Project-team linkage: create under team → verify in team's list → change team → verify
- Responsible parties and related projects: dialog patterns
- Metadata: MetadataDialog pattern
- Edit/delete: rename, change status, delete

**Dashboard integration:**

- Filter TMs by project → verify results
- Filter by owner/reviewer → verify
- Date range filters → verify
- Pagination/sorting verification

**Field coverage:**

Schema-driven parameterized tests for all team and project fields.

**Visual regression:**

- Screenshot baselines (×4 theme modes) for: teams list, team dialogs, projects list, project dialogs, dashboard with filters
- Translation scan
- Icon/button integrity

**Dependencies:** Phase 0 complete. Independent of Phases 1-3.

### Phase 5: Admin Full Coverage

**Goal:** Complete coverage for all admin sub-pages (survey authoring covered in Phase 3).

**User management:**

- List users → verify columns (email, provider, dates) → pagination
- Filter by provider → email → automation account → clear filters
- Automation accounts: create → set credentials → verify in list with automation flag
- Delete user → confirm → verify removed

**Group management:**

- CRUD groups: create → verify → edit name → delete
- Membership: add members → verify → remove → verify
- Group in permissions: assign group as reader on TM → verify access

**Quota management:**

- List quotas → verify columns
- Add/edit quota: create for user → set limits → save → verify → edit → save
- Delete quota → verify removed

**Webhook management:**

- Create webhook: URL + events + HMAC secret → save → verify
- Create automation user for webhook → link
- Edit/delete webhook

**Addon management:**

- List addons → verify display
- Add addon → configure parameters → save → verify
- Invoke addon from TM → verify dialog renders with parameters

**Settings management:**

- View settings → verify key-value list
- Edit setting → save → verify persistence
- Migration dialog: verify controls render

**Field coverage:**

Schema-driven parameterized tests for all admin entity fields.

**Visual regression:**

- Screenshot baselines (×4 theme modes) for each admin sub-page
- Translation scan (admin pages are high-risk for missing keys)
- Icon/button integrity

**Dependencies:** Phase 0 complete. Phase 3 should complete first (covers survey admin).

### Phase 6: Navigation, Error Handling, and Cross-Cutting Concerns

**Goal:** Expand navigation/error coverage and sweep the entire app for UI integrity.

**Expanded navigation:**

- Role-based navbar visibility: user sees dashboard+intake only → reviewer also sees triage → admin sees all
- Deep links for all routes: parameterized test hitting every major route, verify page loads
- Auth guard: every protected route redirects to login when unauthenticated
- Role guard: user → `/triage` blocked; user → `/admin` blocked
- Browser history: dashboard → TM → threat → back → back → forward, verify each step

**Expanded error handling:**

- API 500 error: intercept → return 500 → verify error snackbar, app doesn't crash
- Network timeout: intercept → delay beyond timeout → verify handling
- 404 resources: nonexistent ID for each entity type → verify graceful handling
- Validation errors: each major form with invalid data → verify error messages in correct language
- Session expiry: intercept auth check → return 401 → verify redirect to login

**Translation completeness sweep:**

Navigate to every page in the app (parameterized via route list) → run translation scanner on each. Catches:

- Missing keys in primary language
- Dynamic key construction failures
- Empty translation values rendering as blank
- HTML escaping issues in translated content

**Icon integrity sweep:**

Visit every page → assert all `mat-icon` elements render with visible content, non-zero bounding box, correct sizing.

**Theme testing:**

- Theme switching: toggle light→dark→light → verify no visual artifacts or broken layouts
- Color blindness mode: enable → verify status indicators, severity badges, CVSS chips are distinguishable without relying solely on color (shapes, patterns, text must differentiate)

**Accessibility smoke tests (all 4 theme modes):**

- Every interactive element is keyboard-focusable
- Every form field has associated label or `aria-label`
- No duplicate IDs on any page
- Color contrast meets minimum thresholds (via Playwright accessibility snapshot)

**Dependencies:** All other phases should complete first. This phase sweeps everything.

## Phase Dependency Graph

```
Phase 0 (Foundation)
  ├── Phase 1 (TM Deep Coverage)       ← validates Phase 0 patterns
  │     └── Phase 2 (DFD Editor)       ← depends on TM being testable
  ├── Phase 3 (Surveys/Triage)         ← independent of Phases 1-2
  ├── Phase 4 (Teams/Projects)         ← independent of Phases 1-3
  └── Phase 5 (Admin)                  ← independent; Phase 3 covers survey admin first
Phase 6 (Nav/Errors/Cross-cutting)     ← runs last, sweeps everything
```

After Phase 0 + Phase 1 validate the patterns, Phases 2-5 can execute in parallel.

## Deliverables Per Phase

Each phase produces:

1. New/updated test files following the three-layer pattern
2. New page objects and dialog objects as needed
3. `data-testid` attributes added to components as needed
4. Seed spec additions for the phase's data requirements
5. Screenshot baselines (×4 for theme matrix)
6. Updated schema field definitions if new entities are covered
7. Documentation updates to `e2e/README.md`

## Out of Scope

- **Collaborative DFD editing** — Tracked as a standalone GitHub issue for separate design
- **Cross-browser testing** (Firefox, WebKit) — Chromium-only for now
- **Performance/load testing** — Different tooling and concerns
- **API-only testing** — This plan covers E2E through the UI; API contract testing is separate
- **Mobile/responsive testing** — Can be added as a future Playwright project with viewport emulation

## Estimated Test Count

| Phase | Workflow tests | Field tests | Visual tests | Total (approx) |
|-------|---------------|-------------|--------------|-----------------|
| Phase 0 | 0 | 0 | 0 | Infrastructure only |
| Phase 1 | ~20 | ~50 | ~20 | ~90 |
| Phase 2 | ~15 | ~10 | ~25 | ~50 |
| Phase 3 | ~20 | ~15 | ~15 | ~50 |
| Phase 4 | ~15 | ~15 | ~10 | ~40 |
| Phase 5 | ~20 | ~20 | ~10 | ~50 |
| Phase 6 | ~15 | 0 | ~30 | ~45 |
| **Total** | **~105** | **~110** | **~110** | **~325** |

Note: Visual test counts are per-test, not per-screenshot. Each visual test produces 4 screenshots (theme matrix), so ~440 baseline screenshots total.
