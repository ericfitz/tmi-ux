/**
 * Environment Configuration Interface
 *
 * This file defines TypeScript interfaces for environment configuration across all deployment environments.
 * It provides type safety and documentation for all environment variables and OAuth provider settings.
 *
 * Key functionality:
 * - Defines Environment interface with all configuration options
 * - Supports OAuth authentication with dynamic provider discovery
 * - Includes local development provider for testing
 * - Configures TLS/HTTPS settings for production deployments
 * - Defines logging levels and component-specific debug options
 * - Supports operator contact information and server configuration
 */

/**
 * Interface for application environment configuration
 * This interface defines all environment variables used in the application
 */
export interface Environment {
  /**
   * Flag indicating if this is a production environment
   * Default: false
   */
  production: boolean;

  /**
   * Application logging level
   * Allowed values: 'DEBUG', 'INFO', 'WARN', 'ERROR'
   * Default: 'ERROR'
   */
  logLevel: string;

  /**
   * Component-specific debug logging configuration
   * Allows enabling debug logging for specific components while keeping others at higher levels
   * Example: ['DFD', 'AUTH'] to enable debug logging only for DFD and authentication components
   * Default: [] (no component-specific debug logging)
   */
  debugComponents?: string[];

  /**
   * Base URL for API requests
   * Default: 'https://api.example.com/v1'
   */
  apiUrl: string;

  /**
   * Authentication token expiration time in minutes
   * Default: 60 (1 hour)
   */
  authTokenExpiryMinutes: number;

  /**
   * Name of the operator/entity that hosts this instance of TMI
   * Example: 'Acme Corporation', 'Security Team', 'John Doe'
   * Default: 'TMI Operator'
   */
  operatorName: string;

  /**
   * Contact information for the operator of this TMI instance
   * Can be an email address, URL, or other contact information
   * Example: 'contact@example.com', 'https://example.com/contact'
   * Default: 'contact@example.com'
   */
  operatorContact: string;

  /**
   * Port on which the application server will listen
   * Default: 4200
   */
  serverPort?: number;

  /**
   * Network interface on which the application server will listen
   * Use '0.0.0.0' to listen on all interfaces
   * Use 'localhost' or '127.0.0.1' to only listen on the loopback interface
   * Default: '0.0.0.0'
   */
  serverInterface?: string;

  /**
   * Whether to enable TLS/HTTPS for the application server
   * Default: false
   */
  enableTLS?: boolean;

  /**
   * Path to the TLS private key file
   * Only used if enableTLS is true
   * Default: undefined
   */
  tlsKeyPath?: string;

  /**
   * Path to the TLS certificate file
   * Only used if enableTLS is true
   * Default: undefined
   */
  tlsCertPath?: string;

  /**
   * TLS subject name
   * Only used if enableTLS is true
   * Default: system hostname
   */
  tlsSubjectName?: string;

  /**
   * OAuth configuration for authentication providers
   * OAuth providers are now discovered dynamically from TMI server via /auth/providers
   * This configuration only contains local development provider settings
   */
  oauth?: {
    /**
     * Local development provider configuration
     * Used for testing and development when TMI server is not available
     */
    local?: {
      /**
       * Whether local provider is enabled
       * Default: true in development, false in production
       */
      enabled?: boolean;

      /**
       * FontAwesome icon class for local provider
       * Default: 'fa-solid fa-laptop-code'
       */
      icon?: string;
    };
  };

  /**
   * Default authentication provider to use
   * If not specified, will use 'local' if available, otherwise first provider from TMI server
   */
  defaultAuthProvider?: string;

  /**
   * Security configuration for HTTP headers and policies
   * These settings help configure security headers at the application level
   */
  securityConfig?: {
    /**
     * Whether to enable HSTS (HTTP Strict Transport Security)
     * Should only be enabled when TLS is available
     * Default: true
     */
    enableHSTS?: boolean;

    /**
     * HSTS max-age in seconds
     * Default: 31536000 (1 year)
     */
    hstsMaxAge?: number;

    /**
     * Whether to include subdomains in HSTS policy
     * Default: true
     */
    hstsIncludeSubDomains?: boolean;

    /**
     * Whether to enable HSTS preload
     * Only enable after careful consideration
     * Default: false
     */
    hstsPreload?: boolean;

    /**
     * CSP report URI for violation reporting
     * If set, CSP violations will be reported to this endpoint
     * Default: undefined
     */
    cspReportUri?: string;

    /**
     * X-Frame-Options header value
     * Default: 'DENY'
     */
    frameOptions?: 'DENY' | 'SAMEORIGIN';

    /**
     * Referrer-Policy header value
     * Default: 'strict-origin-when-cross-origin'
     */
    referrerPolicy?: string;

    /**
     * Permissions-Policy header value
     * Default: 'camera=(), microphone=(), geolocation=()'
     */
    permissionsPolicy?: string;
  };
}
