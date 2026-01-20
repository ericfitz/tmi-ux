# Migration Plan: Angular 21, Vitest 4, and Marked v17

**Issues:** [#241](https://github.com/ericfitz/tmi-ux/issues/241), [#320](https://github.com/ericfitz/tmi-ux/issues/320), [#263](https://github.com/ericfitz/tmi-ux/issues/263)

## Status: BLOCKED - Waiting for Stable Releases

**Last checked:** 2026-01-20

The target versions are **not yet available** on npm:
| Package | Target | npm Status | Latest Stable |
|---------|--------|------------|---------------|
| @angular/core | 21.x | Only `next` (21.0.0-next.2) | 20.2.4 |
| vitest | 4.x | Only `beta` (4.0.0-beta.10) | 3.2.4 |
| marked | 17.x | Not available | 16.4.1 |
| ngx-markdown | 21.x | Requires Angular 21 | 20.1.0 |

**Action:** Monitor npm releases. Re-attempt migration when stable versions are published.

---

## Overview (When Ready)

This plan will migrate TMI-UX from:
- Angular 20.3.16 → 21.x
- Vitest 3.2.4 → 4.x
- Marked 16.4.2 → 17.x (via ngx-markdown 21.x)

**Constraints:**
- AntV/X6 packages remain pinned at v2.x per user request
- Zoneless migration deferred (32 detectChanges calls, NgZone patterns, X6 integration make it a 6-8 week effort)

## Progress Tracking

- [x] Phase 0: Verify target versions available (BLOCKED)
- [ ] Phase 1: Pre-Migration Verification
- [ ] Phase 2: Update Angular Core
- [ ] Phase 3: Update Angular Material
- [ ] Phase 4: Update Angular ESLint
- [ ] Phase 5: Update ngx-markdown (Breaking Change)
- [ ] Phase 6: Update Vitest 4 (Breaking Change)
- [ ] Phase 7: Update @analogjs/vite-plugin-angular
- [ ] Phase 8: Final Verification

## Dependency Chain

The upgrades are interconnected:
1. **ngx-markdown 21.x** requires Angular 21 AND updates marked to 17.x
2. This means Angular 21 and Marked 17 must upgrade together via ngx-markdown
3. Vitest 4 can be done independently but makes sense to batch

## Breaking Changes Summary

| Package | Breaking Change | Code Change Required |
|---------|-----------------|---------------------|
| ngx-markdown 21 | `sanitize` config now uses `SANITIZE` injection token | Yes - [app.config.ts](../../src/app/app.config.ts) |
| Vitest 4 | `vi.restoreAllMocks()` no longer resets `vi.fn()` mocks | Yes - [test-setup.ts](../../src/test-setup.ts) |
| Angular 21 | `SimpleChanges` is generic (not used in codebase) | No |
| Marked 17 | Internal tokenization changes (abstracted by ngx-markdown) | No |

## Compatibility Verified

| Package | Current | Angular 21 Compatible? |
|---------|---------|------------------------|
| @jsverse/transloco | ^8.2.0 | Yes (supports >=16) |
| zone.js | ~0.16.0 | Yes (latest; Angular 21 works with zone.js or zoneless) |
| rxjs | ~7.8.2 | Yes (Angular 21 requires ^6.5.3 \|\| ^7.4.0) |
| typescript | ~5.9.3 | Yes (Angular 21 requires >=5.9.0 <6.0.0) |

---

## Phase 1: Pre-Migration Verification

```bash
git checkout -b chore/angular21-vitest4-marked17
pnpm run build
pnpm test
pnpm run lint:all
```

Ensure all tests pass before proceeding.

---

## Phase 2: Update Angular Core (ng update)

```bash
ng update @angular/core@21 @angular/cli@21
```

This updates all @angular/* packages to 21.x:
- @angular/animations, common, compiler, compiler-cli, core, forms
- @angular/platform-browser, platform-browser-dynamic, router
- @angular-devkit/build-angular, @angular/cli

**Verify:**
```bash
pnpm run build
```

---

## Phase 3: Update Angular Material

```bash
ng update @angular/material@21
```

Updates @angular/material and @angular/cdk to 21.x.

**Verify:**
```bash
pnpm run build
```

---

## Phase 4: Update Angular ESLint

```bash
ng update angular-eslint@21
```

Updates all @angular-eslint/* packages to 21.x.

**Verify:**
```bash
pnpm run lint:all
```

---

## Phase 5: Update ngx-markdown (Breaking Change)

### 5.1 Update dependencies in package.json

```json
{
  "dependencies": {
    "marked": "^17.0.0",
    "ngx-markdown": "^21.0.1"
  }
}
```

```bash
pnpm install
```

### 5.2 Update app.config.ts for SANITIZE token

**File:** [src/app/app.config.ts](../../src/app/app.config.ts)

**Current code (lines 304-306):**
```typescript
provideMarkdown({
  sanitize: SecurityContext.NONE,
}),
```

**Change to:**
```typescript
import { SANITIZE } from 'ngx-markdown';

// ... in providers array:
provideMarkdown(),
{
  provide: SANITIZE,
  useValue: (html: string) => html, // No-op since DOMPurify handles sanitization in markedOptionsFactory
},
```

Note: The project uses DOMPurify in the custom renderer (lines 168-249), so the SANITIZE provider just passes through. The actual sanitization happens in `markedOptionsFactory`.

**Verify:**
```bash
pnpm run build
pnpm test
```

---

## Phase 6: Update Vitest 4 (Breaking Change)

### 6.1 Update dependencies in package.json

```json
{
  "devDependencies": {
    "vitest": "^4.0.0",
    "@vitest/coverage-v8": "^4.0.0",
    "@vitest/ui": "^4.0.0"
  }
}
```

```bash
pnpm install
```

### 6.2 Update test-setup.ts for mock behavior change

**File:** [src/test-setup.ts](../../src/test-setup.ts)

**Current code (lines 14-18):**
```typescript
afterEach(() => {
  // Restore all mocks/spies after each test to prevent cross-test contamination
  // This is critical for tests that spy on global objects like crypto, window, etc.
  vi.restoreAllMocks();
});
```

**Change to:**
```typescript
afterEach(() => {
  // Reset all mocks (vi.fn() and vi.spyOn()) - clears call history and implementations
  vi.resetAllMocks();
  // Restore original implementations for vi.spyOn() mocks
  // In Vitest 4, restoreAllMocks only affects spyOn, not vi.fn()
  vi.restoreAllMocks();
});
```

**Verify:**
```bash
pnpm test
pnpm run test:coverage
```

---

## Phase 7: Update @analogjs/vite-plugin-angular

Check for Angular 21 compatible version:
```bash
npm view @analogjs/vite-plugin-angular versions --json | tail -5
```

Update to latest compatible version (likely ^2.3.x or higher):
```json
{
  "devDependencies": {
    "@analogjs/vite-plugin-angular": "^2.3.0"
  }
}
```

If no stable Angular 21 compatible version exists, try:
```bash
pnpm add -D @analogjs/vite-plugin-angular@beta
```

**Verify:**
```bash
pnpm test
```

---

## Phase 8: Final Verification

```bash
# Build
pnpm run build
pnpm run build:prod

# Tests
pnpm test
pnpm run test:e2e

# Lint
pnpm run lint:all
pnpm run format
```

### Manual Testing Checklist
- [ ] Application starts without console errors
- [ ] Login/authentication works
- [ ] Threat model list loads
- [ ] Create/edit/delete threat model works
- [ ] DFD diagram editor loads and functions (AntV/X6)
- [ ] Note editor markdown preview renders correctly
- [ ] Mermaid diagrams in notes render
- [ ] Code syntax highlighting works in notes
- [ ] Translations load (test with different locale)

---

## Package Version Summary

| Package | Current | Target |
|---------|---------|--------|
| @angular/* | ^20.3.16 | ^21.x |
| @angular/material | ^20.2.14 | ^21.x |
| @angular/cdk | ^20.2.14 | ^21.x |
| @angular-devkit/build-angular | ^20.3.14 | ^21.x |
| @angular/cli | ^20.3.14 | ^21.x |
| @angular-eslint/* | ^20.7.0 | ^21.x |
| ngx-markdown | ^20.1.0 | ^21.0.1 |
| marked | ^16.4.2 | ^17.0.0 |
| vitest | ^3.2.4 | ^4.0.0 |
| @vitest/coverage-v8 | ^3.2.4 | ^4.0.0 |
| @vitest/ui | ^3.2.4 | ^4.0.0 |
| @analogjs/vite-plugin-angular | ^2.2.2 | ^2.3.x (TBD) |

**Unchanged (verified compatible):**
- typescript: ~5.9.3 (Angular 21 requires >=5.9.0 <6.0.0)
- zone.js: ~0.16.0 (latest available; Angular 21 supports zoneless but zone.js still works)
- rxjs: ~7.8.2 (Angular 21 requires ^6.5.3 || ^7.4.0)
- @jsverse/transloco: ^8.2.0 (supports Angular >=16, which includes 21)
- @antv/x6: 2.19.2 (pinned, not updating per user request)

---

## Critical Files to Modify

1. [package.json](../../package.json) - All dependency version updates
2. [src/app/app.config.ts](../../src/app/app.config.ts) - ngx-markdown SANITIZE token migration
3. [src/test-setup.ts](../../src/test-setup.ts) - Vitest 4 mock behavior change

---

## Rollback Plan

If critical issues are discovered:
```bash
git checkout main
pnpm install
```

The migration branch can be preserved for debugging.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| @analogjs/vite-plugin-angular not yet Angular 21 compatible | High | Check releases before starting; may need beta version |
| ngx-markdown SANITIZE change breaks markdown | Medium | Documented migration; test note editor thoroughly |
| Vitest 4 mock changes cause test failures | Medium | vi.resetAllMocks() + vi.restoreAllMocks() pattern |
| Angular Material 21 component API changes | Low | No custom Material overrides in codebase |

---

## Future: Zoneless Migration (Deferred)

Angular 21 defaults to zoneless for new apps. This codebase will continue using zone.js for now due to:
- 32 `detectChanges()` calls across 10 components (heavy in DFD/collaboration)
- 4 NgZone usages for performance optimization (activity tracking, session timers)
- AntV/X6 graph events fire outside Angular context
- Test infrastructure depends on zone.js

**When ready to migrate zoneless:**
1. Replace `provideZoneChangeDetection()` with `provideExperimentalZonelessChangeDetection()`
2. Refactor NgZone patterns in ActivityTrackerService and SessionManagerService
3. Convert collaboration state to signals to eliminate manual detectChanges()
4. Update test infrastructure (remove zone.js imports, replace fakeAsync/tick)
5. Estimated effort: 6-8 weeks
