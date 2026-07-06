#!/usr/bin/env node
/**
 * Pure version calculator for the automated version-bump workflow
 * (.github/workflows/version-bump.yml).
 *
 * Semantics (agreed with maintainer):
 *   - A prerelease suffix on the current version (e.g. 1.6.0-rc.2) is treated as
 *     the human-chosen release target: strip the suffix and publish exactly that
 *     base version, with no further increment, regardless of commit type. This is
 *     how a release/X.Y.0 branch finalizes when it merges to main.
 *   - Otherwise, if the human raised the MAJOR version directly (current major >
 *     previous major on a plain, non-prerelease version), keep the version as set:
 *     major bumps are never automatic.
 *   - Otherwise apply the conventional-commit bump: 'minor' or 'patch'.
 *
 * Usage:
 *   node scripts/compute-next-version.mjs <current> <previous> <minor|patch>
 *     -> prints the next version (or the unchanged current version when no bump applies)
 *   node scripts/compute-next-version.mjs --test
 *     -> runs the self-test suite (exit 0 on success, 1 on failure)
 */

/**
 * @param {string} v semantic version, optionally with a prerelease suffix
 * @returns {{ maj: number, min: number, pat: number, pre: string | undefined }}
 */
function parse(v) {
  const s = String(v);
  const dash = s.indexOf('-');
  const core = dash === -1 ? s : s.slice(0, dash);
  const pre = dash === -1 ? undefined : s.slice(dash + 1);
  const [maj, min, pat] = core.split('.').map((n) => parseInt(n, 10));
  return { maj, min, pat, pre };
}

/**
 * Compute the next version from the current version, the previous version on the
 * branch (used only to detect a human-initiated major bump), and the bump type.
 *
 * @param {string} current  current package.json version
 * @param {string} previous version before this push (for major-change detection)
 * @param {'minor' | 'patch' | ''} bump conventional-commit-derived bump type
 * @returns {string} the next version (equal to `current`'s core when no change applies)
 */
export function computeNextVersion(current, previous, bump) {
  const c = parse(current);
  const p = parse(previous ?? current);

  // Prerelease present -> finalize to the human-chosen target (strip suffix, no bump).
  if (c.pre !== undefined) return `${c.maj}.${c.min}.${c.pat}`;

  // Human raised the major directly -> preserve it (major is never automatic).
  if (c.maj > p.maj) return `${c.maj}.${c.min}.${c.pat}`;

  // Normal type-based bump on a plain version.
  if (bump === 'minor') return `${c.maj}.${c.min + 1}.0`;
  if (bump === 'patch') return `${c.maj}.${c.min}.${c.pat + 1}`;

  // No recognized bump -> unchanged.
  return `${c.maj}.${c.min}.${c.pat}`;
}

function runTests() {
  const cases = [
    // [current, previous, bump, expected]
    // Prerelease present -> finalize to target (no increment), any type.
    ['1.6.0-rc.2', '1.5.9', 'patch', '1.6.0'],
    ['1.6.0-rc.2', '1.5.9', 'minor', '1.6.0'],
    ['2.0.0-rc.0', '1.9.0', 'patch', '2.0.0'],
    ['2.0.0-rc.0', '1.9.0', 'minor', '2.0.0'],
    // Plain version, normal work.
    ['1.5.2', '1.5.1', 'patch', '1.5.3'],
    ['1.5.2', '1.5.1', 'minor', '1.6.0'],
    ['1.5.2', '1.5.1', '', '1.5.2'], // no bump type -> unchanged
    // Human raised major directly -> keep as-is regardless of bump.
    ['2.0.0', '1.9.3', 'patch', '2.0.0'],
    ['2.0.0', '1.9.3', 'minor', '2.0.0'],
    // Established major, normal work continues.
    ['2.1.4', '2.1.3', 'patch', '2.1.5'],
    ['2.1.4', '2.1.3', 'minor', '2.2.0'],
  ];

  let failed = 0;
  for (const [cur, prev, bump, expected] of cases) {
    const got = computeNextVersion(cur, prev, bump);
    const ok = got === expected;
    if (!ok) failed++;
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${cur} (prev ${prev}, ${bump || 'none'}) -> ${got}${ok ? '' : `  expected ${expected}`}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  return failed === 0;
}

// --- CLI ---
const args = process.argv.slice(2);
if (args[0] === '--test') {
  process.exit(runTests() ? 0 : 1);
} else if (args.length >= 3) {
  // eslint-disable-next-line no-console
  console.log(computeNextVersion(args[0], args[1], args[2]));
} else {
  // eslint-disable-next-line no-console
  console.error('usage: compute-next-version.mjs <current> <previous> <minor|patch> | --test');
  process.exit(2);
}
