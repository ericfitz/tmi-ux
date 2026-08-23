#!/usr/bin/env node

/**
 * Removes `E2E `-prefixed residue left in a dev database by E2E runs.
 *
 * Every spec's cleanup is `try { … } catch { /* best effort *\/ }`, so any test that
 * fails before its cleanup block leaks — and deliberate negative-control runs leak by
 * design. The leak is structural, not a bug to be fixed once. It matters because the
 * dashboard paginates: once enough leaked threat models accumulate, the seeded
 * `Seed TM - Full Fields` slides off page one and unrelated specs begin failing with a
 * signature that points nowhere near the cause. A local database once reached 78 leaked
 * threat models against 3 real ones.
 *
 * Deletes through the API rather than SQL. Sixteen tables have a `NO ACTION` foreign key
 * to `threat_models`, so a naive `DELETE FROM threat_models` rolls back on the `assets`
 * FK, and `survey_responses` should have its links nulled rather than be deleted — the
 * API already sequences all of that correctly. (`threat_models` also soft-deletes, so a
 * row lingers with a `deleted_at` timestamp; any SQL verification must filter
 * `where deleted_at is null`.)
 *
 * Authenticates each user headlessly through the OAuth stub's flow API, so this needs
 * neither a browser nor the app dev server — it still works after a run has died hard,
 * or while Playwright holds port 4200.
 *
 * Usage:
 *   pnpm run e2e:clean
 *   pnpm run e2e:clean -- --dry-run
 *   pnpm run e2e:clean -- --prefix "E2E " --users test-user,test-reviewer
 */

const DEFAULTS = {
  apiUrl: process.env['E2E_API_URL'] || 'http://localhost:30080',
  stubUrl: process.env['E2E_OAUTH_STUB_URL'] || 'http://localhost:8079',
  idp: process.env['E2E_OAUTH_PROVIDER'] || 'tmi',
  prefix: 'E2E ',
  users: ['test-user', 'test-reviewer', 'test-admin', 'test-outsider'],
  adminUser: 'test-admin',
};

/**
 * Entity types an E2E run can leave behind, each with the collection key its list
 * response nests results under.
 *
 * `owner` scope is listed once per user, because a DELETE only succeeds for the owner and
 * leaked rows spread across whichever role created them. `admin` scope is listed once, as
 * the admin user.
 */
const ENTITIES = [
  { label: 'threat models', path: 'threat_models', collection: 'threat_models', scope: 'owner' },
  { label: 'projects', path: 'projects', collection: 'projects', scope: 'owner' },
  { label: 'teams', path: 'teams', collection: 'teams', scope: 'owner' },
  {
    label: 'surveys',
    path: 'admin/surveys',
    collection: 'surveys',
    scope: 'admin',
    // Deleting a survey that has responses is a 409. The responses carry no name of
    // their own and belong to whoever submitted them, so they are found by survey id
    // and cleared as each user before the survey itself is deleted.
    dependent: {
      label: 'survey responses',
      path: 'intake/survey_responses',
      collection: 'survey_responses',
      parentField: 'survey_id',
    },
  },
  {
    label: 'groups',
    path: 'admin/groups',
    collection: 'groups',
    scope: 'admin',
    idField: 'internal_uuid',
    paginated: false,
  },
];

/** The list endpoints cap `limit` at 100 — a larger value is a 400, not a clamp. */
const PAGE_SIZE = 100;

