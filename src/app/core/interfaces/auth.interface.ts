
/**
 * JWT token structure
 */
export interface IJwtToken {
  token: string;
  refreshToken?: string;
}

/**
 * User profile information
 */
export interface IUserProfile {
  id: string;
  email: string;
  name: string;
}

/**
 * Interface for authentication service used by core services
 * This interface prevents core services from directly importing feature modules
 */
export interface IAuthService {
  /**
   * Get the current user's profile
   */
  readonly userProfile: IUserProfile | null;

  /**
   * Get the current user's email
   */
  readonly userEmail: string;

  /**
   * Get the stored JWT token
   */
  getStoredToken(): IJwtToken | null;

  /**
   * Log out the current user
   */
  logout(): void;
}