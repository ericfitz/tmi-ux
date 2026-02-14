# Bump Command

Safely update pnpm JavaScript/TypeScript package dependencies, focusing on patch and minor version updates that maintain application stability.

## Overview

This command performs a controlled dependency update:
1. Runs a security audit to identify vulnerable transitive dependencies
2. Checks pnpm overrides for available patch/minor updates
3. Analyzes all direct dependencies for available updates
4. Separates updates into safe (patch/minor) and excluded (major/special) categories
5. Applies safe updates and security fixes automatically
6. Presents recommendations for excluded packages (Angular, AntV/X6, major versions)
7. Validates the project builds and tests pass after updates

## Exclusion Rules

The following packages are **never** automatically updated:

### Angular Ecosystem
- `@angular/*` - All Angular core and related packages
- `@angular-devkit/*` - Angular build tools
- `@angular-eslint/*` - Angular ESLint integration
- `angular-eslint` - Angular ESLint package
- `zone.js` - Angular's zone.js dependency

### AntV/X6 Ecosystem
- `@antv/x6` - Core X6 library (pinned per project comment)
- `@antv/x6-plugin-*` - All X6 plugins

### Major Version Updates
- Any package where the available update crosses a major version boundary

## Process

### Step 1: Refresh Package Registry Cache

Before checking for outdated packages, prune the pnpm store to ensure fresh registry metadata. Without this step, pnpm may use stale cached data and miss recent package updates.

```bash
pnpm store prune
```

### Step 2: Security Audit

Run `pnpm audit --json` to check for known vulnerabilities in transitive dependencies:

```bash
pnpm audit --json
```

This returns a JSON object with vulnerability information:
```json
{
  "advisories": {
    "1234": {
      "module_name": "qs",
      "severity": "high",
      "title": "Prototype Pollution",
      "findings": [{ "version": "6.14.1", "paths": ["express>qs"] }],
      "patched_versions": ">=6.14.2"
    }
  },
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 1, "critical": 0 }
  }
}
```

**Processing audit results:**