/** How long to wait for one OAuth stub flow to yield tokens. */
const FLOW_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { ...DEFAULTS, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) {
        fail(`${arg} requires a value`);
      }
      return next;
    };

    switch (arg) {
      // pnpm forwards its own `--` separator through to the script
      case '--':
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--api-url':
        options.apiUrl = value();
        break;
      case '--oauth-stub-url':
        options.stubUrl = value();
        break;
      case '--idp':
        options.idp = value();
        break;
      case '--prefix':
        options.prefix = value();
        break;
      case '--users':
        options.users = value()
          .split(',')
          .map(u => u.trim())
          .filter(Boolean);
        break;
      case '--admin-user':
        options.adminUser = value();
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }

  if (options.prefix.trim() === '') {
    fail('--prefix must not be empty: it is the only thing protecting seeded fixtures');
  }

  return options;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: pnpm run e2e:clean [-- <options>]',
      '',
      'Options:',
      '  --dry-run               Report what would be deleted, delete nothing',
      `  --prefix <text>         Name prefix to match (default: ${JSON.stringify(DEFAULTS.prefix)})`,
      `  --users <a,b,c>         Owners to authenticate as (default: ${DEFAULTS.users.join(',')})`,
      `  --admin-user <user>     User for admin-scoped entities (default: ${DEFAULTS.adminUser})`,
      `  --api-url <url>         TMI API (default: ${DEFAULTS.apiUrl}, or $E2E_API_URL)`,
      `  --oauth-stub-url <url>  OAuth stub (default: ${DEFAULTS.stubUrl})`,
      `  --idp <provider>        Identity provider (default: ${DEFAULTS.idp})`,
      '',
    ].join('\n'),
  );
}

function fail(message) {
  process.stderr.write(`e2e:clean: ${message}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Obtains an access token for a user through the OAuth stub's automated flow, the same
 * path the seed tooling uses. No browser involved.
 */
async function getAccessToken(user, { stubUrl, apiUrl, idp }) {
  let started;
  try {
    started = await fetchJson(`${stubUrl}/flows/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: user, idp, tmi_server: apiUrl }),
    });
  } catch (error) {
    throw new Error(
      `could not start an OAuth flow at ${stubUrl} — is the stub running? ` +
        `(start it from the tmi repo with \`make start-oauth-stub\`): ${describe(error)}`,
    );
  }

  const flowId = started['flow_id'];
  if (!flowId) {
    throw new Error(`OAuth stub returned no flow_id: ${JSON.stringify(started)}`);
  }

  // The stub's flow routinely sits in `initialized` for well over ten seconds before the
  // tokens appear, so poll generously — too short a budget returns an empty token and the
  // failure then shows up as a confusing "Authentication required" from the API instead.
  const deadline = Date.now() + FLOW_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await fetchJson(`${stubUrl}/flows/${flowId}`);

    if (status['tokens_ready'] === true) {
      const token = status['tokens']?.['access_token'];
      if (!token) {
        throw new Error(`OAuth flow completed without an access token for ${user}`);
      }
      return token;
    }

    if (status['status'] === 'error' || status['status'] === 'failed') {
      throw new Error(`OAuth flow failed for ${user}: ${status['error'] ?? 'unknown error'}`);
    }

    await sleep(500);
  }

  throw new Error(`OAuth flow for ${user} did not complete within ${FLOW_TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${url} -> ${response.status} ${text.trim()}`);
  }

  return text.trim() === '' ? {} : JSON.parse(text);
}

/**
 * Lists every entity of one type, paging until the collection is exhausted. Some admin
 * collections return the whole set with no limit/offset envelope, hence `paginated`.
 */
