/**
 * Authentication Service
 *
 * This service handles all authentication-related functionality for the TMI application.
 * It manages OAuth flows, session state, user profiles, and session management.
 *
 * Key functionality:
 * - Supports multiple OAuth providers (Google, GitHub, etc.) configured via TMI server
 * - Manages session state via HttpOnly cookies (tokens are never accessible to JS)
 * - Handles OAuth callback processing with CSRF protection via state parameter
 * - Provides reactive authentication state through observables
 * - Supports role-based access control
 * - Manages user profile data via GET /me endpoint
 * - Handles authentication errors with retry capabilities
 */

import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  take,
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
  AuthSession,
  JwtToken,
  OAuthResponse,
  UserProfile,
  UserMeResponse,
  OAuthProviderInfo,
  ProvidersResponse,
  SAMLProviderInfo,
  SAMLProvidersResponse,
} from '../models/auth.models';
import { PkceService } from './pkce.service';
import { PkceError } from '../models/pkce.models';
import { IS_LOGOUT_REQUEST } from '../../core/tokens/http-context.tokens';

/**
 * Service for handling authentication with the TMI server.
 * Uses HttpOnly cookies for session management — tokens are never accessible to JS.
 * Session timing is tracked in-memory via AuthSession (expiresIn/expiresAt).
 * User profile is fetched via GET /me on login and page refresh.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Private subjects
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private sessionSubject = new BehaviorSubject<AuthSession | null>(null);
  private authErrorSubject = new BehaviorSubject<AuthError | null>(null);
  private tokenReadySubject = new BehaviorSubject<boolean>(false);

  // Public observables
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  userProfile$ = this.userProfileSubject.asObservable();
  authError$ = this.authErrorSubject.asObservable();

  /**
   * Observable that emits true when initial auth check is complete.
   * Use this to wait before making API calls that require authentication.
   */
  tokenReady$ = this.tokenReadySubject.asObservable();

  // Backward compatibility for existing components
  username$ = this.userProfileSubject.pipe(map(profile => profile?.display_name || ''));

  // OAuth configuration
  private readonly providersCacheExpiry = 5 * 60 * 1000; // 5 minutes

  // Cached provider information
  private cachedOAuthProviders: OAuthProviderInfo[] | null = null;
  private cachedSAMLProviders: SAMLProviderInfo[] | null = null;
  private oauthProvidersCacheTime = 0;
  private samlProvidersCacheTime = 0;

  // Refresh request deduplication - prevents concurrent refresh calls
  private refreshInProgress$: Observable<AuthSession> | null = null;

  // Re-entrancy guard - prevents multiple logout calls from overlapping
  private isLoggingOut = false;

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
    // Check auth status by calling GET /me on service creation
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
   * Get current user's provider ID from user profile
   * @returns The provider-assigned user ID or empty string if not authenticated
   */
  get providerId(): string {
    return this.userProfile?.provider_id || '';
  }

  /**
   * Get current user's OAuth provider (IDP) from user profile
   * @returns The OAuth provider (e.g., "google", "github") or empty string if not available
   */
  get userIdp(): string {
    return this.userProfile?.provider || '';
  }

  /**
   * Get current user groups from user profile
   * @returns Array of group names the user belongs to, or empty array if not available
   */
  get userGroups(): string[] {
    const groups = this.userProfile?.groups;
    if (!groups) return [];
    return groups.map(g => g.group_name);
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
   * Check if the current user is an administrator
   * @returns True if the current user has admin privileges
   */
  get isAdmin(): boolean {
    return this.userProfile?.is_admin === true;
  }

  get isSecurityReviewer(): boolean {
    return this.userProfile?.is_security_reviewer === true;
  }

  /**
   * Get the role-based landing page for the current user.
   * Rules (first match wins):
   * 1. Security reviewer → /dashboard
   * 2. Administrator (not reviewer) → /admin
   * 3. Neither → /intake
   */
  getLandingPage(): string {
    const profile = this.userProfile;
    if (profile?.is_security_reviewer) return '/dashboard';
    if (profile?.is_admin) return '/admin';
    return '/intake';
  }

  /**
   * Check if the current session is valid (not expired)
   * @param session Optional session to check, otherwise retrieves from memory
   * @returns True if the session is valid and not expired
   */
  isSessionValid(session?: AuthSession | null): boolean {
    const sessionToCheck = session || this.getSessionInfo();
    if (!sessionToCheck) {
      return false;
    }
    const now = new Date();
    return sessionToCheck.expiresAt > now;
  }

  /**
   * Validates session expiry and updates auth state if expired.
   * Called by TokenValidityGuardService when browser resumes from background,
   * and by authGuard as defense-in-depth before checking isAuthenticated$.
   *
   * This method is critical for preventing "zombie sessions" where the user
   * appears authenticated but their session has actually expired (e.g., after
   * returning from a backgrounded browser tab where timers were throttled).
   *
   * Triggers full logout (including server-side session revocation and
   * cross-tab synchronization) when invalid state is detected.
   */
  validateAndUpdateAuthState(): void {
    const session = this.getSessionInfo();

    // No session found but we think we're authenticated - full logout
    if (!session) {
      if (this.isAuthenticatedSubject.value) {
        this.logger.warn('No session info but auth state was true, triggering logout');
        this.logout();
      }
      return;
    }

    // Session expired but we think we're authenticated - full logout
    if (!this.isSessionValid(session) && this.isAuthenticatedSubject.value) {
      this.logger.warn('Session expired during background period, triggering logout', {
        sessionExpiry: session.expiresAt.toISOString(),
        currentTime: new Date().toISOString(),
      });
      this.logout();
    }
  }

  /**
   * Check if session needs refreshing (expires within 15 minutes)
   * @param session Optional session to check, otherwise retrieves from memory
   * @returns True if session should be refreshed
   */
  private shouldRefreshSession(session?: AuthSession | null): boolean {
    const sessionToCheck = session || this.getSessionInfo();
    if (!sessionToCheck) {
      return false;
    }

    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
    return sessionToCheck.expiresAt <= fifteenMinutesFromNow;
  }

  /**
   * Ensure the session is valid, refreshing if necessary.
   * If auth check is still in progress, waits for it to complete.
   * @returns Observable that resolves to a valid AuthSession
   */
  ensureValidSession(): Observable<AuthSession> {
    const session = this.getSessionInfo();

    if (session) {
      return this.processValidSession(session);
    }

    // No session in memory - check if we need to wait for initial auth check
    if (!this.tokenReadySubject.value) {
      return this.tokenReady$.pipe(
        filter(ready => ready),
        take(1),
        switchMap(() => {
          const resolvedSession = this.getSessionInfo();
          if (!resolvedSession) {
            return throwError(() => new Error('No session available'));
          }
          return this.processValidSession(resolvedSession);
        }),
      );
    }

    return throwError(() => new Error('No session available'));
  }

  /**
   * @deprecated Use ensureValidSession() instead
   */
  getValidToken(): Observable<JwtToken> {
    return this.ensureValidSession();
  }

  /**
   * Process a session - validate and refresh if needed
   */
  private processValidSession(session: AuthSession): Observable<AuthSession> {
    const isValid = this.isSessionValid(session);
    const shouldRefresh = this.shouldRefreshSession(session);

    if (isValid && !shouldRefresh) {
      return of(session);
    }

    // Session needs refresh - attempt cookie-based refresh
    if (isValid || shouldRefresh) {
      return this.refreshToken().pipe(
        map(newSession => {
          this.storeSessionInfo(newSession);
          return newSession;
        }),
      );
    }

    // Session is fully expired
    this.clearAuthData();
    return throwError(() => new Error('Session expired'));
  }

  /**
   * Get session info if available, returns null if not authenticated
   */
  getValidTokenIfAvailable(): Observable<AuthSession | null> {
    const session = this.getSessionInfo();
    if (!session) {
      return of(null);
    }

    if (this.isSessionValid() && !this.shouldRefreshSession()) {
      return of(session);
    }

    return this.refreshToken().pipe(
      map(newSession => {
        this.storeSessionInfo(newSession);
        return newSession;
      }),
      catchError(() => {
        this.clearAuthData();
        return of(null);
      }),
    );
  }

  /**
   * Check auth status by calling GET /me.
   * If the server responds successfully (cookie is valid), we're authenticated.
   * Sets tokenReady$ to true when complete (even on error).
   */
  async checkAuthStatus(): Promise<void> {
    try {
      // If we already have a session in memory, use it
      if (this.sessionSubject.value && this.isSessionValid()) {
        this.tokenReadySubject.next(true);
        return;
      }

      // Call GET /me to check if we have a valid session cookie
      const response = await this.http
        .get<UserMeResponse>(`${environment.apiUrl}/me`)
        .toPromise()
        .catch(() => null);

      if (response) {
        // Session cookie is valid - we're authenticated
        const profile: UserProfile = {
          provider: response.provider,
          provider_id: response.provider_id,
          display_name: response.name,
          email: response.email,
          groups: response.groups ?? null,
          jwt_groups: null,
          is_admin: response.is_admin,
          is_security_reviewer: response.is_security_reviewer,
        };

        this.isAuthenticatedSubject.next(true);
        this.userProfileSubject.next(profile);

        // If we don't have session timing info yet, set a default
        // (will be updated on next refresh)
        if (!this.sessionSubject.value) {
          const defaultExpiresIn = environment.authTokenExpiryMinutes * 60;
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + defaultExpiresIn);
          this.sessionSubject.next({ expiresIn: defaultExpiresIn, expiresAt });
        }
      } else {
        // No valid session - not authenticated
        this.isAuthenticatedSubject.next(false);
        this.userProfileSubject.next(null);
        this.sessionSubject.next(null);
      }
    } catch (error) {
      this.logger.error('Error checking auth status', error);
      this.clearAuthData();
    } finally {
      this.tokenReadySubject.next(true);
    }
  }

  /**
   * Get available OAuth authentication providers from TMI server
   * Uses caching to avoid repeated API calls
   */
  getAvailableProviders(): Observable<OAuthProviderInfo[]> {
    // Check cache first
    const now = Date.now();
    if (
      this.cachedOAuthProviders &&
      now - this.oauthProvidersCacheTime < this.providersCacheExpiry
    ) {
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
        this.oauthProvidersCacheTime = now;

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
    if (this.cachedSAMLProviders && now - this.samlProvidersCacheTime < this.providersCacheExpiry) {
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
        this.samlProvidersCacheTime = now;

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

      // Store return URL if provided and valid
      if (returnUrl && this.isValidReturnUrl(returnUrl)) {
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
   * Validate that a return URL is safe for navigation.
   * Only allows relative URLs starting with a single slash to prevent open redirect attacks.
   * @param url URL to validate
   * @returns true if the URL is a safe relative path
   */
  private isValidReturnUrl(url: string): boolean {
    if (!url) return false;
    // Only allow relative URLs starting with / but not // (protocol-relative)
    return url.startsWith('/') && !url.startsWith('//');
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

      // For SAML flows, fall back to sessionStorage if state didn't carry a return URL
      if (!returnUrl) {
        const samlReturnUrl = sessionStorage.getItem('saml_return_url');
        if (samlReturnUrl) {
          returnUrl = samlReturnUrl;
          sessionStorage.removeItem('saml_return_url');
        }
      }

      // this.logger.debugComponent('Auth', 'State parameter validation starting', {
      //   receivedState: response.state,
      //   storedState: storedState,
      //   providerId: providerId,
      //   hasAccessToken: !!response.access_token,
      // });

      // Enforce strict CSRF state validation for all flows
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
    } else {
      // No state parameter — check sessionStorage for SAML return URL
      const samlReturnUrl = sessionStorage.getItem('saml_return_url');
      if (samlReturnUrl) {
        returnUrl = samlReturnUrl;
        sessionStorage.removeItem('saml_return_url');
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
      // With HttpOnly cookies, the server sets tokens as cookies.
      // We only extract expires_in from the response body for session timing.
      const expiresIn = response.expires_in || 3600;
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      const session: AuthSession = { expiresIn, expiresAt };
      this.storeSessionInfo(session);
      this.isAuthenticatedSubject.next(true);

      // Fetch user profile from server (blocking — we need it before navigation)
      return this.refreshUserProfile().pipe(
        switchMap(profile => {
          this.logger.info(`User ${profile.email} logged in via ${providerId || 'unknown'}`);

          // Navigate to return URL if provided and valid, otherwise to role-based landing page
          const validReturnUrl =
            returnUrl && this.isValidReturnUrl(returnUrl) ? returnUrl : undefined;
          const navigationPromise = validReturnUrl
            ? this.router.navigateByUrl(validReturnUrl)
            : this.router.navigate([this.getLandingPage()]);

          return from(navigationPromise).pipe(
            map(navigationSuccess => {
              if (!navigationSuccess) {
                this.logger.warn('Navigation after OAuth callback failed', { returnUrl });
              }
              return true;
            }),
            catchError(navError => {
              this.logger.error('Error during post-auth navigation', navError);
              return of(true);
            }),
          );
        }),
        catchError(profileError => {
          this.logger.error('Failed to fetch user profile after login', profileError);
          // Auth succeeded (cookies set) but profile fetch failed — still authenticated
          void this.router.navigate([this.getLandingPage()]);
          return of(true);
        }),
      );
    } catch (error) {
      this.logger.error('Error processing TMI token response', error);
      this.handleAuthError({
        code: 'token_processing_error',
        message: 'Failed to process authentication response',
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
    // Note: idp is sent as a query parameter (server expects c.Query("idp"))
    // state is NOT included - it's for CSRF protection and validated on callback only
    const redirectUri = `${window.location.origin}/oauth2/callback`;
    const exchangeRequest = {
      grant_type: 'authorization_code',
      code: response.code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    };

    // Token exchange endpoint with idp as query parameter
    const exchangeUrl = `${environment.apiUrl}/oauth2/token${providerId ? `?idp=${providerId}` : ''}`;

    // this.logger.debugComponent('Auth', 'Sending token exchange request', {
    //   exchangeUrl: exchangeUrl.replace(/\?.*$/, ''), // Log without query params
    //   providerId,
    //   redirectUri,
    //   hasCode: !!exchangeRequest.code,
    // });

    return this.http
      .post<{
        expires_in: number;
        token_type: string;
      }>(exchangeUrl, exchangeRequest)
      .pipe(
        switchMap(tokenResponse => {
          // Clear PKCE verifier after successful exchange
          this.pkceService.clearVerifier();

          // Server sets HttpOnly cookies; we track session timing from expires_in
          const expiresIn = tokenResponse.expires_in || 3600;
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

          const session: AuthSession = { expiresIn, expiresAt };
          this.storeSessionInfo(session);
          this.isAuthenticatedSubject.next(true);

          // Fetch user profile from server
          return this.refreshUserProfile().pipe(
            map(profile => {
              this.logger.info(
                `User ${profile.email} logged in via ${providerId || 'unknown'} (code exchange)`,
              );

              // Navigate to return URL or role-based landing page
              if (returnUrl && this.isValidReturnUrl(returnUrl)) {
                void this.router.navigateByUrl(returnUrl);
              } else {
                void this.router.navigate([this.getLandingPage()]);
              }

              return true;
            }),
            catchError(profileError => {
              this.logger.error('Failed to fetch profile after code exchange', profileError);
              void this.router.navigate([this.getLandingPage()]);
              return of(true);
            }),
          );
        }),
        catchError((error: HttpErrorResponse) => {
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
   * Fetch current user profile from server and update cached profile with admin status
   * This should be called after login to get the is_admin flag
   * Calls GET /me directly to avoid circular dependency
   * @returns Observable that completes when profile is updated
   */
  refreshUserProfile(): Observable<UserProfile> {
    this.logger.debugComponent('Auth', 'Fetching current user profile from server');
    return this.http.get<UserMeResponse>(`${environment.apiUrl}/me`).pipe(
      map(response => {
        // Transform API response to UserProfile format
        const profile: UserProfile = {
          provider: response.provider,
          provider_id: response.provider_id,
          display_name: response.name,
          email: response.email,
          groups: response.groups ?? null,
          jwt_groups: null,
          is_admin: response.is_admin,
          is_security_reviewer: response.is_security_reviewer,
        };
        return profile;
      }),
      tap(profile => {
        this.userProfileSubject.next(profile);
        this.logger.debugComponent('Auth', 'User profile refreshed', {
          isAdmin: profile.is_admin,
        });
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Failed to refresh user profile', error);
        if (this.userProfile) {
          return of(this.userProfile);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Store session info in memory and notify SessionManager
   */
  storeSessionInfo(session: AuthSession): void {
    this.sessionSubject.next(session);

    // Notify SessionManager of refreshed session
    if (this.sessionManagerService) {
      this.sessionManagerService.onTokenRefreshed();
    }
  }

  /**
   * @deprecated Use storeSessionInfo() instead
   */
  storeToken(token: JwtToken): void {
    this.storeSessionInfo(token);
  }

  /**
   * Get session info from memory
   * @returns Session info or null if not authenticated
   */
  getSessionInfo(): AuthSession | null {
    return this.sessionSubject.value;
  }

  /**
   * @deprecated Use getSessionInfo() instead
   */
  getStoredToken(): JwtToken | null {
    return this.getSessionInfo();
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
   * Refresh the session using cookie-based refresh.
   * The server reads the refresh token from the HttpOnly cookie.
   * @returns Observable that resolves to a new AuthSession
   */
  refreshToken(): Observable<AuthSession> {
    return this.http
      .post<{
        expires_in: number;
      }>(`${environment.apiUrl}/oauth2/refresh`, {})
      .pipe(
        map(response => {
          const expiresIn = response.expires_in;
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

          const session: AuthSession = { expiresIn, expiresAt };
          return session;
        }),
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Token refresh failed', error);
          this.clearAuthData();
          return throwError(() => new Error('Token refresh failed - please login again'));
        }),
      );
  }

  /**
   * Force refresh session regardless of expiry time.
   * Used when server rejects a request with 401 (e.g., cookie expired server-side).
   * Deduplicates concurrent refresh requests.
   * @returns Observable that resolves to a new AuthSession
   */
  forceRefreshToken(): Observable<AuthSession> {
    // If refresh already in progress, return the same observable (deduplication)
    if (this.refreshInProgress$) {
      this.logger.debugComponent('Auth', 'Refresh already in progress, reusing existing request');
      return this.refreshInProgress$;
    }

    this.logger.warn('Forcing token refresh due to server rejection');

    this.refreshInProgress$ = this.refreshToken().pipe(
      tap(newSession => {
        this.storeSessionInfo(newSession);
        this.refreshInProgress$ = null;
      }),
      catchError((error: unknown) => {
        this.refreshInProgress$ = null;
        this.logger.error('Forced token refresh failed', error);
        return throwError(() => error);
      }),
      shareReplay(1),
    );

    return this.refreshInProgress$;
  }

  /**
   * Clear all authentication data and notify SessionManager.
   * With HttpOnly cookies, the server clears cookies on logout.
   * This method clears in-memory state and broadcasts to other tabs.
   */
  private clearAuthData(): void {
    // Clean up any legacy localStorage data from pre-HttpOnly migration
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    sessionStorage.removeItem('_ts');

    this.isAuthenticatedSubject.next(false);
    this.userProfileSubject.next(null);
    this.sessionSubject.next(null);

    // Clear cached providers to force re-evaluation on next login
    this.cachedOAuthProviders = null;
    this.cachedSAMLProviders = null;
    this.oauthProvidersCacheTime = 0;
    this.samlProvidersCacheTime = 0;

    // Clear PKCE verifier
    this.pkceService.clearVerifier();

    // Notify SessionManager to stop timers
    if (this.sessionManagerService) {
      this.sessionManagerService.stopExpiryTimers();
    }

    // Broadcast logout to other browser tabs for cross-tab synchronization
    // The storage event only fires in OTHER tabs, not the one that made the change
    try {
      localStorage.setItem('auth_logout_broadcast', Date.now().toString());
      localStorage.removeItem('auth_logout_broadcast');
    } catch {
      // Ignore storage errors (e.g., private browsing mode)
    }
  }

  /**
   * Logout the current user
   * Clears all authentication data and redirects to home page
   */
  logout(): void {
    // Re-entrancy guard: prevent multiple simultaneous logout calls
    if (this.isLoggingOut) {
      return;
    }
    this.isLoggingOut = true;

    // Determine if we should call server logout endpoint
    const isConnectedToServer =
      this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
    const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer;

    if (shouldCallServerLogout) {
      // Cookie is sent automatically via withCredentials (set by CredentialsInterceptor)
      const context = new HttpContext().set(IS_LOGOUT_REQUEST, true);

      this.http
        .post(`${environment.apiUrl}/me/logout`, null, { context })
        .pipe(
          catchError((error: HttpErrorResponse) => {
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
          error: () => {
            this.logger.warn('Unexpected error in logout subscription');
          },
          complete: () => {
            this.clearAuthData();
            this.isLoggingOut = false;
            void this.router.navigate(['/']);
          },
        });
    } else {
      this.clearAuthData();
      this.isLoggingOut = false;
      void this.router.navigate(['/']);
    }
  }
}
