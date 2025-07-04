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
   * Allowed values: 'DEBUG', 'INFO', 'WARNING', 'ERROR'
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
   * Contains settings for each supported OAuth provider
   */
  oauth?: {
    /**
     * Google OAuth configuration
     */
    google?: {
      /**
       * Google OAuth client ID
       * Obtained from Google Cloud Console
       */
      clientId: string;

      /**
       * Redirect URI for OAuth callback
       * Must match one of the authorized redirect URIs in Google Cloud Console
       */
      redirectUri: string;
    };
  };
}