async function listAll(entity, token, { apiUrl }) {
  if (entity.paginated === false) {
    const page = await fetchJson(`${apiUrl}/${entity.path}`, authHeaders(token));
    return page[entity.collection] ?? [];
  }

  const items = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchJson(
      `${apiUrl}/${entity.path}?limit=${PAGE_SIZE}&offset=${offset}`,
      authHeaders(token),
    );
    const batch = page[entity.collection] ?? [];
    items.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return items;
    }
  }
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function deleteEntity(entity, id, token, { apiUrl }) {
  const response = await fetch(`${apiUrl}/${entity.path}/${id}`, {
    method: 'DELETE',
    ...authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`DELETE ${entity.path}/${id} -> ${response.status} ${await response.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Deletes everything belonging to one parent entity, as every user in turn, because the
 * dependent rows are owned by whoever created them rather than by the parent's owner.
 * Returns the count removed and any failures, so a parent that cannot be cleared reports
 * the underlying reason rather than only the parent's eventual 409.
 */
async function clearDependents(dependent, parentId, tokens, caches, options) {
  let cleared = 0;
  const failures = [];

  for (const [user, token] of tokens) {
    const cacheKey = `${dependent.path}:${user}`;

    if (!caches.has(cacheKey)) {
      try {
        caches.set(cacheKey, await listAll(dependent, token, options));
      } catch {
        // This user cannot see the parent's dependents; another may.
        caches.set(cacheKey, []);
      }
    }

    // Filtered here rather than by query parameter on purpose. The API declares a
    // `survey_id` filter, but the server ignores it — a nonexistent id returns every
    // response the caller owns. Trusting it would delete responses belonging to seeded
    // surveys along with the E2E ones.
    const items = caches.get(cacheKey).filter(item => item[dependent.parentField] === parentId);

    for (const item of items) {
      if (options.dryRun) {
        cleared++;
        continue;
      }

      try {
        await deleteEntity(dependent, item.id, token, options);
        cleared++;
      } catch (error) {
        failures.push(`${dependent.label} of ${parentId} as ${user} — ${describe(error)}`);
      }
    }
  }

  return { cleared, failures };
}

/**
 * Deletes every entity of one type whose name carries the prefix, as one user.
 * Returns what happened so the caller can report and decide the exit code.
 */
async function cleanEntity(entity, user, tokens, caches, options) {
  const token = tokens.get(user);
  const idField = entity.idField ?? 'id';
  let all;

  try {
    all = await listAll(entity, token, options);
  } catch (error) {
    // A user without the rights to list a collection has nothing to clean there. Say so
    // rather than failing the run — but never stay silent, because silent cleanup is how
    // the leak went unnoticed long enough to break unrelated specs.
    return { skipped: describe(error), deleted: 0, failures: [] };
  }

  const matches = all.filter(
    item => typeof item.name === 'string' && item.name.startsWith(options.prefix),
  );
  const failures = [];
  let deleted = 0;
  let dependents = 0;

  for (const item of matches) {
    if (entity.dependent) {
      const result = await clearDependents(
        entity.dependent,
        item[idField],
        tokens,
        caches,
        options,
      );
      dependents += result.cleared;
      failures.push(...result.failures);
    }

    if (options.dryRun) {
      deleted++;
      continue;
    }

    try {
      await deleteEntity(entity, item[idField], token, options);
      deleted++;
    } catch (error) {
      failures.push(`${entity.label}: "${item.name}" as ${user} — ${describe(error)}`);
    }
  }

  return { skipped: null, deleted, dependents, failures, names: matches.map(m => m.name) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const verb = options.dryRun ? 'Would delete' : 'Deleted';

  process.stdout.write(
    `\n=== e2e:clean ${options.dryRun ? '(dry run) ' : ''}===\n` +
      `API:    ${options.apiUrl}\n` +
      `Prefix: ${JSON.stringify(options.prefix)}\n\n`,
  );

  // Sequentially, deliberately: one flow takes upwards of fifteen seconds, but starting
  // them concurrently makes the stub time out reading from the server rather than
  // finishing any faster.
  const needed = [...new Set([...options.users, options.adminUser])];
  process.stdout.write(`Authenticating ${needed.length} users (~15s each)...\n`);

  const tokens = new Map();
  for (const user of needed) {
    tokens.set(user, await getAccessToken(user, options));
  }

  const failures = [];
  const caches = new Map();
  let total = 0;

  for (const entity of ENTITIES) {
    const users = entity.scope === 'admin' ? [options.adminUser] : options.users;

    for (const user of users) {
      const result = await cleanEntity(entity, user, tokens, caches, options);

      if (result.skipped) {
        process.stdout.write(`  ${entity.label} as ${user}: skipped — ${result.skipped}\n`);
        continue;
      }

      failures.push(...result.failures);
      total += result.deleted + (result.dependents ?? 0);

      if (result.deleted > 0 || result.failures.length > 0) {
        process.stdout.write(
          `  ${entity.label} as ${user}: ${verb.toLowerCase()} ${result.deleted}` +
            `${result.dependents ? ` (+${result.dependents} ${entity.dependent.label})` : ''}` +
            `${result.failures.length ? `, ${result.failures.length} failed` : ''}\n`,
        );
        for (const name of result.names ?? []) {
          process.stdout.write(`      ${name}\n`);
        }
      }
    }
  }

  process.stdout.write(`\n${verb} ${total} entities.\n`);

  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} deletion(s) failed:\n`);
    for (const failure of failures) {
      process.stderr.write(`  ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write('No failures.\n\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  process.stderr.write(`\ne2e:clean failed: ${describe(error)}\n\n`);
  process.exit(1);
});
