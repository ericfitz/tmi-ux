import { Principal, User, Group } from '@app/pages/tm/models/threat-model.model';

/**
 * Gets the display name for a principal in the format "Name (email)" or just "Name" if email is missing
 * @param principal The principal (User or Group) to get display name for
 * @returns Formatted display name
 */
// SEM@17ea5e2433175c5b660d4a31535e1749d0305f70: format a principal's display name as 'Name (email)' or 'Name' (pure)
export function getPrincipalDisplayName(principal: Principal): string {
  if (!principal) {
    return '';
  }

  const name = principal.display_name || '';
  const email = principal.email;

  // If email is missing, null, undefined, or empty string, just return name
  if (!email || email.trim() === '') {
    return name;
  }

  // Return "Name (email)" format
  return `${name} (${email})`;
}

/**
 * Gets a composite key for unique identification of a principal
 * Format: "provider:provider_id"
 * @param principal The principal to get composite key for
 * @returns Composite key string
 */
// SEM@17ea5e2433175c5b660d4a31535e1749d0305f70: build a unique composite key for a principal as 'provider:provider_id' (pure)
export function getCompositeKey(principal: Principal): string {
  if (!principal) {
    return '';
  }
  return `${principal.provider}:${principal.provider_id}`;
}

/**
 * Checks if two principals are equal based on provider and provider_id
 * @param p1 First principal
 * @param p2 Second principal
 * @returns True if principals match
 */
// SEM@17ea5e2433175c5b660d4a31535e1749d0305f70: compare two principals for equality by provider and provider_id (pure)
export function principalsEqual(
  p1: Principal | null | undefined,
  p2: Principal | null | undefined,
): boolean {
  if (!p1 || !p2) {
    return false;
  }
  return p1.provider === p2.provider && p1.provider_id === p2.provider_id;
}

/**
 * Type guard to check if a principal is a User
 * @param principal The principal to check
 * @returns True if principal is a User
 */
// SEM@13ad524189c94573aeee64a7185463714eeb6821: type guard: validate that a principal is a User (pure)
export function isPrincipalUser(principal: Principal): principal is User {
  return principal.principal_type === 'user';
}

/**
 * Type guard to check if a principal is a Group
 * @param principal The principal to check
 * @returns True if principal is a Group
 */
// SEM@13ad524189c94573aeee64a7185463714eeb6821: type guard: validate that a principal is a Group (pure)
export function isPrincipalGroup(principal: Principal): principal is Group {
  return principal.principal_type === 'group';
}
