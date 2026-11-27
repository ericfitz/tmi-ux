#!/usr/bin/env node
/**
 * Oxlint configuration self-test.
 *
 * Proves that `.oxlintrc.json` still reports what it is meant to report: every per-glob
 * override, the local `tmi/no-any-cast` plugin rule, and the type-aware rules (which need
 * project types to resolve). A clean lint of `src`/`e2e` cannot tell a working linter from a
 * blind one, so this lints a fixture tree of seeded violations and compares the diagnostics
 * (file, line, severity, rule) with `expected.json` exactly: a missing diagnostic means a rule
 * stopped firing, an extra one means an exemption (negative case) stopped applying, and a
 * changed severity means a rule became blocking or non-blocking. The number of enabled rules is
 * also compared, so deleting a rule no fixture exercises is caught too.
 *
 * The fixtures and the repo's real `tsconfig.json` are copied into a fresh OS temp directory
 * (unique per run, so concurrent runs do not collide) with a `node_modules` symlink to the
 * repo's, so imported types and the tsgolint binary resolve. The directory is removed when the
 * run ends, including on failure, Ctrl-C, SIGTERM and SIGHUP. It lives outside the repo because
 * oxlint skips anything the repo's .gitignore matches.
 *
 * Usage:
 *   node scripts/oxlint/selftest.mjs            run the self-test
 *   node scripts/oxlint/selftest.mjs --update   rewrite expected.json from the current output
 * Harness tests: node --test scripts/oxlint/selftest.test.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Default locations, relative to this file. */
export const DEFAULTS = {
  repo: path.resolve(HERE, '../..'),
  fixtures: path.join(HERE, 'selftest', 'fixtures'),
  expected: path.join(HERE, 'selftest', 'expected.json'),
};

const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

/**
 * Turns oxlint JSON output into sorted `file:line severity code` keys.
 * @param {{diagnostics?: Array<{filename: string, code?: string, severity?: string, message: string, labels?: Array<{span: {line: number}}>}>}} report
 * @returns {string[]}
 */
export function toKeys(report) {
  if (!report || !Array.isArray(report.diagnostics)) {
    throw new Error('oxlint output has no diagnostics array');
  }
  return report.diagnostics
    .map(d => {
      const line = d.labels?.[0]?.span?.line ?? 0;
      const code = d.code ?? `(no code) ${d.message}`;
      return `${d.filename.split(path.sep).join('/')}:${line} ${d.severity ?? '?'} ${code}`;
    })
    .sort();
}

/**
 * Compares actual and expected keys as multisets.
 * @param {string[]} actual
 * @param {string[]} expected
 * @returns {{missing: string[], unexpected: string[]}}
 */
export function compare(actual, expected) {
  const remaining = new Map();
  for (const k of expected) remaining.set(k, (remaining.get(k) ?? 0) + 1);
  const unexpected = [];
  for (const k of actual) {
    const n = remaining.get(k) ?? 0;
    if (n > 0) remaining.set(k, n - 1);
    else unexpected.push(k);
  }
  const missing = [...remaining].flatMap(([k, n]) => Array(n).fill(k));
  return { missing: missing.sort(), unexpected: unexpected.sort() };
}

/**
 * Reads and validates expected.json.
 * @param {string} file
 * @returns {{numberOfRules: number, diagnostics: string[]}}
 */
export function readExpected(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    !data ||
    !Number.isInteger(data.numberOfRules) ||
    data.numberOfRules <= 0 ||
    !Array.isArray(data.diagnostics) ||
    data.diagnostics.length === 0 ||
    !data.diagnostics.every(k => typeof k === 'string')
  ) {
    throw new Error(
      `${file}: expected {"numberOfRules": <positive integer>, "diagnostics": [<non-empty list of strings>]}`,
    );
  }
  return data;
}

/**
 * Runs oxlint in the work directory; `onChild` receives the child process so a signal handler can
 * stop it.
 */
