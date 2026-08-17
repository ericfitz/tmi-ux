#!/usr/bin/env node

/**
 * Ratchet guard for unit-test type errors (issue #858).
 *
 * `pnpm test` runs vitest, which transpiles specs without type-checking them,
 * so nothing verified the types under tsconfig.vitest.json and 534 errors
 * accumulated unnoticed. Clearing the remaining long tail is ongoing work, so
 * this guard stops the bleeding in the meantime: it fails when the error count
 * rises above the recorded baseline, and tells you to lower the baseline when
 * the count drops.
 *
 * Usage:
 *   node scripts/typecheck-vitest-ratchet.mjs            # check against baseline
 *   node scripts/typecheck-vitest-ratchet.mjs --update   # record current count
 *
 * The baseline lives in typecheck-vitest-baseline.json so a drop shows up as a
 * reviewable diff rather than an invisible constant.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO_ROOT, 'typecheck-vitest-baseline.json');
const PROJECT = 'tsconfig.vitest.json';

/** Matches a tsc diagnostic line: `path/file.ts(12,34): error TS1234: ...` */
const DIAGNOSTIC = /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+):/;

/**
 * Run tsc against the vitest project and summarize the diagnostics.
 *
 * @returns {{count: number, byCode: Record<string, number>, byFile: Record<string, number>}}
 */
function measure() {
  const result = spawnSync('npx', ['tsc', '--noEmit', '-p', PROJECT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to run tsc: ${result.error.message}`);
  }

  const byCode = {};
  const byFile = {};
  let count = 0;

  for (const raw of `${result.stdout}`.split('\n')) {
    const match = DIAGNOSTIC.exec(raw);
    if (!match) {
      continue;
    }
    count += 1;
    byCode[match.groups.code] = (byCode[match.groups.code] ?? 0) + 1;
    byFile[match.groups.file] = (byFile[match.groups.file] ?? 0) + 1;
  }

  return { count, byCode, byFile };
}

/**
 * Read the recorded baseline count.
 *
 * @returns {number}
 */
function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    if (typeof parsed.errors !== 'number') {
      throw new Error('missing numeric "errors" field');
    }
    return parsed.errors;
  } catch (error) {
    throw new Error(
      `Could not read ${BASELINE_PATH}: ${error.message}\n` +
        'Run: node scripts/typecheck-vitest-ratchet.mjs --update',
    );
  }
}

/**
 * Write a new baseline, including the breakdown for reviewers.
 *
 * @param {{count: number, byCode: Record<string, number>, byFile: Record<string, number>}} summary
 */
function writeBaseline(summary) {
  const sortDesc = entries =>
    Object.fromEntries([...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        _comment:
          'Ratchet baseline for `pnpm run typecheck:vitest` (issue #858). ' +
          'This number may only go down. Lower it with `node scripts/typecheck-vitest-ratchet.mjs --update`.',
        errors: summary.count,
        files: Object.keys(summary.byFile).length,
        byCode: sortDesc(Object.entries(summary.byCode)),
        byFile: sortDesc(Object.entries(summary.byFile)),
      },
      null,
      2,
    )}\n`,
  );
}

const shouldUpdate = process.argv.slice(2).includes('--update');
const summary = measure();

if (shouldUpdate) {
  writeBaseline(summary);
  console.log(
    `Recorded baseline: ${summary.count} error(s) across ${Object.keys(summary.byFile).length} file(s).`,
  );
  process.exit(0);
}

const baseline = readBaseline();

if (summary.count > baseline) {
  const topFiles = Object.entries(summary.byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, n]) => `  ${String(n).padStart(4)}  ${file}`)
    .join('\n');

  console.error(
    `Unit-test type errors increased: ${summary.count} > baseline ${baseline} (+${summary.count - baseline}).\n\n` +
      `Fix the new errors, or see them with:\n  pnpm run typecheck:vitest\n\n` +
      `Worst files:\n${topFiles}\n`,
  );
  process.exit(1);
}

if (summary.count < baseline) {
  console.log(
    `Unit-test type errors decreased: ${summary.count} < baseline ${baseline} (-${baseline - summary.count}).\n` +
      'Lower the baseline to lock the improvement in:\n' +
      '  node scripts/typecheck-vitest-ratchet.mjs --update\n',
  );
  process.exit(1);
}

console.log(`Unit-test type errors at baseline: ${summary.count}.`);
