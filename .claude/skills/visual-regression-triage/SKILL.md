---
name: visual-regression-triage
description: Triage visual regression test failures by presenting baseline/actual/diff images with task context, then guiding the user to fix the bug or update the baseline
---

# Visual Regression Triage

Use this skill when a Playwright visual regression test fails (screenshot mismatch) during `pnpm test:e2e` or when the user mentions a screenshot test failure.

## Process

### Step 1: Gather Task Context

Before examining images, understand what the user is working on:

1. Run `git branch --show-current` to get the current branch
2. Run `git log --oneline -5` to see recent commits — look for issue references and conventional commit types
3. If commits or branch name reference a GitHub issue number, run `gh issue view <number> --repo ericfitz/tmi-ux --json title,body` to get the issue context
4. Run `git diff --name-only HEAD~5` to see recently changed files

### Step 2: Parse Failure Output

From the Playwright test output (provided by the user or from the most recent test run), identify which screenshot(s) failed. Playwright stores three files per failure in the test results directory (typically `test-results/`):

- `{test-name}/{screenshot-name}-actual.png` — what the test produced
- `{test-name}/{screenshot-name}-expected.png` — the baseline
- `{test-name}/{screenshot-name}-diff.png` — visual diff highlighting changes

Use the Glob tool to find these files:
```
test-results/**/*-actual.png
```

### Step 3: Present Evidence with Context

For each failing screenshot:

1. Read all three images (baseline, actual, diff) using the Read tool
2. Describe the visual differences you observe
3. Frame the analysis against the task context:
   - If the diff is on a page/component related to the current issue: flag as **likely expected change**
   - If the diff is on an unrelated page: flag as **likely unintended regression**
   - If uncertain: present both possibilities

Example framing:
- "You're working on #123 (feat: add widget to page Y). The screenshot diff for page Y shows a new button in the toolbar. This is likely an expected change from your feature work."
- "You're working on #456 (fix: auth token refresh). The screenshot diff for the dashboard shows shifted layout. This page isn't related to your current work — this looks like an unintended regression."

### Step 4: Ask for Decision

Present two options:

**Bug** — The visual change is unintended:
- Help identify the responsible code change by examining recent diffs to CSS, templates, and component files near the affected area
- Suggest a fix
- Offer to re-run the failing test: `pnpm test:e2e --project=visual-regression`

**Expected change** — The visual change is intentional:
- Ask the user to confirm
- Update the baseline by running the test with `--update-snapshots`:
  ```bash
  pnpm test:e2e --project=visual-regression --update-snapshots
  ```
- Re-run the test to verify it passes
- Stage and commit the updated baseline images