async function runOxlint(repo, workDir, onChild) {
  const config = JSON.parse(fs.readFileSync(path.join(repo, '.oxlintrc.json'), 'utf8'));
  delete config.$schema;
  config.jsPlugins = (config.jsPlugins ?? []).map(p =>
    typeof p === 'string' && p.startsWith('.') ? path.resolve(repo, p) : p,
  );
  fs.writeFileSync(path.join(workDir, '.oxlintrc.json'), JSON.stringify(config, null, 2));
  const bin = path.join(workDir, 'node_modules', '.bin', 'oxlint');
  const child = spawn(bin, ['-c', '.oxlintrc.json', '-f', 'json', 'src', 'e2e'], { cwd: workDir });
  onChild(child);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', d => (stdout += d));
  child.stderr.setEncoding('utf8').on('data', d => (stderr += d));
  const status = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve(code));
  });
  if (status !== 0 && status !== 1) {
    throw new Error(`oxlint exited ${status}: ${stderr}`);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(`oxlint did not print JSON (exit ${status}): ${stderr || stdout}`);
  }
  if (!report || !report.number_of_files) {
    throw new Error('oxlint linted no files: the fixtures were ignored or not copied');
  }
  return report;
}

/**
 * Runs the self-test. Resolves to the process exit code; rejects on harness or oxlint failure.
 * A SIGINT, SIGTERM or SIGHUP during the run stops oxlint, removes the work directory and exits
 * with 128 + the signal number.
 * @param {{repo?: string, fixtures?: string, expected?: string, update?: boolean, log?: (s: string) => void, error?: (s: string) => void}} [opts]
 * @returns {Promise<number>}
 */
export async function main(opts = {}) {
  const { repo, fixtures, expected, update = false } = { ...DEFAULTS, ...opts };
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  if (!fs.existsSync(path.join(repo, 'node_modules', '.bin', 'oxlint'))) {
    error('oxlint is not installed: run `pnpm install` first.');
    return 2;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmi-oxlint-selftest-'));
  const cleanup = () => {
    // Remove the symlink first so the recursive delete can never reach the repo's node_modules.
    fs.rmSync(path.join(workDir, 'node_modules'), { force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  };
  let child;
  const handlers = Object.entries(SIGNAL_EXIT).map(([sig, code]) => {
    const handler = () => {
      child?.kill('SIGKILL');
      cleanup();
      process.exit(code);
    };
    process.once(sig, handler);
    return [sig, handler];
  });
  try {
    fs.cpSync(fixtures, workDir, { recursive: true });
    fs.copyFileSync(path.join(repo, 'tsconfig.json'), path.join(workDir, 'tsconfig.json'));
    fs.symlinkSync(path.join(repo, 'node_modules'), path.join(workDir, 'node_modules'), 'dir');
    const report = await runOxlint(repo, workDir, c => (child = c));
    const actual = toKeys(report);
    if (update) {
      if (actual.length === 0) {
        error('refusing to write an empty expected.json: the fixtures produced no diagnostics');
        return 1;
      }
      const data = { numberOfRules: report.number_of_rules, diagnostics: actual };
      fs.writeFileSync(expected, JSON.stringify(data, null, 2) + '\n');
      log(`expected.json updated: ${actual.length} diagnostics, ${report.number_of_rules} rules`);
      return 0;
    }
    const want = readExpected(expected);
    const { missing, unexpected } = compare(actual, want.diagnostics);
    const rulesOk = report.number_of_rules === want.numberOfRules;
    if (missing.length === 0 && unexpected.length === 0 && rulesOk) {
      log(
        `oxlint self-test: ${want.diagnostics.length} expected diagnostics and ${want.numberOfRules} rules, all matched`,
      );
      return 0;
    }
    error(`oxlint self-test FAILED (${missing.length} missing, ${unexpected.length} unexpected)`);
    if (!rulesOk)
      error(`  rule count: expected ${want.numberOfRules}, got ${report.number_of_rules}`);
    for (const k of missing) error(`  missing:    ${k}`);
    for (const k of unexpected) error(`  unexpected: ${k}`);
    return 1;
  } finally {
    for (const [sig, handler] of handlers) process.removeListener(sig, handler);
    cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const unknown = args.filter(a => a !== '--update');
  if (unknown.length > 0) {
    console.error(`unknown argument(s): ${unknown.join(' ')} (expected --update)`);
    process.exit(2);
  }
  process.exitCode = await main({ update: args.includes('--update') });
}
