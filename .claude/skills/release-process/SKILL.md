---
name: release-process
description: Versioning, version-bump workflow, and release/feature branching strategy for this repo. Use when committing to main, creating or merging a release or feature branch, reasoning about version numbers or prerelease suffixes, or changing the version-bump workflow.
---

# Versioning

Automatic semantic versioning on push to `main` via the `.github/workflows/version-bump.yml` GitHub Actions workflow, using [Conventional Commits](https://www.conventionalcommits.org/). It derives the bump from the pushed commits and commits a `chore: bump version to X.Y.Z [skip ci]` commit plus a `vX.Y.Z` tag back to `main`:

- `feat:`/`refactor:` → minor bump (x.Y.0)
- `fix:`/`chore:`/`docs:`/`perf:`/`test:`/`ci:`/`build:`/`deps:`/`ops:` → patch bump (x.y.Z)
- **Major** bumps are never automatic — raise the major by hand; the workflow strips any prerelease suffix and preserves the version you set.
- **Prerelease finalization**: when `package.json` carries a prerelease suffix at push time (e.g. a `release/1.6.0` branch at `1.6.0-rc.N` merging to `main`), the workflow strips the suffix to publish exactly that target (`1.6.0`) with no further increment.
- Bumps are skipped when a push changes only tests, `src/testing/`, `src/environments/`, or non-`src` files. Version math lives in `scripts/compute-next-version.mjs` (run `node scripts/compute-next-version.mjs --test`).
- No loop: the bump is pushed with the built-in `GITHUB_TOKEN`, whose pushes do not re-trigger workflows.

Version bumps happen server-side on push to `main`, not on local commit or build. (The former local `post-commit` bump hook has been removed.)

# Branching Strategy

Feature development for a release uses a `release/<semver>` branch:

1. **Release branch**: Created from `main` (e.g., `release/1.2.0`) with a prerelease version in `package.json` (e.g., `1.2.0-rc.0`)
2. **Feature branches**: Created from the release branch as `feature/<name>`, merged back when complete
3. **Release merge**: When all features are ready, the release branch merges into `main` with the prerelease suffix cleared for the stable release

The version-bump workflow only runs on `main`, so the `rc.0` prerelease label stays stable throughout development on the release branch; when the release branch merges to `main`, the workflow strips the suffix to publish the stable release. Deploy scripts pass the version from `package.json` as a `--build-arg APP_VERSION` to Docker builds for OCI image labels.
