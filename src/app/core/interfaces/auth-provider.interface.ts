/**
 * Auth Provider Interface
 *
 * Minimal interface for auth-related functionality needed by core services.
 * This avoids circular dependencies by defining only what core services need to know.
 */

export interface IAuthProvider {
  /**
   * Check if the user is authenticated with the local provider
   * @returns True if using local authentication, false otherwise
   */
  readonly isUsingLocalProvider: boolean;
}
