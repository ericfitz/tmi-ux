import { Principal, User, Group } from '@app/pages/tm/models/threat-model.model';

/**
 * Gets the display name for a principal in the format "Name (email)" or just "Name" if email is missing
 * @param principal The principal (User or Group) to get display name for
 * @returns Formatted display name
 */
export function getPrincipalDisplayName(principal: Principal | User | Group): string {
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
export function getCompositeKey(principal: Principal | User | Group): string {
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
export function principalsEqual(
  p1: Principal | User | Group | null | undefined,
  p2: Principal | User | Group | null | undefined,
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
export function isPrincipalUser(principal: Principal): principal is User {
  return principal.principal_type === 'user';
}

/**
 * Type guard to check if a principal is a Group
 * @param principal The principal to check
 * @returns True if principal is a Group
 */
export function isPrincipalGroup(principal: Principal): principal is Group {
  return principal.principal_type === 'group';
}
