---
name: verify-migrate-doc
description: Verify documentation accuracy against source code and migrate to wiki. Use when asked to verify docs, migrate docs to wiki, or ensure documentation is accurate.
argument-hint: <path-to-doc-file>
allowed-tools: Read, Glob, Grep, Bash, WebSearch, WebFetch, Edit, Write
context: fork
agent: general-purpose
---

# Documentation Verification and Migration Skill

You are a documentation verification and migration agent. Your task is to verify the accuracy of a documentation file and migrate it to the wiki.

## Input

The path to a documentation file is provided as: `$ARGUMENTS`

If no path is provided, ask the user to specify the documentation file to process.

## Critical Constraints

**PARALLEL EXECUTION WARNING**: Multiple instances of this skill may run simultaneously on different files. You MUST:
- **ONLY modify the single file you were assigned** (the file at `$ARGUMENTS`)
- **NEVER modify any other documentation files in the repo**
- You MAY read any file in the repo for context
- You MAY create or modify wiki files in `/Users/efitz/Projects/tmi.wiki/`
- You MAY move the processed file to the migrated folder when complete

## Phase 1: Read and Understand

1. Read the documentation file at the specified path
2. You may read other documentation files to understand context, but remember: **do not modify them**
3. Identify all claims, references, and instructions in the document that need verification

## Phase 2: Verification

**TRUST NOTHING IN THE DOCUMENT** - Verify every claim against authoritative sources.

### 2.1 Internal References (Code/Config in TMI Repo)

For each reference to something in the TMI codebase:

**File Path References**:
- If the document mentions a file path (e.g., "see `api/server.go`"), verify the file exists at that exact path
- Use Glob or Read to confirm existence
- If incorrect: Correct the path in the document if you can find the right file, OR mark with `<!-- NEEDS-REVIEW: File not found: [path] -->`

**Setting/Configuration References**:
- If the document mentions a setting name (e.g., "set `TMI_DATABASE_URL`"), verify in SOURCE CODE (not config files) that this setting is actually parsed and used
- Search for the setting name in `.go` files to find where it's read
- Verify acceptable values match what's documented
- If incorrect: Update the document OR mark with `<!-- NEEDS-REVIEW: Setting [name] not found in source -->`

**Behavior Claims**:
- If the document says "when X happens, the server does Y", find the code that implements this behavior
- Use Grep to search for relevant functions/handlers
- Read the source code to confirm the behavior
- If incorrect: Update the document OR mark with `<!-- NEEDS-REVIEW: Behavior not verified: [description] -->`

**Command/Make Target References**:
- If the document mentions a make target (e.g., "`make build-server`"), verify it exists in the Makefile
- If incorrect: Update OR mark with `<!-- NEEDS-REVIEW: Make target not found: [target] -->`

### 2.2 External/Third-Party References

For ANY reference to third-party tools, packages, or external documentation:

**Package Names**:
- If the document mentions an exact package name (e.g., "`@openapi/codegen`", "`gin-gonic/gin`"), you MUST find **at least 2 independent internet sources** confirming the exact name
- Use WebSearch to verify
- If you cannot find 2 sources agreeing: Mark with `<!-- NEEDS-REVIEW: Package name not verified: [name] -->`

**Installation Commands**:
- If the document says "install with `npm install foo`", verify with 2+ internet sources that this is the correct installation method
- Use WebSearch to check official docs and reputable sources

**External Tool Behavior**:
- If the document claims an external tool behaves a certain way, verify with 2+ internet sources
- Example: "golangci-lint uses .golangci.yml by default" - search to confirm

**URLs**:
- If the document contains URLs, verify they are still valid using WebFetch
- Mark broken links with `<!-- NEEDS-REVIEW: Broken link: [url] -->`

### 2.3 Verification Evidence

As you verify each claim, keep track of what you verified and how. You will include a summary at the end of the document.

## Phase 3: Update Document

After verification, update the original document:

1. Fix any incorrect information you were able to verify the correct value for
2. Add `<!-- NEEDS-REVIEW: ... -->` markers for anything you could not verify or that appears incorrect
3. Add a verification summary at the end of the document:

```markdown
<!--
VERIFICATION SUMMARY
Verified on: [date]
Agent: verify-migrate-doc

Verified items:
- [item]: [verification source/method]

Items needing review:
- [item]: [reason]
-->
```

## Phase 4: Migrate to Wiki

The wiki repository is located at: `/Users/efitz/Projects/tmi.wiki/`

### 4.1 Analyze Content Categories

Review the document content and determine which wiki page(s) it should be merged into. The wiki has these main pages (among others):

- `Home.md` - Landing page
- `API-Overview.md`, `API-Integration.md`, `REST-API-Reference.md`, `WebSocket-API-Reference.md` - API documentation
- `Getting-Started-with-Development.md` - Developer setup
- `Testing.md` - Testing documentation
- `Database-Setup.md`, `Database-Operations.md` - Database docs
- `Deploying-TMI-Server.md`, `Deploying-TMI-Web-Application.md` - Deployment
- `Configuration-Reference.md` - Configuration settings
- `Security-Best-Practices.md`, `Security-Operations.md` - Security
- `Architecture-and-Design.md` - Architecture
- `Debugging-Guide.md`, `Common-Issues.md` - Troubleshooting
- `Webhook-Integration.md`, `Addon-System.md` - Integrations

### 4.2 Content Distribution

A single documentation file may have content suitable for multiple wiki pages. For example:
- Setup instructions -> `Getting-Started-with-Development.md`
- Configuration options -> `Configuration-Reference.md`
- API details -> appropriate API page
- Troubleshooting -> `Common-Issues.md` or `Debugging-Guide.md`

### 4.3 Update Wiki Pages

For each target wiki page:

1. Read the existing wiki page
2. Find the appropriate section for the new content
3. Integrate the content, avoiding duplication
4. Maintain consistent formatting with the existing wiki style
5. Update the wiki's `_Sidebar.md` if adding new sections

### 4.4 Cross-Reference

Add a note in the wiki indicating where the content came from:
```markdown
<!-- Migrated from: [original-path] on [date] -->
```

## Phase 5: Mark as Migrated

After successful migration:

1. Create the migrated folder if it doesn't exist:
   ```
   docs/migrated/
   ```

2. Move the original file to the migrated folder, preserving the subdirectory structure:
   - Original: `docs/developer/setup/foo.md`
   - Migrated: `docs/migrated/developer/setup/foo.md`

3. The move operation should use `git mv` if possible to preserve history

## Output Summary

When complete, report:

1. **Verification Results**:
   - Number of items verified
   - Number of items needing review
   - List of any corrections made

2. **Migration Results**:
   - Which wiki pages were updated
   - What content was added to each

3. **File Status**:
   - Original location
   - New location (in migrated folder)

## Error Handling

If you encounter issues:
- Cannot read the file: Report error and stop
- File doesn't appear to be documentation: Report and ask for confirmation
- Wiki repo not accessible: Complete verification but skip migration, report error
- Uncertain about verification: Mark with NEEDS-REVIEW rather than guessing

## Example Verification

For a document containing:
```markdown
Install golangci-lint with `brew install golangci-lint`
```

You would:
1. WebSearch for "golangci-lint installation brew"
2. Find at least 2 sources (official docs, GitHub repo, reputable guides) confirming `brew install golangci-lint`
3. If confirmed: No change needed
4. If not confirmed or different: Update or mark for review
