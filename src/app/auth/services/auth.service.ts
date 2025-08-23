/**
 * Authentication Service
 *
 * This service handles all authentication-related functionality for the TMI application.
 * It manages OAuth flows, JWT token storage, user profiles, and session management.
 *
 * Key functionality:
 * - Supports multiple OAuth providers (Google, GitHub, etc.) configured via environment
 * - Provides local development authentication for testing
 * - Manages JWT token storage and validation with automatic expiration checking
 * - Handles OAuth callback processing with CSRF protection via state parameter
 * - Provides reactive authentication state through observables
 * - Supports role-based access control (placeholder implementation)
 * - Includes session extension for test users during development
 * - Manages user profile data and provides convenient access methods
 * - Handles authentication errors with retry capabilities
 * - Provides backward compatibility for legacy components
 */

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
import {
  ServerConnectionService,
  ServerConnectionStatus,
} from '../../core/services/server-connection.service';
import { environment } from '../../../environments/environment';
import {
  AuthError,
  JwtToken,
  OAuthResponse,
  UserProfile,
  UserRole,
  OAuthProviderInfo,
  ProvidersResponse,
} from '../models/auth.models';
import { LocalOAuthProviderService } from './local-oauth-provider.service';

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
  provider?: string;
  aud?: string;
  iss?: string;
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
  private readonly providersStorageKey = 'oauth_providers';
  private readonly providersCacheExpiry = 5 * 60 * 1000; // 5 minutes

  // Cached provider information
  private cachedProviders: OAuthProviderInfo[] | null = null;
  private providersCacheTime = 0;

  private get defaultProvider(): string {
    return environment.defaultAuthProvider || 'local';
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private logger: LoggerService,
    private localProvider: LocalOAuthProviderService,
    private serverConnectionService: ServerConnectionService,
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
   * Check if we're using a local login provider
   * @returns True if using local authentication
   */
  private get isUsingLocalProvider(): boolean {
    // Check if token exists and decode to get provider information
    const token = this.getStoredToken();
    if (!token) {
      return false;
    }

    try {
      const payload = token.token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
      return decodedPayload.provider === 'local';
    } catch (error) {
      this.logger.warn('Could not decode token to check provider', error);
      return false;
    }
  }

  /**
   * Check if the current JWT token is valid and not expired
   * @param token Optional token to check, otherwise retrieves from storage
   * @returns True if the token is valid and not expired
   */
  private isTokenValid(token?: JwtToken | null): boolean {
    const tokenToCheck = token || this.getStoredToken();
    if (!tokenToCheck) {
      return false;
    }

    // Check if token is expired
    const now = new Date();
    return tokenToCheck.expiresAt > now;
  }

  /**
   * Check if token needs refreshing (expires within 1 minute)
   * @param token Optional token to check, otherwise retrieves from storage
   * @returns True if token should be refreshed
   */
  private shouldRefreshToken(token?: JwtToken | null): boolean {
    const tokenToCheck = token || this.getStoredToken();
    if (!tokenToCheck || !tokenToCheck.refreshToken) {
      return false;
    }

    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60000); // 1 minute buffer
    return tokenToCheck.expiresAt <= oneMinuteFromNow;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * @returns Observable that resolves to a valid JWT token
   */
  getValidToken(): Observable<JwtToken> {
    this.logger.debugComponent('Auth', 'getValidToken called');
    const token = this.getStoredToken();
    if (!token) {
      this.logger.debugComponent('Auth', 'getValidToken: No token available');
      return throwError(() => new Error('No token available'));
    }

    // Use the retrieved token for validation to avoid multiple storage calls
    const isValid = this.isTokenValid(token);
    const shouldRefresh = this.shouldRefreshToken(token);

    this.logger.debugComponent('Auth', 'Token validation status', {
      isValid,
      shouldRefresh,
      hasRefreshToken: !!token.refreshToken,
    });

    // If token is still valid and doesn't need refresh, return it
    if (isValid && !shouldRefresh) {
      this.logger.debugComponent('Auth', 'getValidToken: Returning valid token');
      return of(token);
    }

    // If token needs refresh and we have a refresh token, refresh it
    if (token.refreshToken) {
      this.logger.debugComponent('Auth', 'getValidToken: Attempting token refresh');
      return this.refreshToken().pipe(
        map(newToken => {
          this.logger.debugComponent('Auth', 'getValidToken: Token refresh successful');
          this.storeToken(newToken);
          return newToken;
        }),
      );
    }

    // Token is expired and no refresh token available
    this.logger.debugComponent('Auth', 'getValidToken: Token expired, no refresh token available');
    this.clearAuthData();
    return throwError(() => new Error('Token expired and no refresh token available'));
  }

  /**
   * Get a valid access token if available, returns null for public endpoints
   * @returns Observable that resolves to a valid JWT token or null if no token is available
   */
  getValidTokenIfAvailable(): Observable<JwtToken | null> {
    const token = this.getStoredToken();
    if (!token) {
      return of(null);
    }

    // If token is still valid and doesn't need refresh, return it
    if (this.isTokenValid() && !this.shouldRefreshToken()) {
      return of(token);
    }

    // If token needs refresh and we have a refresh token, refresh it
    if (token.refreshToken) {
      return this.refreshToken().pipe(
        map(newToken => {
          this.storeToken(newToken);
          return newToken;
        }),
        catchError(() => {
          // If refresh fails, clear auth data and return null instead of error
          this.clearAuthData();
          return of(null);
        }),
      );
    }

    // Token is expired and no refresh token available
    this.clearAuthData();
    return of(null);
  }

  /**
   * Check auth status from local storage
   * Loads JWT token and user profile if available
   */
  checkAuthStatus(): void {
    try {
      // Get token once and use it for validation
      const token = this.getStoredToken();
      const isAuthenticated = this.isTokenValid(token);
      this.logger.debugComponent(
        'Auth',
        `Variable 'isAuthenticated' in AuthService.checkAuthStatus initialized to: ${isAuthenticated}`,
      );
      this.isAuthenticatedSubject.next(isAuthenticated);

      // Load user profile if authenticated
      if (isAuthenticated) {
        const storedProfile = localStorage.getItem(this.profileStorageKey);
        if (storedProfile) {
          const userProfile = JSON.parse(storedProfile) as UserProfile;
          this.logger.debugComponent(
            'Auth',
            `Variable 'userProfile' in AuthService.checkAuthStatus initialized to:`,
            userProfile,
          );
          this.userProfileSubject.next(userProfile);
        }
      } else {
        this.userProfileSubject.next(null);
      }

      this.logger.debugComponent(
        'Auth',
        `Auth status checked: authenticated=${isAuthenticated}, user=${this.userEmail}`,
      );
    } catch (error) {
      this.logger.error('Error checking auth status', error);
      this.clearAuthData();
    }
  }

  /**
   * Get available authentication providers from TMI server
   * Uses caching to avoid repeated API calls
   * Falls back to local provider only when server is not available
   */
  getAvailableProviders(): Observable<OAuthProviderInfo[]> {
    // Check cache first
    const now = Date.now();
    if (this.cachedProviders && now - this.providersCacheTime < this.providersCacheExpiry) {
      return of(this.cachedProviders);
    }

    // Check if we're in local-only mode (no server required)
    if (this.isOnlyLocalProviderEnabled()) {
      this.logger.debugComponent('Auth', 'Local-only mode detected, using local provider only');
      return this.getFallbackProviders();
    }

    // Check server connection status for server-required modes
    const serverStatus = this.serverConnectionService.currentStatus;
    if (serverStatus !== ServerConnectionStatus.CONNECTED) {
      this.logger.debugComponent('Auth', 'Server not connected, using local provider only', {
        serverStatus,
      });
      return this.getFallbackProviders();
    }

    this.logger.debugComponent('Auth', 'Fetching OAuth providers from TMI server');

    return this.http.get<ProvidersResponse>(`${environment.apiUrl}/oauth2/providers`).pipe(
      map(response => {
        // Add local provider if in development or no other providers available
        const providers = [...response.providers];
        const shouldShowLocal =
          environment.oauth?.local?.enabled !== false &&
          (!environment.production || // Development environment
            providers.length === 0); // Production but no other providers

        if (shouldShowLocal) {
          providers.push({
            id: 'local',
            name: 'Local Development',
            icon: environment.oauth?.local?.icon || 'fa-solid fa-laptop-code',
            auth_url: this.localProvider.buildAuthUrl(''),
            redirect_uri: `${window.location.origin}/oauth2/callback`,
            client_id: 'local-development',
          });
        }

        // Cache the results
        this.cachedProviders = providers;
        this.providersCacheTime = now;

        this.logger.debugComponent('Auth', `Fetched ${providers.length} OAuth providers`, {
          providers: providers.map(p => ({ id: p.id, name: p.name })),
        });
        return providers;
      }),
      catchError(error => {
        this.logger.error('Failed to fetch OAuth providers', error);
        return this.getFallbackProviders();
      }),
    );
  }

  /**
   * Check if only the local provider is enabled
   * When in local-only mode, we don't need server connectivity
   */
  private isOnlyLocalProviderEnabled(): boolean {
    return environment.authMode === 'local-only';
  }

  /**
   * Get fallback providers (local provider only) when server is unavailable
   */
  private getFallbackProviders(): Observable<OAuthProviderInfo[]> {
    const fallbackProviders: OAuthProviderInfo[] = [];
    if (environment.oauth?.local?.enabled !== false) {
      fallbackProviders.push({
        id: 'local',
        name: 'Local Development',
        icon: environment.oauth?.local?.icon || 'fa-solid fa-laptop-code',
        auth_url: this.localProvider.buildAuthUrl(''),
        redirect_uri: `${window.location.origin}/oauth2/callback`,
        client_id: 'local-development',
      });
    }

    // Cache the results
    this.cachedProviders = fallbackProviders;
    this.providersCacheTime = Date.now();

    this.logger.debugComponent('Auth', `Using fallback providers: ${fallbackProviders.length}`, {
      providers: fallbackProviders.map(p => ({ id: p.id, name: p.name })),
    });

    return of(fallbackProviders);
  }

  /**
   * Initiate login with specified provider (or default if none specified)
   * Now uses TMI OAuth proxy pattern
   */
  initiateLogin(providerId?: string): void {
    this.getAvailableProviders().subscribe({
      next: providers => {
        const selectedProviderId = providerId || this.defaultProvider;
        const provider = providers.find(p => p.id === selectedProviderId);

        if (!provider) {
          this.handleAuthError({
            code: 'provider_not_found',
            message: `Provider ${selectedProviderId} is not configured`,
            retryable: false,
          });
          return;
        }

        if (selectedProviderId === 'local') {
          this.initiateLocalLogin();
        } else {
          this.initiateTMIOAuthLogin(provider);
        }
      },
      error: error => {
        this.handleAuthError({
          code: 'provider_discovery_error',
          message: 'Failed to discover OAuth providers',
          retryable: true,
        });
        this.logger.error('Error discovering OAuth providers', error);
      },
    });
  }

  /**
   * Initiate TMI OAuth proxy login
   */
  private initiateTMIOAuthLogin(provider: OAuthProviderInfo): void {
    try {
      this.logger.info(`Initiating TMI OAuth login with ${provider.name}`);
      this.logger.debugComponent('Auth', `Redirecting to TMI OAuth endpoint`, {
        providerId: provider.id,
        authUrl: provider.auth_url.replace(/\?.*$/, ''), // Remove query params for logging
        redirectUri: provider.redirect_uri,
      });

      const state = this.generateRandomState();
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_provider', provider.id);

      // Use TMI's OAuth proxy endpoint with state and client callback URL
      const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
      const separator = provider.auth_url.includes('?') ? '&' : '?';
      const authUrl = `${provider.auth_url}${separator}state=${state}&client_callback=${encodeURIComponent(clientCallbackUrl)}`;

      this.logger.debugComponent('Auth', 'Initiating OAuth with client callback', {
        providerId: provider.id,
        generatedState: state,
        stateLength: state.length,
        stateInUrl: state, // Log the exact state being sent in URL
        clientCallbackUrl,
        finalAuthUrl: authUrl.replace(/\?.*$/, ''), // Log without query params for security
      });

      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'oauth_init_error',
        message: `Failed to initialize ${provider.name} OAuth flow`,
        retryable: true,
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

      this.logger.debugComponent('Auth', 'Initiating local OAuth', {
        providerId: 'local',
        generatedState: state,
      });

      const authUrl = this.localProvider.buildAuthUrl(state);
      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'local_auth_error',
        message: 'Failed to initialize local authentication',
        retryable: true,
      });
      this.logger.error('Error initializing local authentication', error);
    }
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
   * Check if a string appears to be Base64 encoded
   * @param str String to check
   * @returns True if string appears to be Base64 encoded
   */
  private isBase64(str: string): boolean {
    if (!str || str.length === 0) {
      return false;
    }

    // Base64 strings should only contain A-Z, a-z, 0-9, +, /, and = for padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

    // Check if it matches Base64 pattern and length is multiple of 4
    return base64Regex.test(str) && str.length % 4 === 0 && str.length > 16;
  }

  /**
   * Handle OAuth callback from TMI OAuth proxy
   * TMI now handles all OAuth complexity and returns tokens directly
   * @param response OAuth response containing tokens or error
   * @returns Observable that resolves to true if authentication is successful
   */
  handleOAuthCallback(response: OAuthResponse): Observable<boolean> {
    this.logger.info('Handling OAuth callback from TMI proxy');
    this.logger.debugComponent('Auth', 'Processing OAuth callback', {
      hasAccessToken: !!response.access_token,
      hasError: !!response.error,
      state: response.state ? 'present' : 'missing',
    });

    // Handle OAuth errors first
    if (response.error) {
      this.handleOAuthError(response.error, response.error_description);
      return of(false);
    }

    // Verify state parameter to prevent CSRF attacks (if present)
    if (response.state) {
      const storedState = localStorage.getItem('oauth_state');
      const providerId = localStorage.getItem('oauth_provider');
      const receivedState = response.state;

      this.logger.debugComponent('Auth', 'State parameter validation starting', {
        receivedState: response.state,
        storedState: storedState,
        providerId: providerId,
        hasAccessToken: !!response.access_token,
      });

      // For local provider, enforce strict state validation
      if (providerId === 'local') {
        if (!storedState || storedState !== receivedState) {
          this.logger.error(
            `Local provider state mismatch: received "${receivedState}", stored "${storedState}"`,
          );
          this.handleAuthError({
            code: 'invalid_state',
            message: 'Invalid state parameter for local authentication',
            retryable: false,
          });
          return of(false);
        }
      }
      // For TMI OAuth proxy flows, be more flexible due to server-side state management
      else if (response.access_token) {
        // If we have an access token, this is a TMI OAuth proxy response
        // The TMI server manages OAuth security, so we can be more lenient with state validation
        this.logger.debugComponent(
          'Auth',
          'TMI OAuth proxy detected - using flexible state validation',
          {
            receivedState: response.state,
            storedState: storedState,
            reason: 'TMI server manages OAuth security and may transform state parameters',
          },
        );

        // Try to decode Base64 state if present, but don't fail if it doesn't match
        if (this.isBase64(receivedState)) {
          try {
            const decodedState = atob(receivedState);
            this.logger.debugComponent('Auth', 'Decoded Base64 state from TMI server', {
              originalState: response.state,
              decodedState: decodedState,
              decodedAsHex: Array.from(decodedState)
                .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join(''),
              storedState: storedState,
            });
          } catch (error) {
            this.logger.warn('Failed to decode TMI Base64 state parameter', error);
          }
        }

        // For TMI OAuth proxy with access tokens, we trust the server's state management
        // The security is provided by the TMI server's OAuth implementation
        this.logger.debugComponent(
          'Auth',
          'Accepting TMI OAuth proxy state (server manages security)',
          {
            receivedState: response.state,
            storedState: storedState,
          },
        );
      }
      // For other flows without access tokens, enforce strict validation
      else {
        if (!storedState || storedState !== receivedState) {
          this.logger.error(
            `State parameter mismatch for ${providerId || 'unknown'} provider: received "${receivedState}", stored "${storedState}"`,
          );
          this.handleAuthError({
            code: 'invalid_state',
            message: 'Invalid state parameter, possible CSRF attack',
            retryable: false,
          });
          return of(false);
        }
      }
    }

    const providerId = localStorage.getItem('oauth_provider');
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_provider');

    // Handle local provider
    if (providerId === 'local' && response.code) {
      return this.handleLocalCallback(response);
    }

    // Handle TMI OAuth proxy response with tokens
    if (response.access_token) {
      return this.handleTMITokenResponse(response, providerId);
    }

    // If we have a code but no access_token, this might be an old-style callback
    if (response.code) {
      this.logger.warn(
        'Received authorization code instead of access token - this may indicate server misconfiguration',
      );
      this.handleAuthError({
        code: 'unexpected_callback_format',
        message: 'Received authorization code instead of access token from TMI server',
        retryable: true,
      });
      return of(false);
    }

    // No tokens or code received
    this.handleAuthError({
      code: 'invalid_callback',
      message: 'No valid authentication data received in callback',
      retryable: true,
    });
    return of(false);
  }

  /**
   * Handle local OAuth callback
   */
  private handleLocalCallback(response: OAuthResponse): Observable<boolean> {
    const userInfo = this.localProvider.exchangeCodeForUser(response.code!);
    if (!userInfo) {
      this.handleAuthError({
        code: 'local_auth_error',
        message: 'Failed to authenticate with local provider',
        retryable: true,
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
   * Handle TMI OAuth proxy token response
   * TMI has already exchanged the code and returns tokens directly
   */
  private handleTMITokenResponse(
    response: OAuthResponse,
    providerId: string | null,
  ): Observable<boolean> {
    try {
      this.logger.debugComponent('Auth', 'Processing TMI token response', {
        providerId,
        expiresIn: response.expires_in,
        hasRefreshToken: !!response.refresh_token,
        accessTokenLength: response.access_token?.length,
        accessTokenPrefix: response.access_token?.substring(0, 30) + '...',
        refreshTokenLength: response.refresh_token?.length,
        refreshTokenPrefix: response.refresh_token?.substring(0, 20) + '...',
      });

      // Validate the access token format
      if (!response.access_token) {
        this.logger.error('No access token in TMI response');
        throw new Error('No access token provided');
      }

      const tokenParts = response.access_token.split('.');
      if (tokenParts.length !== 3) {
        this.logger.error('Invalid JWT token format', {
          tokenParts: tokenParts.length,
          token: response.access_token.substring(0, 50) + '...',
        });
        throw new Error('Invalid JWT token format');
      }

      // Create JWT token object
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (response.expires_in || 3600));

      const token: JwtToken = {
        token: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in || 3600,
        expiresAt,
      };

      // Check if the created token is valid
      const now = new Date();
      const isTokenValid = token.expiresAt > now;

      this.logger.debugComponent('Auth', 'Created JWT token object', {
        expiresAt: token.expiresAt.toISOString(),
        expiresIn: token.expiresIn,
        isValid: isTokenValid,
        currentTime: now.toISOString(),
      });

      // Store token and extract user profile
      this.storeToken(token);
      const userProfile = this.extractUserProfileFromToken(token);
      this.storeUserProfile(userProfile);

      // Update authentication state
      this.isAuthenticatedSubject.next(true);
      this.userProfileSubject.next(userProfile);

      // Verify token was stored correctly
      const storedToken = this.getStoredToken();
      this.logger.debugComponent('Auth', 'Token storage verification', {
        tokenWasStored: !!storedToken,
        storedTokenLength: storedToken?.token?.length,
        storedTokenMatches: storedToken?.token === token.token,
      });

      this.logger.info(`User ${userProfile.email} successfully logged in via ${providerId}`);
      void this.router.navigate(['/tm']);
      return of(true);
    } catch (error) {
      this.logger.error('Error processing TMI token response', error);
      this.handleAuthError({
        code: 'token_processing_error',
        message: 'Failed to process authentication tokens',
        retryable: true,
      });
      return of(false);
    }
  }

  /**
   * Handle OAuth errors from callback
   */
  private handleOAuthError(error: string, errorDescription?: string): void {
    const errorMap: { [key: string]: string } = {
      access_denied: 'User cancelled authorization',
      invalid_request: 'Invalid OAuth request',
      unauthorized_client: 'Client not authorized',
      unsupported_response_type: 'OAuth configuration error',
      invalid_scope: 'Invalid permissions requested',
      server_error: 'OAuth provider error',
      temporarily_unavailable: 'OAuth provider temporarily unavailable',
    };

    const userMessage = errorMap[error] || 'Authentication failed';

    this.handleAuthError({
      code: error,
      message: errorDescription || userMessage,
      retryable: error !== 'access_denied',
    });
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
      exp: Math.floor(Date.now() / 1000) + environment.authTokenExpiryMinutes * 60,
      provider: 'local',
    };

    // Create a fake JWT (just for consistency, server not involved)
    const fakeJwt =
      btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload)) + '.' + 'local-signature';

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + environment.authTokenExpiryMinutes);

    return {
      token: fakeJwt,
      expiresIn: environment.authTokenExpiryMinutes * 60,
      expiresAt,
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
    this.logger.debugComponent('Auth', 'Storing JWT token', {
      tokenLength: token.token?.length,
      tokenPrefix: token.token?.substring(0, 20) + '...',
      expiresAt: token.expiresAt.toISOString(),
      expiresIn: token.expiresIn,
      hasRefreshToken: !!token.refreshToken,
      refreshTokenLength: token.refreshToken?.length,
    });

    try {
      // Parse the JWT payload to log token contents (without signature)
      const payload = token.token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
      this.logger.debugComponent('Auth', 'JWT token payload', {
        sub: decodedPayload.sub,
        email: decodedPayload.email,
        name: decodedPayload.name,
        iat: decodedPayload.iat,
        exp: decodedPayload.exp,
        provider: decodedPayload.provider,
        aud: decodedPayload.aud,
        iss: decodedPayload.iss,
      });
    } catch (error) {
      this.logger.warn('Could not decode JWT payload for logging', error);
    }

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
        this.logger.debugComponent('Auth', 'No token found in localStorage');
        return null;
      }

      const token = JSON.parse(tokenJson) as JwtToken;
      // Convert expiresAt string back to Date object
      if (typeof token.expiresAt === 'string') {
        token.expiresAt = new Date(token.expiresAt);
      }

      const now = new Date();
      const isExpired = token.expiresAt <= now;
      const minutesUntilExpiry = Math.floor((token.expiresAt.getTime() - now.getTime()) / 60000);

      // Only log token details if expires soon or there's an issue
      if (isExpired || minutesUntilExpiry < 5) {
        this.logger.debugComponent('Auth', 'Retrieved stored token', {
          tokenLength: token.token?.length,
          expiresAt: token.expiresAt.toISOString(),
          isExpired,
          minutesUntilExpiry,
          hasRefreshToken: !!token.refreshToken,
        });
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
    this.logger.debugComponent('Auth', 'Storing user profile');
    localStorage.setItem(this.profileStorageKey, JSON.stringify(profile));
  }

  /**
   * Check if user has a specific role
   * @param role Role to check
   * @returns True if user has the role
   */
  hasRole(_role: UserRole): boolean {
    // TODO: use access checking here
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
   * Refresh an expired access token using the refresh token
   * Uses TMI's refresh endpoint
   * @returns Observable that resolves to a new JWT token
   */
  refreshToken(): Observable<JwtToken> {
    this.logger.debugComponent('Auth', 'Refreshing access token via TMI server');

    const currentToken = this.getStoredToken();
    if (!currentToken?.refreshToken) {
      this.logger.debugComponent('Auth', 'No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    this.logger.debugComponent('Auth', 'Sending refresh token request', {
      hasRefreshToken: !!currentToken.refreshToken,
      refreshTokenLength: currentToken.refreshToken?.length,
      refreshTokenPrefix: currentToken.refreshToken?.substring(0, 20) + '...',
      tokenExpiry: currentToken.expiresAt.toISOString(),
    });

    return this.http
      .post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
      }>(`${environment.apiUrl}/oauth2/refresh`, {
        refresh_token: currentToken.refreshToken,
      })
      .pipe(
        map(response => {
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

          const newToken = {
            token: response.access_token,
            refreshToken: response.refresh_token,
            expiresIn: response.expires_in,
            expiresAt,
          };

          this.logger.debugComponent('Auth', 'Token refresh successful', {
            newExpiry: newToken.expiresAt.toISOString(),
            hasNewRefreshToken: !!newToken.refreshToken,
          });

          return newToken;
        }),
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Token refresh failed', error);
          this.logger.debugComponent('Auth', 'Token refresh failed, clearing auth data', {
            status: error.status,
            message: error.message,
          });
          // If refresh fails, clear auth data and redirect to login
          this.clearAuthData();
          return throwError(() => new Error('Token refresh failed - please login again'));
        }),
      );
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

    // Determine if we should call server logout endpoint
    const isConnectedToServer =
      this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
    const isUsingLocalAuth = this.isUsingLocalProvider;
    const shouldCallServerLogout =
      this.isAuthenticated && isConnectedToServer && !isUsingLocalAuth && !this.isTestUser;

    if (shouldCallServerLogout) {
      this.logger.debugComponent('Auth', 'Calling server logout endpoint', {
        isConnectedToServer,
        isUsingLocalAuth,
        isTestUser: this.isTestUser,
      });

      const token = this.getStoredToken();
      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if we have a token
      if (token?.token) {
        headers['Authorization'] = `Bearer ${token.token}`;
      }

      this.http
        .post(`${environment.apiUrl}/oauth2/revoke`, {}, { headers })
        .pipe(
          catchError((error: HttpErrorResponse) => {
            // Log the error but don't fail the logout process
            if (error.status === 0 || error.name === 'HttpErrorResponse') {
              this.logger.warn(
                'Server unavailable during logout - proceeding with client-side logout',
              );
            } else {
              this.logger.error('Error during logout', error);
            }
            return of(null);
          }),
        )
        .subscribe({
          next: () => {
            this.logger.debugComponent('Auth', 'Server logout request completed');
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
      // Skip server logout and just clear client-side data
      this.logger.debugComponent('Auth', 'Skipping server logout', {
        isConnectedToServer,
        isUsingLocalAuth,
        isTestUser: this.isTestUser,
        isAuthenticated: this.isAuthenticated,
      });

      this.clearAuthData();
      this.logger.info('User logged out successfully (client-side only)');
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
