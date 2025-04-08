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
}
