---
name: verify-migrate-doc
description: Use when asked to verify a documentation file's accuracy against source code and external references, then migrate it into a project wiki. Reads target repo and wiki path from .local-projects.json.
allowed-tools: Read, Glob, Grep, Bash, WebSearch, WebFetch, Edit, Write
argument-hint: <target-project-name> <path-to-doc-file>
---

# Verify and Migrate Documentation

Verify the accuracy of a single documentation file against authoritative sources, then migrate its content into the project's wiki.

## Inputs

- **target** (argument 1): Project name in `.local-projects.json` whose codebase the doc describes and whose wiki will receive content.
- **doc_path** (argument 2): Path to the documentation file to process.

If either is missing, ask the user.

## Configuration

Reads from `.local-projects.json` (walked up from `pwd`):

```jsonc
{
  "projects": [{
    "name": "<target>",
    "path": "<absolute local path to repo>",
    "github": {
      "owner": "...",
      "repo": "...",
      "wiki_path": "<absolute local path to wiki clone>"
    }
  }]
}
```

Required for migration: `github.wiki_path`. If absent, perform verification only and report that migration was skipped.

## Critical Constraints

**Parallel-safe**: Multiple instances may run simultaneously on different files. Therefore:

- **Modify only the assigned doc file**.
- **Never modify any other doc file in the repo.**
- You MAY read any file for context.
- You MAY create or modify files inside the wiki path.
- You MAY move the processed file to a migrated/ folder when complete.

## Phase 1: Read and Understand

1. Read the doc at `doc_path`.
2. Read related docs for context — but do not modify them.
3. Enumerate every claim, reference, and instruction in the doc that requires verification.

## Phase 2: Verification

**Trust nothing in the document.** Verify every claim against authoritative sources.

### 2.1 Internal references (target repo)

For each reference to the target codebase:

- **File path references**: confirm the file exists at the exact path. Use `Glob`/`Read`. Correct if the right file can be found; otherwise mark `<!-- NEEDS-REVIEW: File not found: <path> -->`.
- **Setting/config references**: search source code (not config samples) for where the setting is parsed and used. Verify accepted values. Mark `<!-- NEEDS-REVIEW: Setting <name> not found in source -->` if not findable.
- **Behavior claims**: find the implementing code via `Grep`. Read it. Mark `<!-- NEEDS-REVIEW: Behavior not verified: <desc> -->` if not confirmable.
- **Build target / command references**: confirm targets exist in the build files. Mark or correct.

### 2.2 External / third-party references

For any reference to external tools, packages, or docs:

- **Package names**: confirm with **≥2 independent internet sources** that the exact name is correct (`WebSearch`). Mark `<!-- NEEDS-REVIEW: Package name not verified: <name> -->` otherwise.
- **Installation commands**: verify with ≥2 sources via `WebSearch`.
- **Tool behavior claims**: verify with ≥2 sources.
- **URLs**: `WebFetch` to confirm reachability. Mark broken with `<!-- NEEDS-REVIEW: Broken link: <url> -->`.

### 2.3 Track evidence

Keep a list of verified items and their sources/methods, plus items marked for review. This becomes the verification summary appended to the doc.

## Phase 3: Update the Document

1. Fix any incorrect information you confirmed correct values for.
2. Add `<!-- NEEDS-REVIEW: ... -->` markers for anything unverifiable.
3. Append a verification summary:

```markdown
<!--
VERIFICATION SUMMARY
Verified on: <date>
Agent: verify-migrate-doc

Verified items:
- <item>: <source/method>

Items needing review:
- <item>: <reason>
-->
```

## Phase 4: Migrate to Wiki

`WIKI_PATH` comes from `.local-projects.json` (`github.wiki_path`).

### 4.1 Discover wiki pages

Do not hard-code a page list. Read `WIKI_PATH/_Sidebar.md` (if present) and/or list `*.md` files in `WIKI_PATH` to discover candidate destination pages.

### 4.2 Distribute content

A single doc may have content for multiple wiki pages. Common patterns (use the wiki's actual structure, not these labels):

- Setup → developer-setup page
- Configuration → configuration-reference page
- API reference → API page
- Troubleshooting → troubleshooting page

### 4.3 Update each target page

For each target wiki page:

1. Read the existing page.
2. Find the appropriate section.
3. Integrate the new content, avoiding duplication.
4. Match the wiki's existing formatting conventions.
5. Update `_Sidebar.md` if a new section was added.

### 4.4 Cross-reference

Add a provenance comment in the wiki:

```markdown
<!-- Migrated from: <original doc path> on <date> -->
```

## Phase 5: Mark as Migrated

1. Ensure a `docs/migrated/` folder exists in the source repo.
2. Move the original file there, preserving subdirectory structure (e.g. `docs/developer/setup/foo.md` → `docs/migrated/developer/setup/foo.md`).
3. Use `git mv` to preserve history.

## Output Summary

Report:

1. **Verification**: items verified, items needing review, corrections made.
2. **Migration**: which wiki pages were updated, what was added to each.
3. **File status**: original location, new location.

## Error Handling

- Cannot read the file → report and stop.
- File doesn't appear to be documentation → ask for confirmation.
- Wiki path not configured or not accessible → complete verification, skip migration, report.
- Uncertain about verification → mark NEEDS-REVIEW rather than guessing.

## Example

For a doc claiming `Install golangci-lint with brew install golangci-lint`:

1. `WebSearch` for "golangci-lint installation brew".
2. Confirm with ≥2 reputable sources (official docs, GitHub README, …).
3. If confirmed, no change.
4. If not, update or mark for review.
