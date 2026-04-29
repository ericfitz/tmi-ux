# Survey Responses Table Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple question/answer list in the triage detail page with a 3-column mat-table that flattens SurveyJS panels and dynamic panels into individual rows.

**Architecture:** Modify the existing `TriageDetailComponent` to use a new `SurveyResponseRow` interface and rewrite the `formatResponses` method to recursively walk panel/dynamic panel elements. The template switches from a div-based list to a `mat-table`. A `hasSchema` flag controls whether the Group column is displayed.

**Tech Stack:** Angular 19, Angular Material mat-table, Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-survey-responses-table-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/pages/triage/components/triage-detail/triage-detail.component.ts` | Modify | New `SurveyResponseRow` interface, rewritten `formatResponses` and `formatResponsesWithoutDefinition`, new `hasSchema` flag and `responsesDisplayedColumns` |
| `src/app/pages/triage/components/triage-detail/triage-detail.component.html` | Modify | Replace `responses-list` div with `mat-table` |
| `src/app/pages/triage/components/triage-detail/triage-detail.component.scss` | Modify | Remove `.responses-list`/`.response-item`, add `.responses-table-container`/`.responses-table` |
| `src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts` | Create | Unit tests for `formatResponses` flattening logic |
| `src/assets/i18n/en-US.json` | Modify | Add 3 new i18n keys |
| `src/assets/i18n/*.json` (all other locales) | Modify | Backfill translations via `localization-backfill` skill |

---

## Chunk 1: Data Model and Flattening Logic

### Task 1: Write failing tests for the flattening logic

**Files:**
- Create: `src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts`

- [ ] **Step 1: Create the test file with test cases for `formatResponses`**

Write the following test file. It uses direct constructor injection with vitest mocks, following the project pattern from `reviewer-assignment-list.component.spec.ts`.

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { TriageDetailComponent } from './triage-detail.component';
import { SurveyJsonSchema, SurveyResponse } from '@app/types/survey.types';

describe('TriageDetailComponent', () => {
  let component: TriageDetailComponent;

  // Minimal mocks for constructor injection
  const mockRoute = { paramMap: { pipe: vi.fn(() => ({ subscribe: vi.fn() })) } };
  const mockRouter = { navigate: vi.fn() };
  const mockDialog = { open: vi.fn() };
  const mockSnackBar = { open: vi.fn() };
  const mockTransloco = { translate: vi.fn((key: string) => key) };
  const mockResponseService = { getByIdTriage: vi.fn() };
  const mockSurveyService = { getSurveyJson: vi.fn() };
  const mockTriageNoteService = { list: vi.fn() };
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    component = new TriageDetailComponent(
      mockRoute as any,
      mockRouter as any,
      mockDialog as any,
      mockSnackBar as any,
      mockTransloco as any,
      mockResponseService as any,
      mockSurveyService as any,
      mockTriageNoteService as any,
      mockLogger as any,
    );
  });

  describe('formatResponses', () => {
    const makeResponse = (answers: Record<string, unknown>): void => {
      component.response = {
        id: 'resp-1',
        survey_id: 'survey-1',
        survey_version: '1',
        status: 'submitted',
        is_confidential: false,
        answers,
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'u1',
          email: 'test@example.com',
        },
        created_at: '2026-01-01T00:00:00Z',
        modified_at: '2026-01-01T00:00:00Z',
      } as SurveyResponse;
    };

    it('should flatten top-level questions into rows', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              { type: 'text', name: 'q1', title: 'Project Name' },
              { type: 'text', name: 'q2', title: 'Description' },
            ],
          },
        ],
      };
      makeResponse({ q1: 'Foo', q2: 'Bar' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'Project Name', questionId: 'q1', answer: 'Foo' },
        { group: '', groupId: '', question: 'Description', questionId: 'q2', answer: 'Bar' },
      ]);
    });

    it('should flatten panel child questions into rows with group', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'panel',
                name: 'requester',
                title: 'Requester',
                elements: [
                  { type: 'text', name: 'firstName', title: 'First Name' },
                  { type: 'text', name: 'lastName', title: 'Last Name' },
                ],
              },
            ],
          },
        ],
      };
      // SurveyJS static panels store child answers as flat top-level keys,
      // NOT nested under the panel name.
      makeResponse({ firstName: 'John', lastName: 'Doe' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'First Name',
          questionId: 'firstName',
          answer: 'John',
        },
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'Last Name',
          questionId: 'lastName',
          answer: 'Doe',
        },
      ]);
    });

    it('should handle array answer values through formatAnswer', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'checkbox', name: 'q1', title: 'Tags' }],
          },
        ],
      };
      makeResponse({ q1: ['a', 'b', 'c'] });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses[0].answer).toBe('a, b, c');
    });

    it('should flatten dynamic panel entries with numbered groups', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [
                  { type: 'text', name: 'name', title: 'Name' },
                  { type: 'text', name: 'email', title: 'Email' },
                ],
              },
            ],
          },
        ],
      };
      makeResponse({
        members: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Alice',
        },
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Email',
          questionId: 'email',
          answer: 'alice@example.com',
        },
        {
          group: 'Members #2',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Bob',
        },
        {
          group: 'Members #2',
          groupId: 'members',
          question: 'Email',
          questionId: 'email',
          answer: 'bob@example.com',
        },
      ]);
    });

    it('should handle mixed top-level, panel, and dynamic panel elements', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              { type: 'text', name: 'q1', title: 'Project Name' },
              {
                type: 'panel',
                name: 'requester',
                title: 'Requester',
                elements: [{ type: 'text', name: 'email', title: 'Email' }],
              },
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [{ type: 'text', name: 'name', title: 'Name' }],
              },
            ],
          },
        ],
      };
      // Panel child answers are flat; dynamic panel answers are nested arrays
      makeResponse({
        q1: 'Foo',
        email: 'jd@example.com',
        members: [{ name: 'Alice' }],
      });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'Project Name', questionId: 'q1', answer: 'Foo' },
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'Email',
          questionId: 'email',
          answer: 'jd@example.com',
        },
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Alice',
        },
      ]);
    });

    it('should handle empty answers', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'text', name: 'q1', title: 'Project Name' }],
          },
        ],
      };
      makeResponse({});

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([]);
    });

    it('should handle dynamic panel with empty array answer', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [{ type: 'text', name: 'name', title: 'Name' }],
              },
            ],
          },
        ],
      };
      makeResponse({ members: [] });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([]);
    });

    it('should fall back to element.name when title is missing', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'text', name: 'q1' }],
          },
        ],
      };
      makeResponse({ q1: 'Foo' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses[0].question).toBe('q1');
    });
  });

  describe('formatResponsesWithoutDefinition', () => {
    it('should produce 2-column rows with raw keys', () => {
      component.response = {
        id: 'resp-1',
        survey_id: 'survey-1',
        survey_version: '1',
        status: 'submitted',
        is_confidential: false,
        answers: { q1: 'Foo', q2: 'Bar' },
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'u1',
          email: 'test@example.com',
        },
        created_at: '2026-01-01T00:00:00Z',
        modified_at: '2026-01-01T00:00:00Z',
      } as SurveyResponse;

      component['formatResponsesWithoutDefinition']();

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'q1', questionId: 'q1', answer: 'Foo' },
        { group: '', groupId: '', question: 'q2', questionId: 'q2', answer: 'Bar' },
      ]);
      expect(component.hasSchema).toBe(false);
    });
  });

  describe('responsesDisplayedColumns', () => {
    it('should include group column when hasSchema is true', () => {
      component.hasSchema = true;
      expect(component.responsesDisplayedColumns).toEqual(['group', 'question', 'answer']);
    });

    it('should exclude group column when hasSchema is false', () => {
      component.hasSchema = false;
      expect(component.responsesDisplayedColumns).toEqual(['question', 'answer']);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts`
Expected: Multiple failures — `formattedResponses` entries lack new fields, `hasSchema` and `responsesDisplayedColumns` don't exist yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts
git commit -m "test: add failing tests for survey responses table flattening (#487)"
```

### Task 2: Implement the data model and flattening logic

**Files:**
- Modify: `src/app/pages/triage/components/triage-detail/triage-detail.component.ts`

- [ ] **Step 1: Add the `SurveyResponseRow` interface and update `formattedResponses` type**

Add the interface above the `StatusTimelineEntry` interface (around line 30):

```typescript
/**
 * Flattened survey response row for table display.
 * Panels and dynamic panels are expanded into individual rows.
 */
