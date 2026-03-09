---
name: file_server_bug
description: File a detailed bug report against the TMI server (https://github.com/ericfitz/tmi) with evidence, add it to the TMI project, set milestone from current branch, and mark as in progress.
allowed-tools: Bash, Read, Grep, Glob
---

# File Server Bug

Create a detailed, unambiguous bug report as a GitHub issue in the TMI server repository (https://github.com/ericfitz/tmi), add it to the TMI project, and mark it as in progress.

## Inputs

This skill operates on context from the current conversation. Before invoking, ensure:

- **Bug description**: A clear understanding of the bug (from conversation context, logs, code analysis, etc.)
- **Evidence**: Any supporting evidence such as log excerpts, request/response payloads, API behavior observations, code references, or reproduction steps

## Process

### Step 1: Gather Evidence

Collect all relevant evidence from the current conversation:

- API request/response payloads showing the bug
- Log file excerpts with timestamps
- Expected vs actual behavior
- Reproduction steps
- Any root cause analysis or hypotheses
- Affected API endpoints, fields, or operations

### Step 2: Determine Milestone

Check if the current git branch name matches any milestone in the server repo:

```bash
# Get current branch name
BRANCH=$(git branch --show-current)

# List milestones from the server repo
gh api repos/ericfitz/tmi/milestones --jq '.[] | "\(.number) \(.title)"'
```

- If the current branch is not `main` and a milestone exists whose title matches the branch name, use that milestone.
- If no matching milestone is found, or if on `main`, do not set a milestone.

### Step 3: Create the Issue

Create the issue in https://github.com/ericfitz/tmi with:

**Title format**: Use conventional commit prefix: `fix: <concise description of the bug>`

**Labels**: Always include `bug`. Add `api` if the bug involves an API endpoint.

**Milestone**: Set to the matching milestone from Step 2 (if found).

**Body format**:

```markdown
## Summary

<1-3 sentence description of the bug>

## Steps to Reproduce

1. <step>
2. <step>
3. <step>

## Expected Behavior

<what should happen>

## Actual Behavior

<what actually happens>

## Evidence

<include relevant evidence: log excerpts, request/response payloads, screenshots, etc.>

### Request
```json
<request payload if applicable>
```

### Response
```json
<response payload if applicable>
```

## Possible Cause

<any root cause analysis or hypotheses, including relevant code references or schema considerations>

## Impact

<describe the severity and user-facing impact of the bug>

## Environment

<relevant environment details: API endpoint, client version, content-type, etc.>
```

Omit any sections that are not applicable (e.g., omit Request/Response if the bug is not API-related).

**Command**:

```bash
gh issue create --repo ericfitz/tmi \
  --title "fix: <title>" \
  --label "bug,api" \
  --milestone "<milestone>" \
  --body "$(cat <<'EOF'
<body content>
EOF
)"
```

If no milestone applies, omit the `--milestone` flag.

### Step 4: Add Issue to TMI Project

The TMI project ID is `PVT_kwHOACjZhM4BC0Z1` (project number 2, owner ericfitz).

```bash
# Add the issue to the project
gh project item-add 2 --owner ericfitz --url <issue_url>
```

### Step 5: Set Status to "In Progress"

Find the project item ID and set its status:

```bash
# Find the project item ID
ITEM_ID=$(gh project item-list 2 --owner ericfitz --format json --limit 200 | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('items', []):
    if item.get('content', {}).get('number') == <ISSUE_NUMBER>:
        print(item['id'])
        break
")

# Set status to "In Progress"
# Status field ID: PVTSSF_lAHOACjZhM4BC0Z1zg06000
# "In Progress" option ID: 47fc9ee4
gh project item-edit \
  --project-id PVT_kwHOACjZhM4BC0Z1 \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lAHOACjZhM4BC0Z1zg06000 \
  --single-select-option-id 47fc9ee4
```

### Step 6: Report Result

Output the created issue URL and a summary of what was configured:

```
Created: <issue_url>
  Labels: bug, api
  Milestone: <milestone or "none">
  Project: TMI (In Progress)
```

## Output

The URL of the created GitHub issue.

## Error Handling

| Error | Behavior |
|-------|----------|
| `gh` not authenticated | Report error, advise user to run `gh auth login` |
| Milestone not found | Create issue without milestone, note in output |
| Project item-add fails | Report error, issue is still created |
| Status update fails | Report error, issue is still in project but status may be default |

## Example

### Bug: API Mutates Node Shape

```
Input context:
  - PATCH /threat_models/{id}/diagrams/{did} sends shape:"actor"
  - Server responds with shape:"store"
  - Log file evidence showing request/response payloads

Output:
  Created: https://github.com/ericfitz/tmi/issues/166
    Labels: bug, api
    Milestone: release/1.3.0
    Project: TMI (In Progress)
```

## Implementation Notes

1. **Evidence quality matters**: Include actual payloads, timestamps, and field values. Avoid vague descriptions.
2. **Conventional commit prefix**: Always use `fix:` for bug reports.
3. **Project IDs are stable**: The TMI project ID and field IDs are constants for the ericfitz/tmi repository. If they change, update this skill.
4. **Issue number extraction**: After `gh issue create`, parse the issue number from the returned URL to use in subsequent API calls.
5. **Branch-to-milestone mapping**: The branch name is compared directly against milestone titles (e.g., branch `release/1.3.0` matches milestone `release/1.3.0`).
