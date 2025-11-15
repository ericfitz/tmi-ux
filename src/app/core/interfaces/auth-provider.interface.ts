/**
 * Auth Provider Interface
 *
 * Minimal interface for auth-related functionality needed by core services.
 * This avoids circular dependencies by defining only what core services need to know.
 *
 * Note: This interface is now empty as local provider support has been removed.
 * It's kept for backward compatibility but may be removed in the future.
 */

export interface IAuthProvider {
  // Interface kept for backward compatibility - may be removed in future versions
}
