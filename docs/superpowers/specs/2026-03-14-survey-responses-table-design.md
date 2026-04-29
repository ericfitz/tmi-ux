# Survey Responses Table Design

**Issue:** [#487](https://github.com/ericfitz/tmi-ux/issues/487)
**Date:** 2026-03-14
**Status:** Draft

## Problem

On the `/triage/{submission_id}` page, survey responses display as a simple question/answer list. Panel and dynamic panel questions render as raw JSON strings because `formatResponses` only walks one level of `page.elements` without recursing into nested structures.

## Design

Replace the question/answer list with a 3-column `mat-table` that flattens panels and dynamic panels into individual rows.

### Table Structure

**With survey schema (normal path):** 3 columns — Group, Question, Answer.

| Group | Question | Answer |
|-------|----------|--------|
| | Project Name | Foo |
| Requester | First Name | John |
| Requester | Last Name | Doe |
| Requester | Email | jd@example.com |
| Members #1 | Name | Alice |
| Members #1 | Email | alice@example.com |
| Members #2 | Name | Bob |
| Members #2 | Email | bob@example.com |

- **Group column:** Panel or dynamic panel title from the schema. Empty for top-level questions. For dynamic panels, appends ` #N` (1-indexed) to distinguish entries. Uses secondary text color.
- **Question column:** Question title from the schema, falling back to question name.
- **Answer column:** Formatted answer value (same `formatAnswer` logic as today).
- **Tooltips:** Group and Question cells show the question ID (`element.name`) via `matTooltip`.

**Without survey schema (fallback path):** 2 columns — Question, Answer.

| Question | Answer |
|----------|--------|
| question1 | Foo |
| question2 | {"question3":"John","question4":"Doe"} |

Raw keys as Question values. Nested values displayed as JSON strings. Question cells get `matTooltip` with the same raw key. No Group column since panel structure can't be determined without the schema.

### Data Model

Replace the current `formattedResponses` array type:

```typescript
// Before
formattedResponses: { question: string; answer: string; name: string }[]

// After
interface SurveyResponseRow {
  group: string;       // Panel/dynamic panel title, empty for top-level
  groupId: string;     // Question ID of the panel (for tooltip)
  question: string;    // Question title or name
  questionId: string;  // Question ID (for tooltip)
  answer: string;      // Formatted answer value
}
formattedResponses: SurveyResponseRow[]
```

Add a boolean flag to track whether the schema was available:

```typescript
hasSchema = false;
```

This flag controls whether the Group column is displayed in the template.

### Column definitions

The `mat-table` columns displayed depend on `hasSchema`:

- With schema: `['group', 'question', 'answer']`
- Without schema: `['question', 'answer']`

### Flattening Logic

Modify `formatResponses(surveyJson)` to walk elements recursively:

```
for each page in surveyJson.pages:
  for each element in page.elements:
    if element.type === 'panel':
      // SurveyJS static panels are visual grouping — child answers are
      // stored as flat top-level keys, not nested under the panel name.
      for each child in element.elements:
        push row with group=element.title, groupId=element.name,
             question=child.title, questionId=child.name,
             answer=formatAnswer(answers[child.name])
    else if element.type === 'paneldynamic':
      entries = answers[element.name] (array of objects)
      for each entry at index i:
        for each child in element.templateElements:
          push row with group=`${element.title} #${i+1}`,
               groupId=element.name,
               question=child.title, questionId=child.name,
               answer=formatAnswer(entry[child.name])
    else:
      push row with group='', groupId='',
           question=element.title, questionId=element.name,
           answer=formatAnswer(answers[element.name])
```

`formatResponsesWithoutDefinition` stays simple: iterate `Object.entries(answers)`, produce rows with no group, raw keys as question and questionId, and `formatAnswer(value)` for answers.

### Template Changes

Replace the `responses-list` div (lines 260-266 of `triage-detail.component.html`) with a `mat-table`. The group column uses `matTooltip` bound to `row.groupId` and the question column uses `matTooltip` bound to `row.questionId`.

The Group column is conditionally included via `responsesDisplayedColumns` which is computed from `hasSchema`.

### Styling

- Group column: `color: var(--color-text-secondary)` to visually distinguish from Question.
- Table uses `width: 100%` inside an `overflow-x: auto` container (same pattern as the triage notes table).
- Remove the existing `.responses-list` and `.response-item` styles. Replace with `.responses-table-container` and `.responses-table` styles following the same pattern as `.notes-table-container` and `.notes-table`.

### Localization

Three new i18n keys needed (no existing keys match):

- `triage.detail.columns.group` = "Group"
- `triage.detail.columns.question` = "Question"
- `triage.detail.columns.answer` = "Answer"

These are added to the `triage.detail` namespace to scope them to this table. `common.subjectTypes.group` exists but refers to IAM groups, not question groups.

All localization files need backfilling after adding the English keys.

### Files Changed

1. **`src/app/pages/triage/components/triage-detail/triage-detail.component.ts`** — New `SurveyResponseRow` interface, updated `formattedResponses` type, new `hasSchema` flag, new `responsesDisplayedColumns` computed property, rewritten `formatResponses`, updated `formatResponsesWithoutDefinition`.
2. **`src/app/pages/triage/components/triage-detail/triage-detail.component.html`** — Replace `responses-list` div with `mat-table`.
3. **`src/app/pages/triage/components/triage-detail/triage-detail.component.scss`** — Remove `.responses-list`/`.response-item` styles, add `.responses-table-container`/`.responses-table` styles.
4. **`src/assets/i18n/en-US.json`** — Add 3 new keys.
5. **Other i18n files** — Backfill translations for the 3 new keys.

### Testing

Unit tests for `formatResponses` covering:
- Top-level questions only (no panels)
- Panel with child questions
- Dynamic panel with multiple entries
- Mixed: top-level + panel + dynamic panel
- Empty answers
- Without schema fallback
