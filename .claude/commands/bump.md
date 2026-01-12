# Bump Command

Safely update pnpm JavaScript/TypeScript package dependencies, focusing on patch and minor version updates that maintain application stability.

## Overview

This command performs a controlled dependency update:
1. Analyzes all direct and transitive dependencies for available updates
2. Separates updates into safe (patch/minor) and excluded (major/special) categories
3. Applies safe updates automatically
4. Presents recommendations for excluded packages (Angular, AntV/X6, major versions)
5. Validates the project builds and tests pass after updates

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

### Step 1: Check Current State

Run `pnpm outdated --format json` to get the current state of all dependencies:

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

### Step 2: Categorize Updates

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

### Step 3: Display Analysis

Present the analysis to the user:

```
Dependency Update Analysis

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

### Step 4: Apply Safe Updates

For each safe update, use `pnpm update` with the specific package:

```bash
pnpm update <package-name>@<target-version>
```

Or batch update all safe packages:

```bash
pnpm update <package1> <package2> <package3> ...
```

**Important:** Use `pnpm update` without `--latest` to respect semver ranges and only apply wanted versions.

### Step 5: Install and Lock

After updates, ensure the lockfile is consistent:

```bash
pnpm install
```

### Step 6: Validate Build

Run the build to ensure no breaking changes:

```bash
pnpm run build
```

If the build fails:
1. Identify the failing package(s)
2. Revert the problematic update(s) using `pnpm update <package>@<previous-version>`
3. Re-run the build
4. Report which packages caused issues

### Step 7: Run Tests

Run the test suite to validate functionality:

```bash
pnpm test
```

If tests fail:
1. Analyze test failures to identify the cause
2. If caused by a dependency update, revert that specific package
3. Re-run tests
4. Report which packages caused test failures

### Step 8: Lint Check

Run linting to ensure code style is maintained:

```bash
pnpm run lint:all
```

### Step 9: Display Final Report

```
Dependency Update Complete

Applied Updates:
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

- **pnpm outdated fails**: Report error and exit
- **Build fails after update**: Revert failing packages, continue with remaining updates
- **Tests fail after update**: Revert failing packages, continue with remaining updates
- **Network errors**: Retry up to 3 times, then report and exit

## Usage

```bash
/bump           # Run dependency bump analysis and update
```

## Implementation Notes

1. **Transitive dependencies**: `pnpm outdated` shows direct dependencies only by default. Transitive dependencies are handled automatically by pnpm's lockfile resolution.

2. **Lockfile changes**: The `pnpm-lock.yaml` file will be updated. This is expected and should be committed.

3. **Version ranges**: This command respects the semver ranges in `package.json`. It updates to the latest version within the allowed range (`wanted`), not necessarily the `latest` version.

4. **Angular coordinated updates**: When Angular packages need updating, they should all be updated together. This is why they're excluded from automatic updates.

5. **AntV/X6 pinning**: The project has `@antv/x6` pinned at `2.19.2` with a comment explaining v3.x has breaking changes. Respect this pinning.

6. **Reverting updates**: If a package causes issues, use `pnpm update <package>@<previous-version>` to revert, then `pnpm install`.

7. **Security considerations**: This command does not bypass security advisories. If a package has a security vulnerability requiring a major update, it will be flagged in recommendations.

## Related Commands

- `pnpm audit` - Check for security vulnerabilities
- `pnpm outdated` - View outdated packages (raw output)
- `pnpm update` - Update packages (manual)

---

Now execute this process.
