# Proposed Survey API Changes

This document describes changes needed to the TMI Survey API to support the SurveyJS-based frontend. These changes were identified by comparing the current OpenAPI spec against the frontend's requirements for template authoring, survey rendering, draft management, and triage workflows.

---

## 1. Replace `questions[]` with `survey_json` on SurveyTemplate

### Problem

The current API stores survey definitions as a flat `questions: SurveyQuestion[]` array with a fixed set of question types and properties. The frontend uses [SurveyJS](https://surveyjs.io), which requires a richer JSON structure:

- **Pages**: Questions are organized into pages for multi-step surveys
- **Nested elements**: Panels group related questions; dynamic panels create repeatable sections (e.g., a port matrix where users add rows)
- **Multiple expression types**: `visibleIf`, `enableIf`, `requiredIf`, `defaultValueExpression` (the current API only supports `visible_if`)
- **Additional question types**: `panel`, `paneldynamic`, `rating`, and others not in the current enum
- **Display configuration**: Progress bars, question numbering, completion pages, etc.

None of these features are representable in the current flat question array.

### Proposed Change

Replace `questions: SurveyQuestion[]` with `survey_json: object` (JSONB). This field stores the complete SurveyJS definition as an opaque blob.

**Updated `SurveyTemplateBase` schema:**

```yaml
SurveyTemplateBase:
  type: object
  required: [name, version, survey_json]
  properties:
    name:
      type: string
      maxLength: 256
    description:
      type: string
      maxLength: 2048
    version:
      type: string
      maxLength: 64
      pattern: "^[a-zA-Z0-9._-]+$"
    status:
      $ref: "#/components/schemas/SurveyTemplateStatus"
    survey_json:
      type: object
      description: "Complete SurveyJS JSON definition. Opaque to the server; validated only for top-level structure."
    settings:
      $ref: "#/components/schemas/SurveyTemplateSettings"
```

**Example `survey_json` value:**

```json
{
  "title": "Security Review Intake",
  "description": "Complete this form to request a security review",
  "showProgressBar": "top",
  "showQuestionNumbers": "on",
  "pages": [
    {
      "name": "project_info",
      "title": "Project Information",
      "elements": [
        {
          "type": "text",
          "name": "project_name",
          "title": "Project Name",
          "isRequired": true
        },
        {
          "type": "dropdown",
          "name": "team",
          "title": "Team",
          "choices": [
            { "value": "platform", "text": "Platform" },
            { "value": "mobile", "text": "Mobile" }
          ]
        },
        {
          "type": "comment",
          "name": "description",
          "title": "Project Description",
          "visibleIf": "{project_name} notempty"
        }
      ]
    },
    {
      "name": "ports",
      "title": "Port Matrix",
      "elements": [
        {
          "type": "paneldynamic",
          "name": "port_entries",
          "title": "Network Ports",
          "panelAddText": "Add Port",
          "templateElements": [
            { "type": "text", "name": "port_number", "title": "Port", "inputType": "number" },
            { "type": "text", "name": "protocol", "title": "Protocol" },
            { "type": "text", "name": "purpose", "title": "Purpose" }
          ]
        }
      ]
    }
  ]
}
```

**Server-side validation**: Validate that `survey_json` is a non-null object containing a `pages` array. Do not validate individual question structure -- the SurveyJS library handles that client-side.

**Schemas to remove** from the OpenAPI spec: `SurveyQuestion`, `SurveyQuestionType`, `SurveyQuestionInputType`, `SurveyQuestionChoice`.

**Impact on `SurveyTemplateListItem`**: Remove `question_count` (or compute it server-side by counting elements across pages). The list item must NOT include the full `survey_json` to keep list responses lightweight.

**Database change**: Replace the `questions JSONB` column with `survey_json JSONB` in the `survey_templates` table.

---

## 2. Add Template Version History

### Problem

Survey responses record `template_version` at creation time. However, there is no way to retrieve the template definition (specifically the `survey_json`) that was active when a response was created. If a template is later updated, responses rendered against the current template will show incorrect or missing questions.

### Proposed Change

Add a version history table and corresponding endpoints.

**Database schema:**

```sql
CREATE TABLE survey_template_versions (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL REFERENCES survey_templates(id),
    version VARCHAR(64) NOT NULL,
    survey_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by_internal_uuid VARCHAR(36) NOT NULL REFERENCES users(internal_uuid),
    UNIQUE(template_id, version)
);

CREATE INDEX idx_survey_template_versions_template ON survey_template_versions(template_id);
```

**Server behavior:**
- When a template is created (POST), store the initial `survey_json` as version record
- When a template is updated (PUT) and the `version` field changes, create a new version record with the new `survey_json`
- Version records are immutable (append-only)

**New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/survey_templates/{template_id}/versions` | List all versions for a template |
| GET | `/admin/survey_templates/{template_id}/versions/{version}` | Get a specific version by version string |
| GET | `/intake/templates/{template_id}/versions/{version}` | Respondent access to a historical version |

**Version record schema:**

```yaml
SurveyTemplateVersion:
  type: object
  required: [id, template_id, version, survey_json, created_at, created_by]
  properties:
    id:
      type: string
      format: uuid
    template_id:
      type: string
      format: uuid
    version:
      type: string
      maxLength: 64
    survey_json:
      type: object
      description: "SurveyJS JSON definition at this version"
    created_at:
      type: string
      format: date-time
    created_by:
      $ref: "#/components/schemas/User"
```

---

## 3. Add `ui_state` to SurveyResponse

### Problem

When a user partially fills out a multi-page survey and returns later, the frontend needs to restore their position (which page they were on). The current API has no field for this.

### Proposed Change

Add an optional `ui_state` field (JSONB) to `SurveyResponseBase`:

```yaml
SurveyResponseBase:
  properties:
    # ...existing properties...
    ui_state:
      type: object
      nullable: true
      description: "Client-managed UI state for draft restoration. Opaque to the server."
```

**Example value:**

```json
{ "currentPageNo": 2, "isCompleted": false }
```

**Server behavior:**
- Accept on PUT/PATCH when response status is `draft` or `needs_revision`
- Return on GET
- Clear (set to null) when response transitions to `submitted`
- No validation beyond "must be an object or null"
- Include in `SurveyResponse` (full object), exclude from `SurveyResponseListItem`

**Database change**: Add `ui_state JSONB` column to `survey_responses` table.

---

## 4. Add `archived` to SurveyTemplateStatus

### Current

```yaml
SurveyTemplateStatus:
  type: string
  enum: [active, inactive]
```

### Proposed

```yaml
SurveyTemplateStatus:
  type: string
  enum: [active, inactive, archived]
```

**Semantics:**
- `active`: Template appears in intake list, editable by admin
- `inactive`: Template hidden from intake, still editable by admin (useful for templates under construction)
- `archived`: Template hidden from all lists, read-only, preserved for historical reference (responses may still reference it)

This avoids using DELETE as a soft-disable mechanism. DELETE should be a true destructive action, limited to templates with no associated responses.

---

## 5. Simplify Status Transitions to PATCH-based Updates

### Current

The API has dedicated endpoints for each status transition:
- `POST /intake/responses/{id}/submit`
- `POST /triage/surveys/responses/{id}/approve`
- `POST /triage/surveys/responses/{id}/return`

### Proposed

Remove `/submit`, `/approve`, and `/return` as dedicated endpoints. Instead, allow the response `status` field to be updated via PATCH. The server validates that the transition is permitted.

**Valid transitions:**

| From | To | Who | Notes |
|------|----|-----|-------|
| `draft` | `submitted` | owner, writer | Server validates required questions are answered |
| `submitted` | `ready_for_review` | Security Reviewers | |
| `submitted` | `needs_revision` | Security Reviewers | PATCH body must include `revision_notes` |
| `needs_revision` | `submitted` | owner, writer | Server re-validates required questions |
| `ready_for_review` | `needs_revision` | Security Reviewers | PATCH body must include `revision_notes` |
| `ready_for_review` | `review_created` | -- | Only via `POST .../create_threat_model` |

**Example PATCH requests:**

Submit a draft:
```http
PATCH /intake/responses/{id}
Content-Type: application/json

[{ "op": "replace", "path": "/status", "value": "submitted" }]
```

Return for revision:
```http
PATCH /intake/responses/{id}
Content-Type: application/json

[
  { "op": "replace", "path": "/status", "value": "needs_revision" },
  { "op": "replace", "path": "/revision_notes", "value": "Please clarify the data flow in section 2" }
]
```

**Keep as dedicated endpoint:** `POST /triage/surveys/responses/{id}/create_threat_model` -- this has a side effect (creates a ThreatModel resource) and should remain explicit.

**Server behavior on invalid transitions:** Return `409 Conflict` with an error describing the invalid transition.

---

## 6. Add `modified_at` to SurveyResponseListItem

### Problem

The current `SurveyResponseListItem` only includes `created_at` and `submitted_at`. The frontend sorts the response list by last-modified date and displays "last edited" timestamps for drafts.

### Proposed Change

Add `modified_at` to `SurveyResponseListItem`:

```yaml
SurveyResponseListItem:
  properties:
    # ...existing properties...
    modified_at:
      type: string
      format: date-time
      description: "Last modification timestamp"
```

---

## 7. Add `survey_json` Snapshot to SurveyResponse (Read-Only)

### Problem

When rendering a submitted response, the frontend needs the `survey_json` that was active when the response was created. Without this, responses display against the current template, which may have different questions.

### Proposed Change

Add a read-only `survey_json` field to the full `SurveyResponse` schema (NOT the list item):

```yaml
SurveyResponse:
  allOf:
    - $ref: "#/components/schemas/SurveyResponseBase"
    - properties:
        # ...existing server-generated properties...
        survey_json:
          type: object
          readOnly: true
          description: "Snapshot of the survey_json from the template version used when this response was created"
```

**Server behavior:**
- When a response is created (POST), copy the current template's `survey_json` from the version history into the response record
- Return on GET
- Never accept from client (read-only / server-populated)
- Include in full `SurveyResponse`, exclude from `SurveyResponseListItem`

**Database change**: Add `survey_json JSONB` column to `survey_responses` table.

This makes each response self-contained for rendering purposes, while the version history (change 2) provides the master record.

---

## Summary of Changes

| # | Change | Type | Impact |
|---|--------|------|--------|
| 1 | Replace `questions[]` with `survey_json` | Schema change | `survey_templates` table, remove 4 schemas from spec |
| 2 | Add template version history | New table + endpoints | `survey_template_versions` table, 3 new endpoints |
| 3 | Add `ui_state` to SurveyResponse | Schema change | `survey_responses` table |
| 4 | Add `archived` template status | Enum change | `SurveyTemplateStatus` enum |
| 5 | PATCH-based status transitions | Endpoint removal + PATCH | Remove 3 endpoints, add PATCH validation |
| 6 | Add `modified_at` to response list item | Schema change | `SurveyResponseListItem` |
| 7 | Add `survey_json` snapshot to response | Schema + DB change | `survey_responses` table |
