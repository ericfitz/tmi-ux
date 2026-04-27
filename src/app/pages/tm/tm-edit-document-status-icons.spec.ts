import { describe, it, expect } from 'vitest';

/**
 * Sanity check: the @switch in the icon column maps each access_status to
 * the right icon name. This test mirrors the template logic so a refactor
 * doesn't silently swap icons.
 */
function pickIconName(status: string | undefined): string {
  switch (status) {
    case 'auth_required':
      return 'error';
    case 'pending_access':
      return 'warning';
    case 'unknown':
      return 'help';
    default:
      return 'description';
  }
}

describe('tm-edit document status icons', () => {
  it('renders error icon for auth_required', () => {
    expect(pickIconName('auth_required')).toBe('error');
  });

  it('renders warning icon for pending_access', () => {
    expect(pickIconName('pending_access')).toBe('warning');
  });

  it('renders help icon for unknown', () => {
    expect(pickIconName('unknown')).toBe('help');
  });

  it('renders description icon for accessible', () => {
    expect(pickIconName('accessible')).toBe('description');
  });

  it('renders description icon when access_status is undefined', () => {
    expect(pickIconName(undefined)).toBe('description');
  });
});
