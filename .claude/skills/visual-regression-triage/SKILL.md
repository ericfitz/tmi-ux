---
name: visual-regression-triage
description: Use when a Playwright visual regression test fails (screenshot mismatch) or a user mentions a screenshot test failure. Presents baseline, actual, and diff images framed against the current task context, then helps the user decide bug vs. expected change.
---

# Visual Regression Triage

When a Playwright visual regression test fails, present the baseline, actual, and diff images alongside the user's current task context, then guide the user to either fix the underlying bug or update the baseline.

## Configuration (optional)

Reads `.local-projects.json` (walked up from `pwd`) to look up the GitHub owner/repo for the current project so that `gh issue view` can fetch task context. If `.local-projects.json` is missing or the current project isn't found, the skill falls back to whatever `gh` is configured to use.

```jsonc
{
  "projects": [{
    "name": "...",
    "path": "<absolute repo path matching pwd>",
    "github": {"owner": "...", "repo": "..."}
  }]
}
```

The skill identifies the current project by matching the parent directory of `pwd` to a project's `path` value.

A skill-specific config file `.claude/visual-regression.config.json` is supported but optional:

```jsonc
{
  "test_command":            "pnpm test:e2e --project=visual-regression",
  "update_command":          "pnpm test:e2e --project=visual-regression --update-snapshots",
  "results_glob":            "test-results/**/*-actual.png",
  "snapshot_naming": {
    "actual_suffix":   "-actual.png",
    "expected_suffix": "-expected.png",
    "diff_suffix":     "-diff.png"
  }
}
```

If the config is missing, defaults match Playwright's standard layout and use a generic `npx playwright test` invocation.

## Process

### 1. Gather task context

Before examining images, understand what the user is working on:

1. `git branch --show-current` — current branch.
2. `git log --oneline -5` — recent commits; look for issue numbers and Conventional Commit types.
3. If commits or branch name reference an issue number `#N`, look up the issue:
   ```bash
   OWNER=$(jq -r ... .local-projects.json)   # from config
   REPO=$(jq -r ...)
   gh issue view "$N" --repo "$OWNER/$REPO" --json title,body
   ```
   If `OWNER`/`REPO` are unavailable, run `gh issue view "$N"` with no `--repo` flag.
4. `git diff --name-only HEAD~5` — recently changed files.

### 2. Parse failure output

From the Playwright run output (provided by user or last run), identify failing screenshots. Playwright stores three files per failure under `test-results/`:

- `{test-name}/{screenshot-name}-actual.png` — what the test produced
- `{test-name}/{screenshot-name}-expected.png` — the baseline
- `{test-name}/{screenshot-name}-diff.png` — visual diff

Discover them with `Glob`:

```
<results_glob>   # default: test-results/**/*-actual.png
```

### 3. Present evidence with context

For each failing screenshot:

1. `Read` baseline, actual, and diff.
2. Describe the visual differences.
3. Frame them against task context:
   - Diff on a page/component related to the current issue → **likely expected change**.
   - Diff on unrelated UI → **likely unintended regression**.
   - Uncertain → present both possibilities.

Example framings:

- "You're working on #123 (feat: add widget to page Y). The diff on page Y shows a new button in the toolbar — likely an expected change."
- "You're working on #456 (fix: auth token refresh). The diff on the dashboard shows shifted layout, but the dashboard isn't related to your current work — likely an unintended regression."

### 4. Ask for a decision

Present two paths:

**Bug** — the visual change is unintended:
1. Examine recent diffs to CSS, templates, and components near the affected area.
2. Suggest a fix.
3. Offer to re-run the failing test (`<test_command>`).

**Expected change** — the visual change is intentional:
1. Confirm with the user.
2. Update the baseline with `<update_command>` (or equivalent; default `npx playwright test --update-snapshots`).
3. Re-run the test to verify it now passes.
4. Stage and commit the updated baseline images.

## Notes

- This skill is Playwright-flavored but the framing approach (baseline/actual/diff + task context) applies to any visual-regression tool that produces three artifacts per failure. Adjust `snapshot_naming` and the command fields if using a different tool.
- The skill never updates baselines without explicit user confirmation.