For each advisory:
1. Check if the vulnerable package is already in `pnpm.overrides` in `package.json`
2. If yes, update the override version to the patched version (if it's a patch/minor bump)
3. If no, add a new override entry to pin the patched version
4. If the fix requires a major version bump, flag it in the excluded/recommendations section instead

**Important:** Only auto-apply audit fixes that are patch or minor version bumps. Major version fixes should be flagged as recommendations. Apply the same exclusion rules (Angular, AntV/X6) to audit fixes.

### Step 3: Check Override Updates

Examine the `pnpm.overrides` section in `package.json` for packages that have newer patch/minor versions available, independent of security advisories. Overrides are typically added for security or compatibility reasons and should be kept current.

For each override entry:
1. Parse the package name and current version from the override
2. Look up the latest available version using `pnpm view <package> version`
3. If a newer patch or minor version exists within the same major, flag it as a safe update
4. Skip overrides that use complex selectors (e.g., `wrap-ansi@9.0.1`) — these pin specific transitive dependency versions and should not be auto-bumped

**Override version formats to handle:**
- `^1.2.3` or `>=1.2.3` — semver ranges, update the version number
- `1.2.3` — exact pins, update to the latest patch/minor within the same major
- `package@version` selector format (e.g., `wrap-ansi@9.0.1`: `9.0.0`) — skip, these are targeted overrides

Present override updates alongside other safe updates in the analysis display.

### Step 4: Check Current State

Run `pnpm outdated --format json` to get the current state of all direct dependencies:

```bash
pnpm outdated --format json
```

This returns a JSON object with package information:
```json
{
  "package-name": {
    "current": "1.2.3",
    "latest": "2.0.0",
    "wanted": "1.9.0",
    "isDeprecated": false,
    "dependencyType": "dependencies"
  }
}
```

**Key fields:**
- `current`: Currently installed version
- `latest`: Latest available version (may be a major bump)
- `wanted`: Latest version matching the semver range in package.json
- `dependencyType`: "dependencies", "devDependencies", or "optionalDependencies"

### Step 5: Categorize Updates

Parse the output and categorize each package:

**Safe Updates (auto-apply):**
- Patch updates: `1.2.3` -> `1.2.5`
- Minor updates: `1.2.3` -> `1.5.0`
- Must NOT be in the exclusion list (Angular, AntV/X6)
- Must NOT cross a major version boundary

**Excluded Updates (recommendations only):**
- Angular ecosystem packages
- AntV/X6 ecosystem packages
- Major version updates (e.g., `1.x.x` -> `2.x.x`)

**Version Comparison Logic:**

```
function isMajorBump(current, target):
  currentMajor = parseInt(current.split('.')[0].replace(/[^0-9]/g, ''))
  targetMajor = parseInt(target.split('.')[0].replace(/[^0-9]/g, ''))
  return targetMajor > currentMajor

function isExcludedPackage(name):
  return name.startsWith('@angular/') ||
         name.startsWith('@angular-devkit/') ||
         name.startsWith('@angular-eslint/') ||
         name === 'angular-eslint' ||
         name === 'zone.js' ||
         name.startsWith('@antv/x6')
```

### Step 6: Display Analysis

Present the analysis to the user:

```
Dependency Update Analysis

Security Fixes (will be applied):
-----------------------------------------
Package                     Current   Patched   Severity   Source
-----------------------------------------
qs                          6.14.1    6.14.2    high       audit (override)
...
-----------------------------------------
Total: 1 package

Override Updates (will be applied):
-----------------------------------------
Package                     Current   Target    Type       Notes
-----------------------------------------
hono                        4.11.7    4.11.9    patch      exact pin
...
-----------------------------------------
Total: 1 package
Skipped: 2 (targeted selectors: wrap-ansi@9.0.1, slice-ansi@7.1.1)

Safe Updates (will be applied):
-----------------------------------------
Package                     Current   Target    Type
-----------------------------------------
rxjs                        7.8.1     7.8.2     patch
marked                      16.4.0    16.4.2    patch
eslint                      9.38.0    9.39.2    minor
vitest                      3.1.0     3.2.4     minor
...
-----------------------------------------
Total: 15 packages

Excluded Updates (recommendations):
-----------------------------------------
Package                     Current   Latest    Reason
-----------------------------------------
@angular/core               20.2.0    21.0.0    Angular ecosystem (major)
@angular/material           20.1.0    20.2.14   Angular ecosystem
@antv/x6                    2.19.2    3.0.0     AntV/X6 (major)
typescript                  5.8.0     6.0.0     Major version
...
-----------------------------------------
Total: 8 packages

Proceed with safe updates? (Continuing automatically)
```

### Step 7: Apply Security Fixes and Override Updates

For security fixes identified by `pnpm audit`:
1. Update the version in `pnpm.overrides` (or add a new override if one doesn't exist)
2. If the package also appears as a direct dependency, update that version too

For override updates:
1. Update the version in the `pnpm.overrides` entry
2. If the same package appears as a direct dependency with the same pin, update both

### Step 8: Apply Safe Updates

For each safe update, use `pnpm update` with the specific package:

```bash
pnpm update <package-name>@<target-version>
```

Or batch update all safe packages:

```bash
pnpm update <package1> <package2> <package3> ...
```

**Important:** Use `pnpm update` without `--latest` to respect semver ranges and only apply wanted versions.

### Step 9: Install and Lock

After updates, ensure the lockfile is consistent:

```bash
pnpm install
```

### Step 10: Validate Build

Run the build to ensure no breaking changes:

```bash
pnpm run build
```

If the build fails:
1. Identify the failing package(s)
2. Revert the problematic update(s) using `pnpm update <package>@<previous-version>`
3. Re-run the build
4. Report which packages caused issues

### Step 11: Run Tests

Run the test suite to validate functionality:

```bash
pnpm test
```

If tests fail:
1. Analyze test failures to identify the cause
2. If caused by a dependency update, revert that specific package
3. Re-run tests
4. Report which packages caused test failures

### Step 12: Lint Check

Run linting to ensure code style is maintained:

```bash
pnpm run lint:all
```

### Step 13: Display Final Report

```
Dependency Update Complete

Security Fixes Applied:
-----------------------------------------
Package                     Previous  Updated   Severity   Source
-----------------------------------------
qs                          6.14.1    6.14.2    high       audit (override)
...
-----------------------------------------
Total: 1 package

Override Updates Applied:
-----------------------------------------
Package                     Previous  Updated   Type
-----------------------------------------
hono                        4.11.7    4.11.9    patch
...
-----------------------------------------
Total: 1 package

Direct Dependency Updates Applied:
-----------------------------------------
Package                     Previous  Updated   Type
-----------------------------------------
rxjs                        7.8.1     7.8.2     patch
marked                      16.4.0    16.4.2    patch
eslint                      9.38.0    9.39.2    minor
...
-----------------------------------------
Successfully updated: 14 packages
Reverted (caused issues): 1 package
  - some-package: Build failed with "error message"

Recommendations for Manual Review:
-----------------------------------------
Angular Ecosystem:
  @angular/core: 20.2.0 -> 21.0.0 (major version)
    Recommendation: Review Angular 21 migration guide before updating
    https://angular.dev/update-guide

  @angular/material: 20.1.0 -> 20.2.14 (minor version)
    Recommendation: Can likely be updated safely with Angular core

AntV/X6:
  @antv/x6: 2.19.2 -> 3.0.0 (major version)
    Note: Project comment indicates v3.x has breaking changes
    Recommendation: Requires significant refactoring per project docs

Major Version Updates:
  typescript: 5.8.0 -> 6.0.0 (major version)
    Recommendation: Test thoroughly in a separate branch

Build Status: PASSED
Test Status: PASSED
Lint Status: PASSED
```

## Error Handling

- **pnpm audit fails**: Report error but continue with `pnpm outdated` and override checks
- **pnpm outdated fails**: Report error and exit
- **pnpm view fails** (for override checking): Skip that override, report it, and continue with others
- **Build fails after update**: Revert failing packages, continue with remaining updates
- **Tests fail after update**: Revert failing packages, continue with remaining updates
- **Network errors**: Retry up to 3 times, then report and exit

## Usage

```bash
/bump           # Run dependency bump analysis and update
```

## Implementation Notes

1. **Transitive dependencies**: `pnpm outdated` shows direct dependencies only by default. Transitive dependencies are handled by `pnpm audit` (for security) and override checking (for version currency).

2. **Lockfile changes**: The `pnpm-lock.yaml` file will be updated. This is expected and should be committed.

3. **Version ranges**: This command respects the semver ranges in `package.json`. It updates to the latest version within the allowed range (`wanted`), not necessarily the `latest` version.

4. **Angular coordinated updates**: When Angular packages need updating, they should all be updated together. This is why they're excluded from automatic updates.

5. **AntV/X6 pinning**: The project has `@antv/x6` pinned at `2.19.2` with a comment explaining v3.x has breaking changes. Respect this pinning.

6. **Reverting updates**: If a package causes issues, use `pnpm update <package>@<previous-version>` to revert, then `pnpm install`.

7. **Security audit**: `pnpm audit` catches vulnerabilities in transitive dependencies that `pnpm outdated` misses. Overrides are the primary mechanism for pinning transitive dependency versions in pnpm, so audit fixes often require updating or adding override entries.

8. **Override management**: Overrides in `pnpm.overrides` pin transitive dependency versions, typically for security or compatibility. These should be kept current with patch/minor updates. Overrides using the `package@version` selector syntax (e.g., `"wrap-ansi@9.0.1": "9.0.0"`) target specific transitive resolution paths and should not be auto-bumped — they require manual analysis.

9. **Dual entries**: Some packages appear both as a direct dependency and as an override (e.g., `hono`). When updating these, both entries must be updated together to avoid version conflicts.

## Related Commands

- `pnpm audit` - Check for security vulnerabilities
- `pnpm outdated` - View outdated packages (raw output)
- `pnpm update` - Update packages (manual)

---

Now execute this process.
