import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  throwError,
} from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import { environment } from '../../../environments/environment';
import { AuthError, JwtToken, OAuthResponse, UserProfile, UserRole } from '../models/auth.models';

/**
 * Service for handling authentication with the TMI server
 * Manages OAuth flow, JWT tokens, and user profiles
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Private subjects
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private jwtTokenSubject = new BehaviorSubject<JwtToken | null>(null);
  private authErrorSubject = new BehaviorSubject<AuthError | null>(null);

  // Public observables
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  userProfile$ = this.userProfileSubject.asObservable();
  authError$ = this.authErrorSubject.asObservable();

  // Backward compatibility for existing components
  username$ = this.userProfileSubject.pipe(map(profile => profile?.name || ''));

  // OAuth configuration
  private readonly googleOAuthConfig = environment.oauth?.google;
  private readonly tokenStorageKey = 'auth_token';
  private readonly profileStorageKey = 'user_profile';

  constructor(
    private router: Router,
    private http: HttpClient,
    private logger: LoggerService,
  ) {
    this.logger.info('Auth Service initialized');
    // Initialize from localStorage on service creation
    this.checkAuthStatus();
  }

  /**
   * Get authentication status
   * @returns True if the user is authenticated
   */
  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Get current user profile
   * @returns The current user profile or null if not authenticated
   */
  get userProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }

  /**
   * Get current username
   * @returns The current username or empty string if not authenticated
   */
  get username(): string {
    return this.userProfile?.name || '';
  }

  /**
   * Get current user email
   * @returns The current user email or empty string if not authenticated
   */
  get userEmail(): string {
    return this.userProfile?.email || '';
  }

  /**
   * Check if the current user is a test user
   * Test users are identified by their email patterns (user1@example.com, user2@example.com, etc.)
   * @returns True if the current user is a test user
   */
  get isTestUser(): boolean {
    const email = this.userEmail;
    return /^user[1-3]@example\.com$/.test(email) || email === 'demo.user@example.com';
  }

  /**
   * Check if the current JWT token is valid and not expired
   * @returns True if the token is valid and not expired
   */
  private isTokenValid(): boolean {
    const token = this.getStoredToken();
    if (!token) {
      return false;
    }

    // Check if token is expired
    const now = new Date();
    return token.expiresAt > now;
  }

  /**
   * Check auth status from local storage
   * Loads JWT token and user profile if available
   */
  checkAuthStatus(): void {
    try {
      // Check if token is valid
      const isAuthenticated = this.isTokenValid();
      this.logger.logInit('isAuthenticated', isAuthenticated, 'AuthService.checkAuthStatus');
      this.isAuthenticatedSubject.next(isAuthenticated);

      // Load user profile if authenticated
      if (isAuthenticated) {
        const storedProfile = localStorage.getItem(this.profileStorageKey);
        if (storedProfile) {
          const userProfile = JSON.parse(storedProfile) as UserProfile;
          this.logger.logInit('userProfile', userProfile, 'AuthService.checkAuthStatus');
          this.userProfileSubject.next(userProfile);
        }
      } else {
        this.userProfileSubject.next(null);
      }

      this.logger.debug(
        `Auth status checked: authenticated=${isAuthenticated}, user=${this.userEmail}`,
      );
    } catch (error) {
      this.logger.error('Error checking auth status', error);
      this.clearAuthData();
    }
  }

  /**
   * Initialize Google OAuth login flow
   * Redirects to Google OAuth authorization URL
   */
  loginWithGoogle(): void {
    if (!this.googleOAuthConfig) {
      this.handleAuthError({
        code: 'config_error',
        message: 'Google OAuth configuration is missing',
        retryable: false,
      });
      return;
    }

    try {
      this.logger.info('Initiating Google OAuth login flow');

      // Generate a random state for CSRF protection
      const state = this.generateRandomState();
      localStorage.setItem('oauth_state', state);

      // Build the authorization URL
      const authUrl = this.buildGoogleAuthUrl(state);

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'oauth_init_error',
        message: 'Failed to initialize OAuth flow',
        retryable: true,
      });
      this.logger.error('Error initializing Google OAuth', error);
    }
  }

  /**
   * Build the Google OAuth authorization URL
   * @param state Random state for CSRF protection
   * @returns The authorization URL
   */
  private buildGoogleAuthUrl(state: string): string {
    if (!this.googleOAuthConfig) {
      throw new Error('Google OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      client_id: this.googleOAuthConfig.clientId,
      redirect_uri: this.googleOAuthConfig.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Generate a random state string for CSRF protection
   * @returns Random state string
   */
  private generateRandomState(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Handle OAuth callback from Google
   * @param response OAuth response containing code and state
   * @returns Observable that resolves to true if authentication is successful
   */
  handleOAuthCallback(response: OAuthResponse): Observable<boolean> {
    this.logger.info('Handling OAuth callback');

    // Verify state parameter to prevent CSRF attacks
    const storedState = localStorage.getItem('oauth_state');
    if (!storedState || storedState !== response.state) {
      this.handleAuthError({
        code: 'invalid_state',
        message: 'Invalid state parameter, possible CSRF attack',
        retryable: false,
      });
      return of(false);
    }

    // Clear the stored state
    localStorage.removeItem('oauth_state');

    // Exchange the authorization code for a token
    return this.exchangeCodeForToken(response.code).pipe(
      map(token => {
        // Store the token
        this.storeToken(token);

        // Get user profile from token
        const userProfile = this.extractUserProfileFromToken(token);
        this.storeUserProfile(userProfile);

        // Update authentication state
        this.isAuthenticatedSubject.next(true);
        this.userProfileSubject.next(userProfile);

        this.logger.info(`User ${userProfile.email} successfully logged in`);
        void this.router.navigate(['/tm']);

        return true;
      }),
      catchError(error => {
        this.handleAuthError({
          code: 'token_exchange_error',
          message: 'Failed to exchange authorization code for token',
          retryable: true,
        });
        this.logger.error('Error exchanging code for token', error);
        return of(false);
      }),
    );
  }

  /**
   * Exchange authorization code for JWT token
   * @param code Authorization code from OAuth provider
   * @returns Observable with JWT token
   */
  private exchangeCodeForToken(code: string): Observable<JwtToken> {
    this.logger.debug('Exchanging authorization code for token');

    return this.http
      .post<{ token: string; expires_in: number }>(`${environment.apiUrl}/auth/token`, {
        code,
        redirect_uri: this.googleOAuthConfig?.redirectUri,
      })
      .pipe(
        map(response => {
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

          return {
            token: response.token,
            expiresIn: response.expires_in,
            expiresAt,
          };
        }),
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Token exchange error', error);
          return throwError(() => new Error('Failed to exchange code for token'));
        }),
      );
  }

  /**
   * Extract user profile from JWT token
   * @param token JWT token
   * @returns User profile
   */
  private extractUserProfileFromToken(token: JwtToken): UserProfile {
    // In a real implementation, we would decode the JWT token
    // For now, we'll extract a mock profile
    try {
      // Get the payload part of the JWT (second part)
      const payload = token.token.split('.')[1];
      // Base64 decode and parse as JSON
      const decodedPayload = JSON.parse(atob(payload)) as {
        email: string;
        name: string;
        picture?: string;
      };

      return {
        email: decodedPayload.email,
        name: decodedPayload.name,
        picture: decodedPayload.picture,
      };
    } catch (error) {
      this.logger.error('Error extracting user profile from token', error);
      throw new Error('Failed to extract user profile from token');
    }
  }

  /**
   * Store JWT token in local storage
   * @param token JWT token
   */
  private storeToken(token: JwtToken): void {
    this.logger.debug('Storing JWT token');
    localStorage.setItem(this.tokenStorageKey, JSON.stringify(token));
    this.jwtTokenSubject.next(token);
  }

  /**
   * Get stored JWT token from local storage
   * @returns JWT token or null if not found
   */
  getStoredToken(): JwtToken | null {
    try {
      const tokenJson = localStorage.getItem(this.tokenStorageKey);
      if (!tokenJson) {
        return null;
      }

      const token = JSON.parse(tokenJson) as JwtToken;
      // Convert expiresAt string back to Date object
      if (typeof token.expiresAt === 'string') {
        token.expiresAt = new Date(token.expiresAt);
      }

      return token;
    } catch (error) {
      this.logger.error('Error retrieving stored token', error);
      return null;
    }
  }

  /**
   * Store user profile in local storage
   * @param profile User profile
   */
  private storeUserProfile(profile: UserProfile): void {
    this.logger.debug('Storing user profile');
    localStorage.setItem(this.profileStorageKey, JSON.stringify(profile));
  }

  /**
   * Check if user has a specific role
   * @param role Role to check
   * @returns True if user has the role
   */
  hasRole(_role: UserRole): boolean {
    // This is a placeholder. In a real implementation, we would check the user's roles
    // For now, we'll assume all authenticated users have all roles
    return this.isAuthenticated;
  }

  /**
   * Handle authentication errors
   * @param error Authentication error
   */
  handleAuthError(error: AuthError): void {
    this.logger.error(`Auth error: ${error.code} - ${error.message}`);
    this.authErrorSubject.next(error);
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.profileStorageKey);
    this.isAuthenticatedSubject.next(false);
    this.userProfileSubject.next(null);
    this.jwtTokenSubject.next(null);
  }

  /**
   * Logout the current user
   * Clears all authentication data and redirects to home page
   */
  logout(): void {
    const userEmail = this.userEmail;
    this.logger.info(`Logging out user: ${userEmail}`);

    // Call logout endpoint if authenticated
    if (this.isAuthenticated) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, {})
        .pipe(
          catchError(error => {
            this.logger.error('Error during logout', error);
            return of(null);
          }),
        )
        .subscribe(() => {
          this.logger.debug('Logout request completed');
        });
    }

    // Clear authentication data
    this.clearAuthData();

    this.logger.info('User logged out successfully');
    void this.router.navigate(['/']);
  }

  /**
   * Legacy method for demo login
   * @param email Email to use for demo login
   * @deprecated Use loginWithGoogle instead
   */
  demoLogin(email: string = 'demo.user@example.com'): void {
    // Only show deprecation warning in production builds
    if (environment.production) {
      this.logger.warn('Using deprecated demoLogin method');
    }

    // Create a mock token
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const token: JwtToken = {
      token: 'mock.jwt.token',
      expiresIn: 3600,
      expiresAt,
    };

    // Create a mock user profile
    const userProfile: UserProfile = {
      email,
      name: email.split('@')[0],
    };

    // Store token and profile
    this.storeToken(token);
    this.storeUserProfile(userProfile);

    // Update authentication state
    this.isAuthenticatedSubject.next(true);
    this.userProfileSubject.next(userProfile);

    this.logger.info(`Demo user ${email} logged in`);
    void this.router.navigate(['/tm']);
  }

  /**
   * Silently extend the session for test users
   * Creates a new token with extended expiration time
   * @returns Observable that resolves to true if session was extended successfully
   */
  extendTestUserSession(): Observable<boolean> {
    if (!this.isTestUser) {
      this.logger.warn('Attempted to extend session for non-test user');
      return of(false);
    }

    try {
      const currentProfile = this.userProfile;
      if (!currentProfile) {
        this.logger.error('No user profile found for session extension');
        return of(false);
      }

      // Create a new token with extended expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Extend by 1 hour

      const extendedToken: JwtToken = {
        token: 'mock.jwt.token.extended',
        expiresIn: 3600,
        expiresAt,
      };

      // Store the extended token
      this.storeToken(extendedToken);

      this.logger.info(`Session extended for test user: ${currentProfile.email}`);
      return of(true);
    } catch (error) {
      this.logger.error('Error extending test user session', error);
      return of(false);
    }
  }
}
