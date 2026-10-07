# ADR 0004: The CI dependency bump pins the deps skill to a reviewed release

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decision by:** Eric Fitzgerald (human decision)
- **Related:** #987, #984, [ericfitz/skills](https://github.com/ericfitz/skills)

## Context

`.github/workflows/deps-bump.yml` runs the `deps:bump` skill from ericfitz/skills in a headless
Claude Code agent with `--dangerously-skip-permissions` and `CLAUDE_CODE_OAUTH_TOKEN` in its
environment. The skill's instructions and scripts run with those privileges, so a change to the
skills repo takes effect in this CI job. The workflow already pinned the skill to a commit, but
nothing flagged when the pin fell behind: it stayed on deps v1.0.0 (June 2026) after the skill
gained its Node adapter, and PR #984 then shipped a lockfile that failed every CI job.

## Decision

Keep the pin, and make moving it routine:

- `SKILL_SHA` names a deps release: the commit that set the version in
  `deps/.claude-plugin/plugin.json`. ericfitz/skills has no per-plugin git tags.
- The workflow warns, in the job summary and the bot's PR body, when the pinned release's version
  differs from the version on ericfitz/skills `main`.
- Moving `SKILL_SHA` is a reviewed tmi-ux change. `--plugin-dir` loads the whole `deps` plugin, so
  the review covers any hooks, MCP servers, agents or commands the new release adds, not just the
  skill.

Rejected: tracking ericfitz/skills `main` unpinned (any push to the skills repo would run in this
job with a live token), and copying the skill into tmi-ux (more churn and duplicated code).

## Consequences

- A newer skill release reaches CI only after someone reviews it and moves `SKILL_SHA`.
- The staleness warning compares `plugin.json` versions, so it relies on ericfitz/skills bumping
  the deps version for every release; a change without a version bump goes unnoticed.
- Before opening a PR, the workflow also requires `package.json` and `pnpm-lock.yaml` to match the
  bump commit and checks them with `pnpm install --frozen-lockfile --lockfile-only`, so a bad
  lockfile fails the job however it was produced.
