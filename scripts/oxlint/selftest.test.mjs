/**
 * Tests for scripts/oxlint/selftest.mjs, run with `node --test scripts/oxlint/selftest.test.mjs`.
 * End-to-end cases run main() against a fake repo whose `node_modules/.bin/oxlint` is a stub
 * that records its working directory and behaves according to STUB_MODE.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { compare, main, readExpected, toKeys } from './selftest.mjs';

const SELFTEST_URL = new URL('./selftest.mjs', import.meta.url).href;
const SELFTEST_PATH = new URL('./selftest.mjs', import.meta.url).pathname;

const STUB = `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.STUB_CWD_FILE, process.cwd());
fs.writeFileSync(process.env.STUB_CWD_FILE + '.rc', fs.readFileSync('.oxlintrc.json'));
const diag = { filename: 'src/a.ts', code: 'eslint(no-console)', severity: 'warning', message: 'm', labels: [{ span: { line: 1 } }] };
const out = (o) => process.stdout.write(JSON.stringify(o));
switch (process.env.STUB_MODE) {
  case 'ok': out({ diagnostics: [diag], number_of_files: 1, number_of_rules: 3 }); process.exit(1);
  case 'none': out({ diagnostics: [], number_of_files: 1, number_of_rules: 3 }); process.exit(0);
  case 'nofiles': out({ diagnostics: [], number_of_files: 0, number_of_rules: null }); process.exit(1);
  case 'nojson': process.stdout.write('No files found'); process.exit(1);
  case 'slow': setTimeout(() => { out({ diagnostics: [diag], number_of_files: 1, number_of_rules: 3 }); process.exit(1); }, 1500); break;
  case 'crash': process.stderr.write('boom'); process.exit(2);
  default: process.stderr.write('unknown STUB_MODE'); process.exit(3);
}
`;
const OK_KEY = 'src/a.ts:1 warning eslint(no-console)';

describe('pure helpers', () => {
  test('toKeys includes severity, sorts, and keeps code-less diagnostics', async () => {
    const report = {
      diagnostics: [
        {
          filename: 'src/b.ts',
          code: 'eslint(no-console)',
          severity: 'warning',
          message: 'm',
          labels: [{ span: { line: 2 } }],
        },
        {
          filename: 'src/a.ts',
          code: 'tmi(no-any-cast)',
          severity: 'error',
          message: 'm',
          labels: [{ span: { line: 5 } }],
        },
        {
          filename: 'src/a.ts',
          severity: 'warning',
          message: 'Unused directive',
          labels: [{ span: { line: 9 } }],
        },
      ],
    };
    assert.deepEqual(toKeys(report), [
      'src/a.ts:5 error tmi(no-any-cast)',
      'src/a.ts:9 warning (no code) Unused directive',
      'src/b.ts:2 warning eslint(no-console)',
    ]);
  });
  test('toKeys rejects output without diagnostics', async () => {
    assert.throws(() => toKeys({}), /no diagnostics array/);
    assert.throws(() => toKeys(null), /no diagnostics array/);
  });
  test('compare: exact match, duplicates, empty actual', async () => {
    assert.deepEqual(compare(['a', 'b'], ['b', 'a']), { missing: [], unexpected: [] });
    assert.deepEqual(compare(['a', 'a', 'c'], ['a', 'b']), {
      missing: ['b'],
      unexpected: ['a', 'c'],
    });
    assert.deepEqual(compare([], ['x']), { missing: ['x'], unexpected: [] });
  });
});

describe('command line', () => {
  // --bogus is rejected before any lint runs, so these prove the CLI block executes (an inert
  // main-module guard would print nothing and exit 0) without running oxlint.
  const cli = script => spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
  test('rejects unknown arguments with exit 2 (real path)', () => {
    const res = cli(SELFTEST_PATH);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /unknown argument\(s\): --bogus/);
  });
  test('runs when invoked through a symlinked path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selftest-cli-'));
    try {
      const link = path.join(dir, 'selftest.mjs');
      fs.symlinkSync(SELFTEST_PATH, link);
      const res = cli(link);
      assert.equal(res.status, 2);
      assert.match(res.stderr, /unknown argument/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('main against a stub oxlint', () => {
  let root;
  let repo;
  let fixtures;
  let expected;
  let cwdFile;
  const errors = [];
  const run = async (opts = {}) =>
    main({ repo, fixtures, expected, log: () => {}, error: s => errors.push(s), ...opts });
  const writeExpected = data => fs.writeFileSync(expected, JSON.stringify(data));
  const workDirGone = () => {
    const dir = fs.readFileSync(cwdFile, 'utf8');
    assert.match(path.basename(dir), /^tmi-oxlint-selftest-/);
    assert.equal(fs.existsSync(dir), false, `work dir ${dir} was not removed`);
    assert.equal(
      fs.existsSync(path.join(repo, 'node_modules', 'keep.txt')),
      true,
      'symlink target was deleted',
    );
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'selftest-test-'));
    repo = path.join(root, 'repo');
    fixtures = path.join(root, 'fixtures');
    expected = path.join(root, 'expected.json');
    cwdFile = path.join(root, 'cwd.txt');
    fs.mkdirSync(path.join(repo, 'node_modules', '.bin'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'node_modules', 'keep.txt'), 'keep');
    fs.writeFileSync(path.join(repo, 'node_modules', '.bin', 'oxlint'), STUB, { mode: 0o755 });
    fs.writeFileSync(
      path.join(repo, '.oxlintrc.json'),
      JSON.stringify({ jsPlugins: ['./plugin.mjs'] }),
    );
    fs.writeFileSync(path.join(repo, 'tsconfig.json'), '{}');
    fs.mkdirSync(path.join(fixtures, 'src'), { recursive: true });
    fs.writeFileSync(path.join(fixtures, 'src', 'a.ts'), 'console.log(1);\n');
    process.env.STUB_CWD_FILE = cwdFile;
    errors.length = 0;
  });
  afterEach(() => {
    delete process.env.STUB_MODE;
    delete process.env.STUB_CWD_FILE;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('match returns 0 and cleans up; plugin path is made absolute', async () => {
    process.env.STUB_MODE = 'ok';
    writeExpected({ numberOfRules: 3, diagnostics: [OK_KEY] });
    assert.equal(await run(), 0);
    workDirGone();
    const rc = JSON.parse(fs.readFileSync(cwdFile + '.rc', 'utf8'));
    assert.deepEqual(rc.jsPlugins, [path.join(repo, 'plugin.mjs')]);
  });
  test('missing diagnostic returns 1', async () => {
    process.env.STUB_MODE = 'ok';
    writeExpected({ numberOfRules: 3, diagnostics: [OK_KEY, 'src/a.ts:2 error x'] });
    assert.equal(await run(), 1);
    assert.ok(errors.some(e => e.includes('missing:    src/a.ts:2 error x')));
    workDirGone();
  });
  test('severity change returns 1', async () => {
    process.env.STUB_MODE = 'ok';
    writeExpected({ numberOfRules: 3, diagnostics: ['src/a.ts:1 error eslint(no-console)'] });
    assert.equal(await run(), 1);
    assert.ok(errors.some(e => e.includes(`unexpected: ${OK_KEY}`)));
  });
  test('rule count change returns 1', async () => {
    process.env.STUB_MODE = 'ok';
    writeExpected({ numberOfRules: 4, diagnostics: [OK_KEY] });
    assert.equal(await run(), 1);
    assert.ok(errors.some(e => e.includes('rule count: expected 4, got 3')));
  });
  for (const [mode, pattern] of [
    ['crash', /oxlint exited 2: boom/],
    ['nojson', /did not print JSON/],
    ['nofiles', /linted no files/],
  ]) {
    test(`${mode} throws and cleans up`, async () => {
      process.env.STUB_MODE = mode;
      writeExpected({ numberOfRules: 3, diagnostics: [OK_KEY] });
      await assert.rejects(() => run(), pattern);
      workDirGone();
    });
  }
  test('invalid or empty expected.json throws and cleans up', async () => {
    process.env.STUB_MODE = 'ok';
    for (const bad of [
      { numberOfRules: 3, diagnostics: [] },
      { diagnostics: [OK_KEY] },
      [OK_KEY],
    ]) {
      writeExpected(bad);
      await assert.rejects(() => run(), /expected \{"numberOfRules"/);
      workDirGone();
    }
  });
  test('--update writes diagnostics and rule count', async () => {
    process.env.STUB_MODE = 'ok';
    assert.equal(await run({ update: true }), 0);
    assert.deepEqual(readExpected(expected), { numberOfRules: 3, diagnostics: [OK_KEY] });
    workDirGone();
  });
  test('--update refuses an empty result', async () => {
    process.env.STUB_MODE = 'none';
    assert.equal(await run({ update: true }), 1);
    assert.equal(fs.existsSync(expected), false);
    workDirGone();
  });
  test('missing oxlint binary returns 2 without creating a work dir', async () => {
    fs.rmSync(path.join(repo, 'node_modules', '.bin', 'oxlint'));
    assert.equal(await run(), 2);
    assert.ok(errors.some(e => e.includes('pnpm install')));
    assert.equal(fs.existsSync(cwdFile), false);
  });
  test('a second run uses a fresh work dir', async () => {
    process.env.STUB_MODE = 'ok';
    writeExpected({ numberOfRules: 3, diagnostics: [OK_KEY] });
    assert.equal(await run(), 0);
    const first = fs.readFileSync(cwdFile, 'utf8');
    assert.equal(await run(), 0);
    assert.notEqual(fs.readFileSync(cwdFile, 'utf8'), first);
  });
  for (const [sig, code] of [
    ['SIGTERM', 143],
    ['SIGHUP', 129],
    ['SIGINT', 130],
  ]) {
    test(`${sig} during a run exits ${code} and cleans up`, async () => {
      process.env.STUB_MODE = 'slow';
      writeExpected({ numberOfRules: 3, diagnostics: [OK_KEY] });
      const script = `import(${JSON.stringify(SELFTEST_URL)}).then((m) => { m.main(${JSON.stringify({ repo, fixtures, expected })}).then((c) => { process.exitCode = c; }); });`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
        stdio: 'ignore',
        env: process.env,
      });
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(cwdFile)) {
        assert.ok(Date.now() < deadline, 'stub never started');
        await new Promise(r => setTimeout(r, 20));
      }
      child.kill(sig);
      const exitCode = await new Promise(r => child.on('exit', c => r(c)));
      assert.equal(exitCode, code);
      workDirGone();
    });
  }
});
