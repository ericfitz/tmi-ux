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
import { OAuthProvider } from '../../../environments/environment.interface';
import { LocalOAuthProviderService } from './local-oauth-provider.service';

/**
 * Provider information for UI display
 */
export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
}

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
  private readonly tokenStorageKey = 'auth_token';
  private readonly profileStorageKey = 'user_profile';

  private get oauthProviders(): OAuthProvider[] {
    return environment.oauth?.providers || [];
  }

  private get availableProviders(): ProviderInfo[] {
    const providers: ProviderInfo[] = this.oauthProviders.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon
    }));
    
    // Only show Local provider if:
    // 1. We're in development environment, OR
    // 2. We're in production but no other OAuth providers are configured
    const shouldShowLocal = environment.oauth?.local?.enabled !== false && (
      !environment.production || // Development environment
      providers.length === 0     // Production but no other providers
    );
    
    if (shouldShowLocal) {
      providers.push({
        id: 'local',
        name: 'Local Development',
        icon: environment.oauth?.local?.icon || 'fa-solid fa-laptop-code'
      });
    }
    
    return providers;
  }

  private get defaultProvider(): string {
    return environment.defaultAuthProvider || 
           (this.availableProviders.find(p => p.id === 'local') ? 'local' : 
            this.availableProviders[0]?.id || 'local');
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private logger: LoggerService,
    private localProvider: LocalOAuthProviderService,
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
   * Get available authentication providers with icon information
   */
  getAvailableProviders(): ProviderInfo[] {
    return this.availableProviders;
  }

  /**
   * Initiate login with specified provider (or default if none specified)
   */
  initiateLogin(providerId?: string): void {
    const selectedProvider = providerId || this.defaultProvider;
    
    if (selectedProvider === 'local') {
      this.initiateLocalLogin();
      return;
    }

    const provider = this.oauthProviders.find(p => p.id === selectedProvider);
    if (!provider) {
      this.handleAuthError({
        code: 'provider_not_found',
        message: `Provider ${selectedProvider} is not configured`,
        retryable: false
      });
      return;
    }

    this.initiateOAuthLogin(provider);
  }

  /**
   * Generic OAuth login initiation
   */
  private initiateOAuthLogin(provider: OAuthProvider): void {
    try {
      this.logger.info(`Initiating OAuth login with ${provider.name}`);

      const state = this.generateRandomState();
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_provider', provider.id);

      const authUrl = this.buildAuthUrl(provider, state);
      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'oauth_init_error',
        message: `Failed to initialize ${provider.name} OAuth flow`,
        retryable: true
      });
      this.logger.error(`Error initializing ${provider.name} OAuth`, error);
    }
  }

  /**
   * Initiate local provider login
   */
  private initiateLocalLogin(): void {
    try {
      this.logger.info('Initiating local provider login');

      const state = this.generateRandomState();
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_provider', 'local');

      const authUrl = this.localProvider.buildAuthUrl(state);
      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'local_auth_error',
        message: 'Failed to initialize local authentication',
        retryable: true
      });
      this.logger.error('Error initializing local authentication', error);
    }
  }

  /**
   * Build generic OAuth authorization URL
   * @param provider OAuth provider configuration
   * @param state Random state for CSRF protection
   * @returns The authorization URL
   */
  private buildAuthUrl(provider: OAuthProvider, state: string): string {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
      ...provider.additionalParams
    });

    return `${provider.authUrl}?${params.toString()}`;
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
   * Handle OAuth callback - now completely generic
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

    const providerId = localStorage.getItem('oauth_provider');
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_provider');

    // Handle local provider
    if (providerId === 'local') {
      return this.handleLocalCallback(response);
    }

    // Handle all other providers generically via TMI server
    return this.exchangeCodeForToken(response.code, providerId).pipe(
      map(token => {
        this.storeToken(token);
        const userProfile = this.extractUserProfileFromToken(token);
        this.storeUserProfile(userProfile);

        this.isAuthenticatedSubject.next(true);
        this.userProfileSubject.next(userProfile);

        this.logger.info(`User ${userProfile.email} successfully logged in via ${providerId}`);
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
   * Handle local OAuth callback
   */
  private handleLocalCallback(response: OAuthResponse): Observable<boolean> {
    const userInfo = this.localProvider.exchangeCodeForUser(response.code);
    if (!userInfo) {
      this.handleAuthError({
        code: 'local_auth_error',
        message: 'Failed to authenticate with local provider',
        retryable: true
      });
      return of(false);
    }

    // Create a local JWT-like token
    const token = this.createLocalToken(userInfo);
    this.storeToken(token);
    this.storeUserProfile(userInfo);

    this.isAuthenticatedSubject.next(true);
    this.userProfileSubject.next(userInfo);

    this.logger.info(`Local user ${userInfo.email} successfully logged in`);
    void this.router.navigate(['/tm']);
    return of(true);
  }

  /**
   * Exchange authorization code for JWT token via TMI server
   * @param code Authorization code from OAuth provider
   * @param providerId ID of the OAuth provider used
   * @returns Observable with JWT token
   */
  private exchangeCodeForToken(code: string, providerId: string | null): Observable<JwtToken> {
    this.logger.debug(`Exchanging authorization code for token via ${providerId}`);

    return this.http.post<{ token: string; expires_in: number }>(
      `${environment.apiUrl}/auth/token`, 
      {
        code,
        provider: providerId,
        redirect_uri: this.getRedirectUri(providerId)
      }
    ).pipe(
      map(response => {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

        return {
          token: response.token,
          expiresIn: response.expires_in,
          expiresAt
        };
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Token exchange error', error);
        return throwError(() => new Error('Failed to exchange code for token'));
      })
    );
  }

  /**
   * Get redirect URI for specified provider
   */
  private getRedirectUri(providerId: string | null): string {
    const provider = this.oauthProviders.find(p => p.id === providerId);
    return provider?.redirectUri || `${window.location.origin}/auth/callback`;
  }

  /**
   * Create a local JWT-like token for development use
   */
  private createLocalToken(userInfo: UserProfile): JwtToken {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: userInfo.email,
      name: userInfo.name,
      email: userInfo.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (environment.authTokenExpiryMinutes * 60),
      provider: 'local'
    };

    // Create a fake JWT (just for consistency, server not involved)
    const fakeJwt = btoa(JSON.stringify(header)) + '.' + 
                   btoa(JSON.stringify(payload)) + '.' + 
                   'local-signature';

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + environment.authTokenExpiryMinutes);

    return {
      token: fakeJwt,
      expiresIn: environment.authTokenExpiryMinutes * 60,
      expiresAt
    };
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

    // Clear authentication data immediately for test users or when server is unavailable
    if (this.isTestUser) {
      this.logger.debug('Skipping server logout for test user');
      this.clearAuthData();
      this.logger.info('Test user logged out successfully');
      void this.router.navigate(['/']);
      return;
    }

    // Call logout endpoint if authenticated (only for real users)
    if (this.isAuthenticated) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, {})
        .pipe(
          catchError((error: HttpErrorResponse) => {
            // Log the error but don't fail the logout process
            if (error.status === 0 || error.name === 'HttpErrorResponse') {
              this.logger.warn('Server unavailable during logout - proceeding with client-side logout');
            } else {
              this.logger.error('Error during logout', error);
            }
            return of(null);
          }),
        )
        .subscribe({
          next: () => {
            this.logger.debug('Server logout request completed');
          },
          error: () => {
            // This should not happen due to catchError, but handle it just in case
            this.logger.warn('Unexpected error in logout subscription');
          },
          complete: () => {
            // Clear authentication data after server request completes (or fails)
            this.clearAuthData();
            this.logger.info('User logged out successfully');
            void this.router.navigate(['/']);
          },
        });
    } else {
      // Not authenticated, just clear any remaining data and redirect
      this.clearAuthData();
      this.logger.info('User logged out successfully');
      void this.router.navigate(['/']);
    }
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
