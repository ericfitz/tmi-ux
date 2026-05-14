---
name: file-github-bug
description: Use when filing a detailed bug report against a GitHub repo with evidence, optionally adding it to a GitHub Project (v2), setting milestone from current branch, and marking initial status. Reads repo/project metadata from .local-projects.json so the skill is repo-agnostic.
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <target-project-name>
---

# File GitHub Bug

Create a detailed, unambiguous bug report as a GitHub issue, optionally adding it to a GitHub Project (v2) and setting status. Repo and project metadata are looked up by name from `.local-projects.json`; the skill itself is repo-agnostic.

## Inputs

- **target** (argument): The project name from `.local-projects.json` whose repo will receive the issue. If omitted, ask the user.
- Conversation context providing: bug description, evidence (logs, payloads, code refs), reproduction steps, expected vs. actual behavior, hypotheses.

## Configuration

`.local-projects.json` (walked up from `pwd`) supplies:

```jsonc
{
  "projects": [{
    "name": "<target>",
    "github": {
      "owner": "<gh-login>",
      "repo": "<repo-name>",
      "issues_project": {                    // optional
        "number": 2,
        "owner": "<gh-login>",
        "id": "PVT_...",
        "fields": {
          "status": {
            "id": "PVTSSF_...",
            "options": {
              "backlog": "<option-id>",
              "this_milestone": "<option-id>",
              "in_progress": "<option-id>",
              "done": "<option-id>"
            },
            "default_option": "this_milestone"
          }
        }
      }
    }
  }]
}
```

If `issues_project` is absent, the skill creates the issue without adding it to a project.

## Process

### 1. Look up target

```bash
CONFIG=$(find_up .local-projects.json)
TARGET="$1"
OWNER=$(jq -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.owner' "$CONFIG")
REPO=$(jq -r  --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.repo'  "$CONFIG")
```

(`find_up` walks parent directories until it finds the named file. Implement inline if needed.)

If `OWNER`/`REPO` are empty, error and ask the user to add the project to `.local-projects.json`.

### 2. Gather evidence

Collect from the current conversation:
- API request/response payloads
- Log excerpts with timestamps
- Expected vs. actual behavior
- Reproduction steps
- Affected endpoints, fields, or operations
- Root cause hypotheses with code references

### 3. Determine milestone

Compare the current git branch to milestones on the target repo:

```bash
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "main" ] || \
  MILESTONE=$(gh api "repos/$OWNER/$REPO/milestones" \
    --jq ".[] | select(.title == \"$BRANCH\") | .title")
```

If no exact match, do not set a milestone.

### 4. Create the issue

**Title**: `fix: <concise description>` (Conventional Commit prefix).

**Labels**: always `bug`. Add `api` if the bug involves an API endpoint.

**Body**:

```markdown
## Summary
<1-3 sentence description>

## Steps to Reproduce
1. <step>
2. <step>

## Expected Behavior
<what should happen>

## Actual Behavior
<what actually happens>

## Evidence
<logs, payloads, screenshots, code refs>

### Request
```json
<payload if applicable>
```

### Response
```json
<payload if applicable>
```

## Possible Cause
<root cause analysis or hypotheses>

## Impact
<severity, user-facing impact>

## Environment
<endpoint, client version, content-type, etc.>
```

Omit sections that don't apply.

```bash
gh issue create --repo "$OWNER/$REPO" \
  --title "fix: <title>" \
  --label "bug,api" \
  ${MILESTONE:+--milestone "$MILESTONE"} \
  --body "$(cat <<'EOF'
<body content>
EOF
)"
```

Capture the returned issue URL and extract the issue number.

### 5. Add to GitHub Project (if configured)

```bash
PROJ_NUM=$(jq   -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.issues_project.number' "$CONFIG")
PROJ_OWNER=$(jq -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.issues_project.owner'  "$CONFIG")
PROJ_ID=$(jq    -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.issues_project.id'     "$CONFIG")

if [ "$PROJ_NUM" != "null" ] && [ -n "$PROJ_NUM" ]; then
  gh project item-add "$PROJ_NUM" --owner "$PROJ_OWNER" --url "$ISSUE_URL"
fi
```

### 6. Set initial status (if configured)

The default status is whatever `default_option` in the config is set to (e.g. `this_milestone`). Callers may override by passing a different option key.

```bash
STATUS_FIELD_ID=$(jq -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.issues_project.fields.status.id' "$CONFIG")
DEFAULT_KEY=$(jq    -r --arg t "$TARGET" '.projects[] | select(.name==$t) | .github.issues_project.fields.status.default_option' "$CONFIG")
OPTION_ID=$(jq      -r --arg t "$TARGET" --arg k "$DEFAULT_KEY" \
  '.projects[] | select(.name==$t) | .github.issues_project.fields.status.options[$k]' "$CONFIG")

ITEM_ID=$(gh project item-list "$PROJ_NUM" --owner "$PROJ_OWNER" --format json --limit 200 \
  | jq -r --argjson n "$ISSUE_NUMBER" '.items[] | select(.content.number==$n) | .id')

gh project item-edit \
  --project-id "$PROJ_ID" \
  --id "$ITEM_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$OPTION_ID"
```

### 7. Report

```
Created: <issue_url>
  Labels:    bug[, api]
  Milestone: <milestone or "none">
  Project:   <project-name> (<status-key>)
```

## Output

The created issue URL.

## Error Handling

| Error | Behavior |
|-------|----------|
| `gh` not authenticated | Tell user to run `gh auth login`. |
| Target not in `.local-projects.json` | Error with the list of known names. |
| `issues_project` absent | Create issue, skip project add/status, note in output. |
| Milestone not found | Create without milestone. |
| `gh project item-add` fails | Report; the issue still exists. |
| Status update fails | Report; status stays at the project's default. |

## Example

```
Target:   tmi (server repo)
Branch:   release/1.3.0
Evidence: PATCH /threat_models/.../diagrams/... sends shape:"actor",
          server responds with shape:"store"; logs show mismatch.

Output:
  Created: https://github.com/ericfitz/tmi/issues/166
    Labels:    bug, api
    Milestone: release/1.3.0
    Project:   tmi (this_milestone)
```

## Implementation Notes

1. **Evidence quality matters**: include actual payloads and field values, not paraphrases.
2. **Conventional Commit prefix**: always `fix:` for bug reports.
3. **Branch → milestone**: exact title match; no fuzzy matching to avoid surprises.
4. **Project/field IDs**: stable for a project's lifetime. If the project is rebuilt, refresh values in `.local-projects.json` with `gh project field-list <number> --owner <owner>`.
5. **Field ID discovery**: to populate the config initially, run `gh project field-list <number> --owner <owner>`.
