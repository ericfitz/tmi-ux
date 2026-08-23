/**
 * Shared principal fixtures for threat-model specs.
 *
 * Both factories are typed against the real domain models, so a change to
 * `User` or `Authorization` breaks the fixture at compile time instead of
 * letting a stale literal drift out of shape (#868). They fill in only the
 * fields the models actually require; pass overrides for anything a test cares
 * about.
 */

import type { Authorization, User } from '../../app/pages/tm/models/threat-model.model';

const DEFAULT_PROVIDER_ID = 'user1';
const DEFAULT_EMAIL = 'user1@example.com';
const DEFAULT_DISPLAY_NAME = 'Test User';

/**
 * Build a `User` fixture.
 *
 * Supplying only `email` also derives `provider_id` and `display_name` from it,
 * which is how the validation specs identify their principals — `createTestUser({
 * email: 'alice@example.com' })` yields provider_id `alice@example.com` and
 * display name `alice`. Pass either field explicitly to override the derivation.
 */
// SEM@0d8ef5842818f1be8b057536bbf346d0ac357fe6: build a user test fixture with email (pure)
export function createTestUser(overrides: Partial<User> = {}): User {
  const email = overrides.email ?? DEFAULT_EMAIL;
  const derived = overrides.email !== undefined;

  return {
    principal_type: 'user',
    provider: 'test',
    provider_id: derived ? email : DEFAULT_PROVIDER_ID,
    email,
    display_name: derived ? email.split('@')[0] : DEFAULT_DISPLAY_NAME,
    ...overrides,
  };
}

/**
 * Build an `Authorization` entry. Defaults to the `owner` role; `email` derives
 * `provider_id` and `display_name` exactly as `createTestUser` does.
 */
// SEM@c79a19c1ad822f1bf5be101c3a38dbd18347ccf0: build an authorization test fixture with email, role, and type (pure)
export function createTestAuthorization(overrides: Partial<Authorization> = {}): Authorization {
  const email = overrides.email ?? DEFAULT_EMAIL;
  const derived = overrides.email !== undefined;

  return {
    principal_type: 'user',
    provider: 'test',
    provider_id: derived ? email : DEFAULT_PROVIDER_ID,
    email,
    display_name: derived ? email.split('@')[0] : DEFAULT_DISPLAY_NAME,
    role: 'owner',
    ...overrides,
  };
}
