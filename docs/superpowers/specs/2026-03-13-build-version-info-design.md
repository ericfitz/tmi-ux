# Build/Version Info in Bug Reports and About Page

**Issue:** #476
**Date:** 2026-03-13

## Problem

When users report bugs via the feedback menu, the pre-filled GitHub issue template lacks client and server version/build information. This makes it harder to reproduce and diagnose issues.

## Solution

### 1. Build Info Generation

Generate `src/build-info.json` at build time containing the short git commit hash:

```json
{ "gitCommit": "abc1234" }
```

- Add `prebuild` and `predev` npm scripts in `package.json` that run `git rev-parse --short HEAD` and write the file
- Add `src/build-info.json` to `.gitignore` (generated artifact)
- Add a TypeScript declaration so the JSON can be imported with type safety

### 2. Bug Report Template (NavbarComponent)

Modify `reportBug()` in `navbar.component.ts` to include an "Environment" section in the pre-filled issue body:

```
## Environment
- Client: 1.3.1 (abc1234)
- Server: tmi-server/0.5.2-g7890def
```

- Import `version` from `package.json` (already used in about page)
- Import `gitCommit` from `build-info.json`
- Read server version from the already-injected `ServerConnectionService`
- Place the Environment section at the top of the issue body, before Description

### 3. About Page

Update `about.component.ts` to import and display the git commit hash alongside the client version, rendering as "1.3.1 (abc1234)" instead of just "1.3.1".

### 4. Docker Builds

No changes required. The `prebuild` script executes as part of `pnpm run build` inside the Docker build context, where git metadata is available via the build context.

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `prebuild` and `predev` scripts |
| `.gitignore` | Add `src/build-info.json` |
| `src/build-info.json.d.ts` | TypeScript declaration for build-info.json |
| `src/app/core/components/navbar/navbar.component.ts` | Add version/commit imports, update `reportBug()` template |
| `src/app/pages/about/about.component.ts` | Import and display git commit hash |
| `src/app/pages/about/about.component.html` | Show commit hash next to version |

## Scope Exclusions

- No localization changes for the Environment section label (it appears in the GitHub issue, not in the app UI)
- No changes to log JSONL format
- No changes to deployment scripts or Dockerfiles