interface SurveyResponseRow {
  /** Panel/dynamic panel title; empty for top-level questions */
  group: string;
  /** Question ID of the panel (for tooltip); empty for top-level */
  groupId: string;
  /** Question title from schema, or raw key without schema */
  question: string;
  /** Question ID (for tooltip) */
  questionId: string;
  /** Formatted answer value */
  answer: string;
}
```

Update `formattedResponses` declaration (line 78) from:
```typescript
formattedResponses: { question: string; answer: string; name: string }[] = [];
```
to:
```typescript
formattedResponses: SurveyResponseRow[] = [];
```

Add new properties after `formattedResponses`:
```typescript
/** Whether survey schema was available for formatting */
hasSchema = false;

/** Columns displayed in the survey responses table */
get responsesDisplayedColumns(): string[] {
  return this.hasSchema ? ['group', 'question', 'answer'] : ['question', 'answer'];
}
```

- [ ] **Step 2: Rewrite `formatResponses` method**

Replace the `formatResponses` method (lines 172-195) with:

```typescript
/**
 * Format survey responses for display using survey definition.
 * Flattens panels and dynamic panels into individual rows.
 * Only recurses one level deep (panel > child); nested panels
 * within panels are treated as leaf elements.
 */
private formatResponses(surveyJson: SurveyJsonSchema): void {
  if (!this.response?.answers) {
    this.formattedResponses = [];
    return;
  }

  const rows: SurveyResponseRow[] = [];
  const answers = this.response.answers;

  for (const page of surveyJson.pages ?? []) {
    for (const element of page.elements ?? []) {
      if (element.type === 'panel' && element.elements) {
        // SurveyJS static panels are visual grouping only — child answers
        // are stored as flat top-level keys, not nested under the panel name.
        for (const child of element.elements) {
          if (answers[child.name] !== undefined) {
            rows.push({
              group: element.title ?? element.name,
              groupId: element.name,
              question: child.title ?? child.name,
              questionId: child.name,
              answer: this.formatAnswer(answers[child.name]),
            });
          }
        }
      } else if (element.type === 'paneldynamic' && element.templateElements) {
        const entries = answers[element.name];
        if (Array.isArray(entries)) {
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i] as Record<string, unknown>;
            for (const child of element.templateElements) {
              if (entry[child.name] !== undefined) {
                rows.push({
                  group: `${element.title ?? element.name} #${i + 1}`,
                  groupId: element.name,
                  question: child.title ?? child.name,
                  questionId: child.name,
                  answer: this.formatAnswer(entry[child.name]),
                });
              }
            }
          }
        }
      } else if (answers[element.name] !== undefined) {
        rows.push({
          group: '',
          groupId: '',
          question: element.title ?? element.name,
          questionId: element.name,
          answer: this.formatAnswer(answers[element.name]),
        });
      }
    }
  }

  this.hasSchema = true;
  this.formattedResponses = rows;
}
```

- [ ] **Step 3: Update `formatResponsesWithoutDefinition` method**

Replace the method (lines 200-211) with:

```typescript
/**
 * Format responses without a definition (raw key/value display).
 * Produces 2-column rows (no group) with raw keys as question names.
 */
