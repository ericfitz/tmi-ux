/**
 * Authentication Service
 *
 * This service handles all authentication-related functionality for the TMI application.
 * It manages OAuth flows, JWT token storage, user profiles, and session management.
 *
 * Key functionality:
 * - Supports multiple OAuth providers (Google, GitHub, etc.) configured via TMI server
 * - Manages JWT token storage and validation with automatic expiration checking
 * - Handles OAuth callback processing with CSRF protection via state parameter
 * - Provides reactive authentication state through observables
 * - Supports role-based access control (placeholder implementation)
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
  from,
  map,
  of,
  throwError,
  tap,
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
  UserMeResponse,
  UserRole,
  OAuthProviderInfo,
  ProvidersResponse,
  SAMLProviderInfo,
  SAMLProvidersResponse,
} from '../models/auth.models';
import { PkceService } from './pkce.service';
import { PkceError } from '../models/pkce.models';

interface JwtPayload {
  sub?: string; // Provider-assigned user ID (maps to provider_id)
  email?: string;
  name?: string; // Display name (maps to display_name)
  iat?: number;
  exp?: number;
  idp?: string; // OAuth provider (e.g., "google", "github")
  aud?: string;
  iss?: string;
  groups?: string[];
  providers?: Array<{
    provider: string;
    is_primary: boolean;
  }>;
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
  username$ = this.userProfileSubject.pipe(map(profile => profile?.display_name || ''));

  // OAuth configuration
  private readonly tokenStorageKey = 'auth_token';
  private readonly profileStorageKey = 'user_profile';
  private readonly providersCacheExpiry = 5 * 60 * 1000; // 5 minutes

  // Cached provider information
  private cachedOAuthProviders: OAuthProviderInfo[] | null = null;
  private cachedSAMLProviders: SAMLProviderInfo[] | null = null;
  private providersCacheTime = 0;

  private get defaultProvider(): string {
    return environment.defaultAuthProvider || 'google';
  }

  // SessionManager instance (injected via forwardRef to avoid circular dependency)
  private sessionManagerService: {
    onTokenRefreshed: () => void;
    stopExpiryTimers: () => void;
  } | null = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
    private pkceService: PkceService,
  ) {
    // this.logger.info('Auth Service initialized');
    // Initialize from localStorage on service creation
    void this.checkAuthStatus();
  }

  /**
   * Set the session manager service (called by SessionManagerService to avoid circular dependency)
   * @param sessionManager SessionManagerService instance
   */
  setSessionManager(sessionManager: {
    onTokenRefreshed: () => void;
    stopExpiryTimers: () => void;
  }): void {
    this.sessionManagerService = sessionManager;
    // this.logger.debugComponent('Auth', 'SessionManager service registered');
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
    return this.userProfile?.display_name || '';
  }

  /**
   * Get current user email
   * @returns The current user email or empty string if not authenticated
   */
  get userEmail(): string {
    return this.userProfile?.email || '';
  }

  /**
   * Get current user's provider ID
   * @returns The provider-assigned user ID or empty string if not authenticated
   */
  get providerId(): string {
    return this.userProfile?.provider_id || '';
  }

  /**
   * Get current user's OAuth provider (IDP) from JWT token
   * @returns The OAuth provider (e.g., "google", "github") or empty string if not available
   */
  get userIdp(): string {
    const token = this.getStoredToken();
    if (!token) {
      return '';
    }

    try {
      const payload = token.token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
      return decodedPayload.idp || '';
    } catch (error) {
      this.logger.error('Error extracting IDP from JWT token', error);
      return '';
    }
  }

  /**
   * Get current user groups from JWT token
   * @returns Array of group names the user belongs to, or empty array if not available
   */
  get userGroups(): string[] {
    const token = this.getStoredToken();
    if (!token) {
      return [];
    }

    try {
      const payload = token.token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
      return decodedPayload.groups || [];
    } catch (error) {
      this.logger.warn('Could not decode token to get groups', error);
      return [];
    }
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
   * Check if token needs refreshing (expires within 15 minutes)
   * @param token Optional token to check, otherwise retrieves from storage
   * @returns True if token should be refreshed
   */
  private shouldRefreshToken(token?: JwtToken | null): boolean {
    const tokenToCheck = token || this.getStoredToken();
    if (!tokenToCheck || !tokenToCheck.refreshToken) {
      return false;
    }

    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000); // 15 minute buffer
    return tokenToCheck.expiresAt <= fifteenMinutesFromNow;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * @returns Observable that resolves to a valid JWT token
   */
  getValidToken(): Observable<JwtToken> {
    // this.logger.debugComponent('Auth', 'getValidToken called');
    const token = this.getStoredToken();
    if (!token) {
      // this.logger.debugComponent('Auth', 'getValidToken: No token available');
      return throwError(() => new Error('No token available'));
    }

    // Use the retrieved token for validation to avoid multiple storage calls
    const isValid = this.isTokenValid(token);
    const shouldRefresh = this.shouldRefreshToken(token);

    // this.logger.debugComponent('Auth', 'Token validation status', {
    //   isValid,
    //   shouldRefresh,
    //   hasRefreshToken: !!token.refreshToken,
    // });

    // If token is still valid and doesn't need refresh, return it
    if (isValid && !shouldRefresh) {
      // this.logger.debugComponent('Auth', 'getValidToken: Returning valid token');
      return of(token);
    }

    // If token needs refresh and we have a refresh token, refresh it
    if (token.refreshToken) {
      // this.logger.debugComponent('Auth', 'getValidToken: Attempting token refresh');
      return this.refreshToken().pipe(
        map(newToken => {
          // this.logger.debugComponent('Auth', 'getValidToken: Token refresh successful');
          this.storeToken(newToken);
          return newToken;
        }),
      );
    }

    // Token is expired and no refresh token available
    // this.logger.debugComponent('Auth', 'getValidToken: Token expired, no refresh token available');
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
  async checkAuthStatus(): Promise<void> {
    try {
      // Try to get token from cache first (fast path)
      let token = this.jwtTokenSubject.value;

      // If no cached token, try to decrypt from storage
      if (!token) {
        token = await this.getStoredTokenDecrypted();
        if (token) {
          this.jwtTokenSubject.next(token);
        }
      }

      const isAuthenticated = this.isTokenValid(token);
      // this.logger.debugComponent(
      //   'Auth',
      //   `Variable 'isAuthenticated' in AuthService.checkAuthStatus initialized to: ${isAuthenticated}`,
      // );
      this.isAuthenticatedSubject.next(isAuthenticated);

      // Load user profile if authenticated
      if (isAuthenticated && token) {
        const userProfile = await this.getStoredUserProfile();
        if (userProfile) {
          // this.logger.debugComponent(
          //   'Auth',
          //   `Variable 'userProfile' in AuthService.checkAuthStatus initialized to:`,
          //   userProfile,
          // );
          this.userProfileSubject.next(userProfile);
        }
      } else {
        this.userProfileSubject.next(null);
      }

      // this.logger.debugComponent(
      //   'Auth',
      //   `Auth status checked: authenticated=${isAuthenticated}, user=${this.userEmail}`,
      // );
    } catch (error) {
      this.logger.error('Error checking auth status', error);
      this.clearAuthData();
    }
  }

  /**
   * Get available OAuth authentication providers from TMI server
   * Uses caching to avoid repeated API calls
   */
  getAvailableProviders(): Observable<OAuthProviderInfo[]> {
    // Check cache first
    const now = Date.now();
    if (this.cachedOAuthProviders && now - this.providersCacheTime < this.providersCacheExpiry) {
      return of(this.cachedOAuthProviders);
    }

    // Check if server is configured
    const isServerConfigured = this.isServerConfigured();

    if (!isServerConfigured) {
      this.logger.error('Server not configured - cannot fetch providers');
      return throwError(() => new Error('Server not configured'));
    }

    // Try to fetch providers from server
    // Don't check connection status here - let the HTTP call succeed or fail naturally
    // this.logger.debugComponent('Auth', 'Fetching OAuth providers from TMI server');

    return this.http.get<ProvidersResponse>(`${environment.apiUrl}/oauth2/providers`).pipe(
      map(response => {
        const providers = [...response.providers];

        // Cache the results
        this.cachedOAuthProviders = providers;
        this.providersCacheTime = now;

        // this.logger.debugComponent(
        //   'Auth',
        //   `Fetched ${providers.length} OAuth providers from server`,
        //   {
        //     providers: providers.map(p => ({ id: p.id, name: p.name })),
        //   },
        // );
        return providers;
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Failed to fetch OAuth providers', error);
        return throwError(() => error as Error);
      }),
    );
  }

  /**
   * Get available SAML authentication providers from TMI server
   * Uses caching to avoid repeated API calls
   */
  getAvailableSAMLProviders(): Observable<SAMLProviderInfo[]> {
    // Check cache first
    const now = Date.now();
    if (this.cachedSAMLProviders && now - this.providersCacheTime < this.providersCacheExpiry) {
      return of(this.cachedSAMLProviders);
    }

    // Check if server is configured
    const isServerConfigured = this.isServerConfigured();

    if (!isServerConfigured) {
      this.logger.error('Server not configured - cannot fetch SAML providers');
      return throwError(() => new Error('Server not configured'));
    }

    // Try to fetch SAML providers from server
    // this.logger.debugComponent('Auth', 'Fetching SAML providers from TMI server');

    return this.http.get<SAMLProvidersResponse>(`${environment.apiUrl}/saml/providers`).pipe(
      map(response => {
        const providers = [...response.providers];

        // Cache the results
        this.cachedSAMLProviders = providers;
        this.providersCacheTime = now;

        // this.logger.debugComponent(
        //   'Auth',
        //   `Fetched ${providers.length} SAML providers from server`,
        //   {
        //     providers: providers.map(p => ({ id: p.id, name: p.name })),
        //   },
        // );
        return providers;
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Failed to fetch SAML providers', error);
        return throwError(() => error as Error);
      }),
    );
  }

  /**
   * Check if server is configured based on environment
   */
  private isServerConfigured(): boolean {
    // Consider server not configured only if apiUrl is empty or whitespace
    // Any explicitly configured URL (including localhost) is considered a configured server
    const apiUrl = environment.apiUrl;
    return !!(apiUrl && apiUrl.trim());
  }

  /**
   * Initiate login with specified provider (or default if none specified)
   * Uses TMI OAuth proxy pattern
   * @param providerId Optional provider ID to use
   * @param returnUrl Optional URL to return to after authentication
   */
  initiateLogin(providerId?: string, returnUrl?: string): void {
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

        // this.logger.info(`Initiating TMI OAuth login for provider: ${selectedProviderId}`, {
        //   returnUrl,
        // });
        void this.initiateTMIOAuthLogin(provider, returnUrl);
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
   * Initiate SAML login with specified provider
   * @param providerId Provider ID to use
   * @param returnUrl Optional URL to return to after authentication
   */
  initiateSAMLLogin(providerId: string, returnUrl?: string): void {
    this.getAvailableSAMLProviders().subscribe({
      next: providers => {
        const provider = providers.find(p => p.id === providerId);

        if (!provider) {
          this.handleAuthError({
            code: 'provider_not_found',
            message: `SAML provider ${providerId} is not configured`,
            retryable: false,
          });
          return;
        }

        // this.logger.info(`Initiating SAML login for provider: ${providerId}`, {
        //   returnUrl,
        // });
        this.initiateTMISAMLLogin(provider, returnUrl);
      },
      error: error => {
        this.handleAuthError({
          code: 'provider_discovery_error',
          message: 'Failed to discover SAML providers',
          retryable: true,
        });
        this.logger.error('Error discovering SAML providers', error);
      },
    });
  }

  /**
   * Initiate TMI SAML login
   * @param provider SAML provider information
   * @param returnUrl Optional URL to return to after authentication
   */
  private initiateTMISAMLLogin(provider: SAMLProviderInfo, returnUrl?: string): void {
    try {
      // this.logger.info(`Initiating SAML login with ${provider.name}`);
      // this.logger.debugComponent('Auth', `Redirecting to TMI SAML endpoint`, {
      //   providerId: provider.id,
      //   authUrl: provider.auth_url,
      // });

      // Use TMI's SAML login endpoint with client callback URL
      const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
      const separator = provider.auth_url.includes('?') ? '&' : '?';
      const authUrl = `${provider.auth_url}${separator}client_callback=${encodeURIComponent(clientCallbackUrl)}`;

      // this.logger.debugComponent('Auth', 'Initiating SAML with client callback', {
      //   providerId: provider.id,
      //   clientCallbackUrl,
      //   finalAuthUrl: authUrl.replace(/\?.*$/, ''), // Log without query params for security
      // });

      // Store return URL if provided
      if (returnUrl) {
        sessionStorage.setItem('saml_return_url', returnUrl);
      }

      window.location.href = authUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'saml_init_error',
        message: `Failed to initialize ${provider.name} SAML flow`,
        retryable: true,
      });
      this.logger.error(`Error initializing ${provider.name} SAML`, error);
    }
  }

  /**
   * Initiate TMI OAuth proxy login with PKCE
   * @param provider OAuth provider information
   * @param returnUrl Optional URL to return to after authentication
   */
  private async initiateTMIOAuthLogin(
    provider: OAuthProviderInfo,
    returnUrl?: string,
  ): Promise<void> {
    try {
      // this.logger.info(`Initiating TMI OAuth login with ${provider.name}`);
      // this.logger.debugComponent('Auth', `Redirecting to TMI OAuth endpoint`, {
      //   providerId: provider.id,
      //   authUrl: provider.auth_url.replace(/\?.*$/, ''), // Remove query params for logging
      //   redirectUri: provider.redirect_uri,
      //   returnUrl: returnUrl,
      // });

      // Generate PKCE parameters (code_verifier + code_challenge)
      const pkceParams = await this.pkceService.generatePkceParameters();

      const state = this.generateRandomState(returnUrl);
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_provider', provider.id);

      // Use TMI's OAuth proxy endpoint with state, client callback URL, scope, and PKCE parameters
      const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
      const separator = provider.auth_url.includes('?') ? '&' : '?';
      const scope = encodeURIComponent('openid profile email');
      // State is Base64 which is URL-safe per backend pattern ^[a-zA-Z0-9_~.+/=-]*$
      const authUrl =
        `${provider.auth_url}${separator}` +
        `state=${state}` +
        `&client_callback=${encodeURIComponent(clientCallbackUrl)}` +
        `&scope=${scope}` +
        `&code_challenge=${encodeURIComponent(pkceParams.codeChallenge)}` +
        `&code_challenge_method=${pkceParams.codeChallengeMethod}`;

      // this.logger.debugComponent('Auth', 'Initiating OAuth with PKCE', {
      //   providerId: provider.id,
      //   generatedState: state,
      //   stateLength: state.length,
      //   clientCallbackUrl,
      //   hasPkceChallenge: !!pkceParams.codeChallenge,
      //   challengeLength: pkceParams.codeChallenge.length,
      // });

      window.location.href = authUrl;
    } catch (error) {
      // Handle PKCE generation errors
      if ((error as PkceError).code) {
        const pkceError = error as PkceError;
        this.handleAuthError({
          code: pkceError.code,
          message: pkceError.message,
          retryable: pkceError.retryable,
        });
      } else {
        this.handleAuthError({
          code: 'oauth_init_error',
          message: `Failed to initialize ${provider.name} OAuth flow`,
          retryable: true,
        });
      }
      this.logger.error(`Error initializing ${provider.name} OAuth`, error);
    }
  }

  /**
   * Generate a state string for CSRF protection and return URL preservation
   * @param returnUrl Optional URL to return to after authentication
   * @returns State string (Base64 encoded JSON if returnUrl provided)
   */
  private generateRandomState(returnUrl?: string): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

    if (returnUrl) {
      // Create structured state object with both CSRF token and return URL
      const stateObject = {
        csrf: csrf,
        returnUrl: returnUrl,
      };
      // Base64 encode the JSON object for URL safety using UTF-8 safe encoding
      const stateJson = JSON.stringify(stateObject);
      const encoder = new TextEncoder();
      const data = encoder.encode(stateJson);
      return btoa(String.fromCharCode(...data));
    }

    // If no returnUrl, just return the CSRF token for backward compatibility
    return csrf;
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
   * Decode state parameter and extract CSRF token and return URL
   * @param state State parameter from OAuth callback
   * @returns Object containing csrf token and optional returnUrl
   */
  private decodeState(state: string): { csrf: string; returnUrl?: string } {
    try {
      // Check if state is Base64 encoded (structured state)
      if (this.isBase64(state)) {
        const decoded = JSON.parse(atob(state)) as { csrf: string; returnUrl?: string };
        return {
          csrf: decoded.csrf,
          returnUrl: decoded.returnUrl,
        };
      }
    } catch {
      // this.logger.debugComponent(
      //   'Auth',
      //   'Failed to decode structured state, treating as plain CSRF token',
      //   error,
      // );
    }

    // If not Base64 or decoding failed, treat as plain CSRF token
    return { csrf: state };
  }

  /**
   * Handle OAuth callback from TMI OAuth proxy
   * TMI now handles all OAuth complexity and returns tokens directly
   * @param response OAuth response containing tokens or error
   * @returns Observable that resolves to true if authentication is successful
   */
  handleOAuthCallback(response: OAuthResponse): Observable<boolean> {
    // this.logger.info('Handling OAuth callback from TMI proxy');
    // this.logger.debugComponent('Auth', 'Processing OAuth callback', {
    //   hasAccessToken: !!response.access_token,
    //   hasError: !!response.error,
    //   state: response.state ? 'present' : 'missing',
    // });

    // Handle OAuth errors first
    if (response.error) {
      this.handleOAuthError(response.error, response.error_description);
      return of(false);
    }

    // Variable to store decoded return URL
    let returnUrl: string | undefined;

    // Verify state parameter to prevent CSRF attacks (if present)
    if (response.state) {
      const storedState = localStorage.getItem('oauth_state');
      const providerId = localStorage.getItem('oauth_provider');
      const receivedState = response.state;

      // Decode the state to extract CSRF token and return URL
      const decodedStoredState = storedState ? this.decodeState(storedState) : null;
      const decodedReceivedState = this.decodeState(receivedState);
      returnUrl = decodedReceivedState.returnUrl;

      // this.logger.debugComponent('Auth', 'State parameter validation starting', {
      //   receivedState: response.state,
      //   storedState: storedState,
      //   providerId: providerId,
      //   hasAccessToken: !!response.access_token,
      // });

      // For TMI OAuth proxy flows, be more flexible due to server-side state management
      if (response.access_token) {
        // If we have an access token, this is a TMI OAuth proxy response
        // The TMI server manages OAuth security, so we can be more lenient with state validation
        // this.logger.debugComponent(
        //   'Auth',
        //   'TMI OAuth proxy detected - using flexible state validation',
        //   {
        //     receivedState: response.state,
        //     storedState: storedState,
        //     reason: 'TMI server manages OAuth security and may transform state parameters',
        //   },
        // );
        // Log the decoded state information for TMI OAuth proxy
        // this.logger.debugComponent('Auth', 'TMI OAuth proxy state decoded', {
        //   originalState: response.state,
        //   decodedCsrf: decodedReceivedState.csrf,
        //   returnUrl: returnUrl,
        //   storedCsrf: decodedStoredState?.csrf,
        // });
        // For TMI OAuth proxy with access tokens, we trust the server's state management
        // The security is provided by the TMI server's OAuth implementation
        // this.logger.debugComponent(
        //   'Auth',
        //   'Accepting TMI OAuth proxy state (server manages security)',
        //   {
        //     receivedState: response.state,
        //     storedState: storedState,
        //   },
        // );
      }
      // For other flows without access tokens, enforce strict validation
      else {
        if (!decodedStoredState || decodedStoredState.csrf !== decodedReceivedState.csrf) {
          this.logger.error(
            `State parameter mismatch for ${providerId || 'unknown'} provider: received CSRF "${decodedReceivedState.csrf}", stored CSRF "${decodedStoredState?.csrf}"`,
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

    // Handle TMI OAuth proxy response with tokens
    if (response.access_token) {
      return this.handleTMITokenResponse(response, providerId, returnUrl);
    }

    // If we have a code but no access_token, exchange the code for tokens
    if (response.code) {
      // this.logger.info('Received authorization code - exchanging for tokens');
      return this.exchangeAuthorizationCode(response, providerId, returnUrl);
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
   * Handle TMI OAuth proxy token response
   * TMI has already exchanged the code and returns tokens directly
   * @param response OAuth response containing tokens
   * @param providerId OAuth provider ID
   * @param returnUrl Optional URL to return to after authentication
   */
  private handleTMITokenResponse(
    response: OAuthResponse,
    providerId: string | null,
    returnUrl?: string,
  ): Observable<boolean> {
    try {
      // this.logger.debugComponent('Auth', 'Processing TMI token response', {
      //   providerId,
      //   expiresIn: response.expires_in,
      //   hasRefreshToken: !!response.refresh_token,
      //   accessTokenLength: response.access_token?.length,
      //   accessTokenPrefix: response.access_token?.substring(0, 30) + '...',
      //   refreshTokenLength: response.refresh_token?.length,
      //   refreshTokenPrefix: response.refresh_token?.substring(0, 20) + '...',
      // });

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

      // Extract expiration from JWT exp claim (preferred) or fall back to expires_in
      let expiresAt = this.extractExpirationFromToken(response.access_token);
      let expiresIn = response.expires_in || 3600;

      if (expiresAt) {
        // Calculate expiresIn from exp claim for consistency
        const now = new Date();
        expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        // this.logger.debugComponent('Auth', 'Using exp claim from JWT', {
        //   expClaim: expiresAt.toISOString(),
        //   calculatedExpiresIn: expiresIn,
        //   providedExpiresIn: response.expires_in,
        // });
      } else {
        // Fall back to expires_in from OAuth response
        this.logger.warn('JWT missing exp claim, falling back to expires_in', {
          expiresIn,
        });
        expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      }

      const token: JwtToken = {
        token: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn,
        expiresAt,
      };

      // Check if the created token is valid
      // const now = new Date();
      // const isTokenValid = token.expiresAt > now;

      // this.logger.debugComponent('Auth', 'Created JWT token object', {
      //   expiresAt: token.expiresAt.toISOString(),
      //   expiresIn: token.expiresIn,
      //   isValid: isTokenValid,
      //   currentTime: now.toISOString(),
      // });

      // Store token and extract user profile
      this.storeToken(token);
      const userProfile = this.extractUserProfileFromToken(token);
      void this.storeUserProfile(userProfile);

      // Update authentication state
      this.isAuthenticatedSubject.next(true);
      this.userProfileSubject.next(userProfile);

      // Verify token was stored correctly
      // const storedToken = this.getStoredToken();
      // this.logger.debugComponent('Auth', 'Token storage verification', {
      //   tokenWasStored: !!storedToken,
      //   storedTokenLength: storedToken?.token?.length,
      //   storedTokenMatches: storedToken?.token === token.token,
      // });

      // this.logger.info(`User ${userProfile.email} successfully logged in via ${providerId}`, {
      //   returnUrl,
      // });

      // Fetch admin status from server after login
      // Fire and forget - don't block navigation on this
      this.refreshUserProfile().subscribe();

      // Navigate to return URL if provided, otherwise to default
      // Wait for navigation to complete before emitting success
      const navigationPromise = returnUrl
        ? this.router.navigateByUrl(returnUrl)
        : this.router.navigate(['/dashboard']);

      return from(navigationPromise).pipe(
        map(navigationSuccess => {
          if (!navigationSuccess) {
            this.logger.warn('Navigation after OAuth callback failed', { returnUrl });
          }
          return true; // Still return true as auth succeeded, even if navigation had issues
        }),
        catchError(navError => {
          this.logger.error('Error during post-auth navigation', navError);
          return of(true); // Auth succeeded, navigation error is secondary
        }),
      );
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
   * Exchange authorization code for tokens with PKCE verifier
   * @param response OAuth response containing the authorization code
   * @param providerId OAuth provider ID
   * @param returnUrl Optional URL to return to after authentication
   */
  private exchangeAuthorizationCode(
    response: OAuthResponse,
    providerId: string | null,
    returnUrl?: string,
  ): Observable<boolean> {
    // this.logger.debugComponent('Auth', 'Exchanging authorization code for tokens with PKCE', {
    //   providerId,
    //   hasCode: !!response.code,
    //   hasState: !!response.state,
    //   returnUrl,
    // });

    if (!response.code) {
      this.handleAuthError({
        code: 'missing_authorization_code',
        message: 'No authorization code provided for token exchange',
        retryable: false,
      });
      return of(false);
    }

    // Retrieve PKCE code verifier
    let codeVerifier: string;
    try {
      codeVerifier = this.pkceService.retrieveVerifier();
    } catch (error) {
      const pkceError = error as PkceError;
      this.handleAuthError({
        code: pkceError.code,
        message: pkceError.message,
        retryable: pkceError.retryable,
      });
      return of(false);
    }

    // Prepare the token exchange request with PKCE verifier
    const redirectUri = `${window.location.origin}/oauth2/callback`;
    const exchangeRequest = {
      grant_type: 'authorization_code',
      code: response.code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      ...(response.state && { state: response.state }),
    };

    // Add provider query parameter if we have one
    const queryParams = providerId ? `?idp=${encodeURIComponent(providerId)}` : '';
    const exchangeUrl = `${environment.apiUrl}/oauth2/token${queryParams}`;

    // this.logger.debugComponent('Auth', 'Sending token exchange request', {
    //   exchangeUrl: exchangeUrl.replace(/\?.*$/, ''), // Log without query params
    //   providerId,
    //   redirectUri,
    //   hasCode: !!exchangeRequest.code,
    // });

    return this.http
      .post<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      }>(exchangeUrl, exchangeRequest)
      .pipe(
        map(tokenResponse => {
          // this.logger.debugComponent('Auth', 'Token exchange successful', {
          //   hasAccessToken: !!tokenResponse.access_token,
          //   hasRefreshToken: !!tokenResponse.refresh_token,
          //   expiresIn: tokenResponse.expires_in,
          //   tokenType: tokenResponse.token_type,
          // });

          // Extract expiration from JWT exp claim (preferred) or fall back to expires_in
          let expiresAt = this.extractExpirationFromToken(tokenResponse.access_token);
          let expiresIn = tokenResponse.expires_in || 3600;

          if (expiresAt) {
            // Calculate expiresIn from exp claim for consistency
            const now = new Date();
            expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
            // this.logger.debugComponent('Auth', 'Using exp claim from JWT', {
            //   expClaim: expiresAt.toISOString(),
            //   calculatedExpiresIn: expiresIn,
            //   providedExpiresIn: tokenResponse.expires_in,
            // });
          } else {
            // Fall back to expires_in from OAuth response
            this.logger.warn('JWT missing exp claim, falling back to expires_in', {
              expiresIn,
            });
            expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
          }

          const token: JwtToken = {
            token: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresIn,
            expiresAt,
          };

          // Clear PKCE verifier after successful exchange
          this.pkceService.clearVerifier();

          // Store token and extract user profile
          this.storeToken(token);
          const userProfile = this.extractUserProfileFromToken(token);
          void this.storeUserProfile(userProfile);

          // Update authentication state
          this.isAuthenticatedSubject.next(true);
          this.userProfileSubject.next(userProfile);

          // this.logger.info(
          //   `User ${userProfile.email} successfully logged in via ${providerId} (code exchange)`,
          //   {
          //     returnUrl,
          //   },
          // );

          // Fetch admin status from server after login
          // Fire and forget - don't block navigation on this
          this.refreshUserProfile().subscribe();

          // Navigate to return URL if provided, otherwise to default
          // Note: We can't use from() here because we're inside a map() - just fire and forget
          // The main navigation fix is in handleTMITokenResponse above
          if (returnUrl) {
            void this.router.navigateByUrl(returnUrl);
          } else {
            void this.router.navigate(['/dashboard']);
          }

          return true;
        }),
        catchError((error: HttpErrorResponse) => {
          // Clear PKCE verifier on error
          this.pkceService.clearVerifier();

          this.logger.error('Authorization code exchange failed (PKCE)', error);
          this.handleAuthError({
            code: 'code_exchange_failed',
            message: `Failed to exchange authorization code: ${error.message}`,
            retryable: true,
          });
          return of(false);
        }),
      );
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
   * Extract expiration date from JWT token's exp claim
   * @param token JWT token string
   * @returns Expiration date or null if exp claim is missing/invalid
   */
  private extractExpirationFromToken(token: string): Date | null {
    try {
      const payload = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;

      if (decodedPayload.exp) {
        // exp is in seconds since epoch, convert to milliseconds
        return new Date(decodedPayload.exp * 1000);
      }

      this.logger.warn('JWT token missing exp claim');
      return null;
    } catch (error) {
      this.logger.error('Error extracting expiration from JWT', error);
      return null;
    }
  }

  /**
   * Extract user profile from JWT token
   * @param token JWT token
   * @returns User profile
   */
  private extractUserProfileFromToken(token: JwtToken): UserProfile {
    try {
      // Get the payload part of the JWT (second part)
      const payload = token.token.split('.')[1];
      // Base64 decode and parse as JSON
      const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;

      // Extract provider-specific user ID from 'sub' claim (standard JWT)
      const providerId = decodedPayload.sub;

      if (!providerId || !decodedPayload.email || !decodedPayload.name) {
        throw new Error('Required user profile fields missing from JWT token');
      }

      // Extract provider from idp claim (identity provider)
      const provider = decodedPayload.idp || 'unknown';

      return {
        provider,
        provider_id: providerId,
        display_name: decodedPayload.name,
        email: decodedPayload.email,
        groups: decodedPayload.groups || null,
      };
    } catch (error) {
      this.logger.error('Error extracting user profile from token', error);
      throw new Error('Failed to extract user profile from token');
    }
  }

  /**
   * Fetch current user profile from server and update cached profile with admin status
   * This should be called after login to get the is_admin flag
   * Calls GET /users/me directly to avoid circular dependency
   * @returns Observable that completes when profile is updated
   */
  refreshUserProfile(): Observable<UserProfile> {
    this.logger.info('Fetching current user profile from server');
    return this.http.get<UserMeResponse>(`${environment.apiUrl}/users/me`).pipe(
      map(response => {
        // Transform API response to UserProfile format
        const serverProfile: UserProfile = {
          provider: response.provider,
          provider_id: response.provider_user_id,
          display_name: response.name,
          email: response.email,
          groups: response.groups ?? null,
          is_admin: response.is_admin,
        };

        // Get current JWT-derived profile
        const currentProfile = this.userProfile;

        if (!currentProfile) {
          // No current profile, use server response as-is
          return serverProfile;
        }

        // Validate critical identity fields (must match exactly)
        if (serverProfile.provider !== currentProfile.provider) {
          this.logger.error('Provider mismatch between JWT and server response', {
            jwtProvider: currentProfile.provider,
            serverProvider: serverProfile.provider,
          });
        }

        if (serverProfile.provider_id !== currentProfile.provider_id) {
          this.logger.error('Provider ID mismatch between JWT and server response', {
            jwtProviderId: currentProfile.provider_id,
            serverProviderId: serverProfile.provider_id,
            provider: serverProfile.provider,
          });
        }

        // Merge profiles: use JWT values for identity fields, fill in missing non-identity fields
        const mergedProfile: UserProfile = {
          // Identity fields: always use JWT values (authoritative source)
          provider: currentProfile.provider,
          provider_id: currentProfile.provider_id,

          // Non-identity fields: prefer server values if present, otherwise keep JWT values
          display_name: serverProfile.display_name || currentProfile.display_name,
          email: serverProfile.email || currentProfile.email,
          groups: serverProfile.groups !== null ? serverProfile.groups : currentProfile.groups,

          // Server-only fields
          is_admin: serverProfile.is_admin,
        };

        // Warn about mismatched non-critical fields
        if (
          serverProfile.display_name &&
          serverProfile.display_name !== currentProfile.display_name
        ) {
          this.logger.warn('Display name differs between JWT and server', {
            jwtName: currentProfile.display_name,
            serverName: serverProfile.display_name,
            usingServer: true,
          });
        }

        if (serverProfile.email && serverProfile.email !== currentProfile.email) {
          this.logger.warn('Email differs between JWT and server', {
            jwtEmail: currentProfile.email,
            serverEmail: serverProfile.email,
            usingServer: true,
          });
        }

        return mergedProfile;
      }),
      tap(profile => {
        // Update the cached profile with merged data
        this.userProfileSubject.next(profile);
        void this.storeUserProfile(profile);
        this.logger.info('User profile refreshed with admin status', {
          isAdmin: profile.is_admin,
        });
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Failed to refresh user profile', error);
        // Don't throw - we already have basic profile from JWT
        // Just return the current profile without is_admin
        return of(this.userProfile!);
      }),
    );
  }

  /**
   * Store JWT token in local storage and notify SessionManager
   * @param token JWT token
   */
  storeToken(token: JwtToken): void {
    // this.logger.debugComponent('Auth', 'Storing JWT token', {
    //   tokenLength: token.token?.length,
    //   tokenPrefix: token.token?.substring(0, 20) + '...',
    //   expiresAt: token.expiresAt.toISOString(),
    //   expiresIn: token.expiresIn,
    //   hasRefreshToken: !!token.refreshToken,
    //   refreshTokenLength: token.refreshToken?.length,
    // });

    try {
      // Parse the JWT payload to log token contents (without signature)
      // const payload = token.token.split('.')[1];
      // const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
      // this.logger.debugComponent('Auth', 'JWT token payload', {
      //   sub: decodedPayload.sub,
      //   email: decodedPayload.email,
      //   name: decodedPayload.name,
      //   iat: decodedPayload.iat,
      //   exp: decodedPayload.exp,
      //   provider: decodedPayload.provider,
      //   aud: decodedPayload.aud,
      //   iss: decodedPayload.iss,
      // });
    } catch (error) {
      this.logger.warn('Could not decode JWT payload for logging', error);
    }

    // Store token with encryption - handle errors but don't clear auth immediately
    this.storeTokenEncrypted(token).catch(error => {
      this.logger.error('Token storage encryption failed', error);
      // Don't clear auth data here as it would break the current session
      // The token is still in memory (jwtTokenSubject) and can be used
      // Future page refreshes will fail to restore auth state, which is the desired behavior
      this.handleAuthError({
        code: 'token_encryption_failed',
        message: 'Failed to securely store authentication token',
        retryable: false,
      });
    });
    this.jwtTokenSubject.next(token);

    // Notify SessionManager of new token
    if (this.sessionManagerService) {
      this.sessionManagerService.onTokenRefreshed();
    }
  }

  /**
   * Get stored JWT token from local storage
   * @returns JWT token or null if not found
   */
  getStoredToken(): JwtToken | null {
    // First try to get from memory cache (set by jwtTokenSubject)
    const cachedToken = this.jwtTokenSubject.value;
    if (cachedToken) {
      return cachedToken;
    }

    // If not in cache, try to decrypt from storage synchronously via a promise workaround
    try {
      // This is a temporary synchronous fallback - we'll trigger async decryption in background
      const encryptedToken = localStorage.getItem(this.tokenStorageKey);
      if (!encryptedToken) {
        // this.logger.debugComponent('Auth', 'No token found in localStorage');
        return null;
      }

      // Check if it's encrypted format (contains ':') vs cleartext (backward compatibility)
      if (!encryptedToken.includes(':')) {
        // This is cleartext from previous version, parse and cache
        const token = JSON.parse(encryptedToken) as JwtToken;
        if (typeof token.expiresAt === 'string') {
          token.expiresAt = new Date(token.expiresAt);
        }
        // Cache it and trigger re-encryption in background
        this.jwtTokenSubject.next(token);
        this.storeTokenEncrypted(token).catch(error => {
          this.logger.error('Failed to re-encrypt cleartext token', error);
          // Keep using the token for now since it was already in cleartext
          // But log the error for security monitoring
        });
        return token;
      }

      // For encrypted tokens, we need async decryption
      // Trigger async decryption and return null for now
      void this.getStoredTokenDecrypted().then(token => {
        if (token) {
          this.jwtTokenSubject.next(token);
        }
      });

      // this.logger.debugComponent('Auth', 'Encrypted token found, decryption in progress');
      return null;
    } catch (error) {
      this.logger.error('Error retrieving stored token', error);
      return null;
    }
  }

  /**
   * Store user profile in local storage
   * @param profile User profile
   */
  /**
   * Encrypt and store user profile in local storage
   * Uses access token as encryption key material
   */
  private async storeUserProfile(profile: UserProfile): Promise<void> {
    // this.logger.debugComponent('Auth', 'Storing encrypted user profile');
    try {
      // Use the JWT access token as key material
      const tokenObj = this.getStoredToken();
      const keyMaterial = tokenObj?.token;
      if (!keyMaterial) {
        throw new Error('Missing access token for profile encryption');
      }
      const encProfile = await this.encryptProfile(profile, keyMaterial);
      localStorage.setItem(this.profileStorageKey, encProfile);
    } catch (e) {
      this.logger.error('Error encrypting user profile', e);
    }
  }

  /**
   * Decrypt and get user profile from local storage
   * Uses access token as decryption key material
   */
  async getStoredUserProfile(): Promise<UserProfile | null> {
    try {
      const encProfile = localStorage.getItem(this.profileStorageKey);
      if (!encProfile) return null;

      // Check if it's encrypted format (contains ':') vs cleartext (backward compatibility)
      if (!encProfile.includes(':')) {
        // This is cleartext from previous version or test setup
        try {
          const profile = JSON.parse(encProfile) as UserProfile;
          // Re-encrypt and store for future use if we have a token
          const tokenObj = this.getStoredToken();
          if (tokenObj?.token) {
            await this.storeUserProfile(profile);
          }
          return profile;
        } catch (parseError) {
          this.logger.error('Error parsing cleartext user profile', parseError);
          return null;
        }
      }

      // Encrypted format - decrypt normally
      const tokenObj = this.getStoredToken();
      const keyMaterial = tokenObj?.token;
      if (!keyMaterial) return null;
      return await this.decryptProfile(encProfile, keyMaterial);
    } catch (e) {
      this.logger.error('Error decrypting user profile', e);
      // Try to parse as cleartext for additional backward compatibility
      try {
        const profileJson = localStorage.getItem(this.profileStorageKey);
        if (profileJson && !profileJson.includes(':')) {
          return JSON.parse(profileJson) as UserProfile;
        }
      } catch (parseError) {
        this.logger.error('Could not parse user profile as cleartext either', parseError);
      }
      return null;
    }
  }

  /**
   * AES-GCM encrypt a profile with given key string
   */
  private async encryptProfile(profile: UserProfile, keyStr: string): Promise<string> {
    // Hash the key string to get a 256-bit key
    const key = await this.getAesKeyFromString(keyStr);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(profile));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    // Encode as base64: iv + ciphertext
    const b64Iv = this.uint8ToB64(iv);
    const b64Cipher = this.uint8ToB64(new Uint8Array(ciphertext));
    return `${b64Iv}:${b64Cipher}`;
  }

  /**
   * AES-GCM decrypt a profile with given key string
   */
  private async decryptProfile(encProfile: string, keyStr: string): Promise<UserProfile | null> {
    const [b64Iv, b64Cipher] = encProfile.split(':');
    if (!b64Iv || !b64Cipher) return null;
    const key = await this.getAesKeyFromString(keyStr);
    const iv = this.b64ToUint8(b64Iv);
    const ciphertext = this.b64ToUint8(b64Cipher);
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    const profileStr = new TextDecoder().decode(plaintextBuf);
    return JSON.parse(profileStr) as UserProfile;
  }

  /**
   * SHA-256 derive AES key from string
   */
  private async getAesKeyFromString(keyStr: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(keyStr));
    return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  }

  /**
   * Helpers to base64 encode/decode Uint8Array
   */
  private uint8ToB64(data: Uint8Array): string {
    // Browser-friendly base64 encoding
    return btoa(String.fromCharCode(...data));
  }
  private b64ToUint8(b64: string): Uint8Array {
    const binStr = atob(b64);
    const buffer = new ArrayBuffer(binStr.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binStr.length; ++i) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
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
    // this.logger.debugComponent('Auth', 'Refreshing access token via TMI server');

    const currentToken = this.getStoredToken();
    if (!currentToken?.refreshToken) {
      // this.logger.debugComponent('Auth', 'No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    // this.logger.debugComponent('Auth', 'Sending refresh token request', {
    //   hasRefreshToken: !!currentToken.refreshToken,
    //   refreshTokenLength: currentToken.refreshToken?.length,
    //   refreshTokenPrefix: currentToken.refreshToken?.substring(0, 20) + '...',
    //   tokenExpiry: currentToken.expiresAt.toISOString(),
    // });

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
          // Extract expiration from JWT exp claim (preferred) or fall back to expires_in
          let expiresAt = this.extractExpirationFromToken(response.access_token);
          let expiresIn = response.expires_in;

          if (expiresAt) {
            // Calculate expiresIn from exp claim for consistency
            const now = new Date();
            expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
            // this.logger.debugComponent('Auth', 'Using exp claim from refreshed JWT', {
            //   expClaim: expiresAt.toISOString(),
            //   calculatedExpiresIn: expiresIn,
            //   providedExpiresIn: response.expires_in,
            // });
          } else {
            // Fall back to expires_in from refresh response
            this.logger.warn('Refreshed JWT missing exp claim, falling back to expires_in', {
              expiresIn,
            });
            expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
          }

          const newToken = {
            token: response.access_token,
            refreshToken: response.refresh_token,
            expiresIn,
            expiresAt,
          };

          // this.logger.debugComponent('Auth', 'Token refresh successful', {
          //   newExpiry: newToken.expiresAt.toISOString(),
          //   hasNewRefreshToken: !!newToken.refreshToken,
          // });

          return newToken;
        }),
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Token refresh failed', error);
          // this.logger.debugComponent('Auth', 'Token refresh failed, clearing auth data', {
          //   status: error.status,
          //   message: error.message,
          // });
          // If refresh fails, clear auth data and redirect to login
          this.clearAuthData();
          return throwError(() => new Error('Token refresh failed - please login again'));
        }),
      );
  }

  /**
   * Clear all authentication data and notify SessionManager
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.profileStorageKey);
    this.isAuthenticatedSubject.next(false);
    this.userProfileSubject.next(null);
    this.jwtTokenSubject.next(null);

    // Clear cached providers to force re-evaluation on next login
    this.cachedOAuthProviders = null;
    this.cachedSAMLProviders = null;
    this.providersCacheTime = 0;

    // Clear PKCE verifier
    this.pkceService.clearVerifier();

    // Notify SessionManager to stop timers
    if (this.sessionManagerService) {
      this.sessionManagerService.stopExpiryTimers();
    }

    // this.logger.debugComponent('Auth', 'Cleared authentication data and provider cache');
  }

  /**
   * Logout the current user
   * Clears all authentication data and redirects to home page
   */
  logout(): void {
    // const userEmail = this.userEmail;
    // this.logger.info(`Logging out user: ${userEmail}`);

    // Determine if we should call server logout endpoint
    const isConnectedToServer =
      this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
    const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;

    if (shouldCallServerLogout) {
      // this.logger.debugComponent('Auth', 'Calling server logout endpoint', {
      //   isConnectedToServer,
      //   isTestUser: this.isTestUser,
      // });

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
            // this.logger.debugComponent('Auth', 'Server logout request completed');
          },
          error: () => {
            // This should not happen due to catchError, but handle it just in case
            this.logger.warn('Unexpected error in logout subscription');
          },
          complete: () => {
            // Clear authentication data after server request completes (or fails)
            this.clearAuthData();
            // this.logger.info('User logged out successfully');
            void this.router.navigate(['/']);
          },
        });
    } else {
      // Skip server logout and just clear client-side data
      // this.logger.debugComponent('Auth', 'Skipping server logout', {
      //   isConnectedToServer,
      //   isTestUser: this.isTestUser,
      //   isAuthenticated: this.isAuthenticated,
      // });

      this.clearAuthData();
      // this.logger.info('User logged out successfully (client-side only)');
      void this.router.navigate(['/']);
    }
  }

  /**
   * Generate encryption key for token storage based on browser fingerprint
   * This provides some protection against token theft while remaining recoverable
   */
  private getTokenEncryptionKey(): string {
    // Get or create session-specific salt
    let sessionSalt = sessionStorage.getItem('_ts');
    if (!sessionSalt) {
      const saltArray = new Uint8Array(16);
      crypto.getRandomValues(saltArray);
      sessionSalt = this.uint8ToB64(saltArray);
      sessionStorage.setItem('_ts', sessionSalt);
    }

    // Create browser fingerprint components
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      sessionSalt,
    ].join('|');

    return fingerprint;
  }

  /**
   * Encrypt and store JWT token
   */
  private async storeTokenEncrypted(token: JwtToken): Promise<void> {
    try {
      const keyMaterial = this.getTokenEncryptionKey();
      const encryptedToken = await this.encryptToken(token, keyMaterial);
      localStorage.setItem(this.tokenStorageKey, encryptedToken);
    } catch (error) {
      this.logger.error('Failed to encrypt token for storage', error);
      throw new Error('Token encryption failed - cannot proceed without secure storage');
    }
  }

  /**
   * Decrypt and retrieve JWT token
   */
  private async getStoredTokenDecrypted(): Promise<JwtToken | null> {
    const encryptedToken = localStorage.getItem(this.tokenStorageKey);
    if (!encryptedToken) {
      return null;
    }

    const keyMaterial = this.getTokenEncryptionKey();
    return await this.decryptToken(encryptedToken, keyMaterial);
  }

  /**
   * Encrypt JWT token using AES-GCM
   */
  private async encryptToken(token: JwtToken, keyStr: string): Promise<string> {
    const key = await this.getAesKeyFromString(keyStr);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(token));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const b64Iv = this.uint8ToB64(iv);
    const b64Cipher = this.uint8ToB64(new Uint8Array(ciphertext));
    return `${b64Iv}:${b64Cipher}`;
  }

  /**
   * Decrypt JWT token using AES-GCM
   */
  private async decryptToken(encryptedToken: string, keyStr: string): Promise<JwtToken | null> {
    const [b64Iv, b64Cipher] = encryptedToken.split(':');
    if (!b64Iv || !b64Cipher) return null;

    try {
      const key = await this.getAesKeyFromString(keyStr);
      const iv = this.b64ToUint8(b64Iv);
      const ciphertext = this.b64ToUint8(b64Cipher);
      const plaintextBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ciphertext as BufferSource,
      );
      const plaintext = new TextDecoder().decode(plaintextBuf);
      const parsed = JSON.parse(plaintext) as JwtToken;
      // Convert expiresAt string back to Date object if needed
      if (typeof parsed.expiresAt === 'string') {
        parsed.expiresAt = new Date(parsed.expiresAt);
      }
      return parsed;
    } catch (error) {
      // Decryption failure is expected when browser session context changes
      // (different fingerprint/salt makes the encryption key invalid)
      this.logger.debug('Token decryption failed - session context may have changed', error);
      return null;
    }
  }
}