private formatResponsesWithoutDefinition(): void {
  if (!this.response?.answers) {
    this.formattedResponses = [];
    return;
  }

  this.hasSchema = false;
  this.formattedResponses = Object.entries(this.response.answers).map(([key, value]) => ({
    group: '',
    groupId: '',
    question: key,
    questionId: key,
    answer: this.formatAnswer(value),
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm run test src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/triage/components/triage-detail/triage-detail.component.ts
git commit -m "feat: implement survey response flattening for panels and dynamic panels (#487)"
```

---

## Chunk 2: Template, Styling, and i18n

### Task 3: Add i18n keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add 3 new keys to `triage.detail.columns` in `en-US.json`**

Add the following keys in the `triage.detail` section, creating a `columns` sub-object:

```json
"columns": {
  "group": "Group",
  "question": "Question",
  "answer": "Answer"
}
```

Place this inside the existing `triage.detail` object, after the existing keys.

- [ ] **Step 2: Run i18n validation**

Run: `pnpm run validate-json:i18n`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "chore: add i18n keys for survey responses table columns (#487)"
```

### Task 4: Update the template

**Files:**
- Modify: `src/app/pages/triage/components/triage-detail/triage-detail.component.html`

- [ ] **Step 1: Replace the responses-list div with a mat-table**

Replace the `@if`/`@else` block inside the `responses-card` `mat-card-content` (the `.empty-responses` and `.responses-list` sections, lines 254-268) with the following. Note: `mat-table` manages its own row identity via `[dataSource]`, so no explicit `trackBy` is needed:

```html
@if (formattedResponses.length === 0) {
  <div class="empty-responses">
    <mat-icon>quiz</mat-icon>
    <p>{{ 'triage.detail.noResponses' | transloco }}</p>
  </div>
} @else {
  <div class="responses-table-container">
    <table mat-table [dataSource]="formattedResponses" class="responses-table">
      <!-- Group Column -->
      <ng-container matColumnDef="group">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'triage.detail.columns.group' | transloco }}
        </th>
        <td
          mat-cell
          *matCellDef="let row"
          class="group-cell"
          [matTooltip]="row.groupId"
          [matTooltipDisabled]="!row.groupId"
        >
          {{ row.group }}
        </td>
      </ng-container>

      <!-- Question Column -->
      <ng-container matColumnDef="question">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'triage.detail.columns.question' | transloco }}
        </th>
        <td
          mat-cell
          *matCellDef="let row"
          [matTooltip]="row.questionId"
        >
          {{ row.question }}
        </td>
      </ng-container>

      <!-- Answer Column -->
      <ng-container matColumnDef="answer">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'triage.detail.columns.answer' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row" class="answer-cell">
          {{ row.answer }}
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="responsesDisplayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: responsesDisplayedColumns"></tr>
    </table>
  </div>
}
```

- [ ] **Step 2: Verify the template compiles**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/triage/components/triage-detail/triage-detail.component.html
git commit -m "feat: replace survey responses list with mat-table (#487)"
```

### Task 5: Update styles

**Files:**
- Modify: `src/app/pages/triage/components/triage-detail/triage-detail.component.scss`

- [ ] **Step 1: Remove old styles and add new table styles**

Remove the `.responses-list` and `.response-item` style blocks (search for these class names in the SCSS file — currently around lines 423-449).

Add in their place:

```scss
// Survey Responses Table
.responses-table-container {
  overflow-x: auto;
}

.responses-table {
  width: 100%;
}

.group-cell {
  color: var(--color-text-secondary);
}

.answer-cell {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
```

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 3: Run build to verify everything compiles**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 4: Run all tests**

Run: `pnpm run test src/app/pages/triage/components/triage-detail/triage-detail.component.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/triage/components/triage-detail/triage-detail.component.scss
git commit -m "refactor: update styles for survey responses table (#487)"
```

### Task 6: Backfill localization

- [ ] **Step 1: Run the localization backfill**

Invoke the `localization-backfill` skill to backfill translations for the 3 new keys (`triage.detail.columns.group`, `triage.detail.columns.question`, `triage.detail.columns.answer`) across all locale files. The skill will run `pnpm run check-i18n` to identify missing keys and generate translations automatically.

- [ ] **Step 2: Run i18n validation**

Run: `pnpm run validate-json:i18n`
Expected: No errors.

- [ ] **Step 3: Commit all locale files**

```bash
git add src/assets/i18n/*.json
git commit -m "chore: backfill localization for survey responses table columns (#487)"
```

### Task 7: Final verification

- [ ] **Step 1: Run format and lint**

Run: `pnpm run format && pnpm run lint:all`
Expected: No errors. If files were reformatted, stage them.

- [ ] **Step 2: Run full build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit any formatting changes**

If format/lint produced changes:
```bash
git add -u
git commit -m "style: format and lint fixes (#487)"
```

- [ ] **Step 5: Add comment to issue and close**

```bash
gh issue comment 487 --repo ericfitz/tmi-ux --body "Implemented in commits on release/1.3.0. Survey responses now display in a 3-column table (Group, Question, Answer) that properly flattens panels and dynamic panels."
gh issue close 487 --repo ericfitz/tmi-ux --reason completed
```
