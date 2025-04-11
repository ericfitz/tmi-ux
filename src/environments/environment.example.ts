import { Environment } from './environment.interface';

/**
 * Example environment configuration with documentation
 * Copy this file to create custom environment configurations
 *
 * To create a new environment:
 * 1. Copy this file to 'environment.{env-name}.ts'
 * 2. Configure values based on your needs
 * 3. Update angular.json with a new configuration for this environment
 */
export const environment: Environment = {
  /**
   * Flag indicating if this is a production environment
   * Set to true for production environments to enable optimizations
   * and disable development features
   *
   * Allowed values: true, false
   * Default: false
   */
  production: false,

  /**
   * Application logging level
   * Controls which log messages are displayed in the console
   * Higher levels include all messages from lower levels
   *
   * Allowed values:
   * - 'DEBUG': All messages (most verbose)
   * - 'INFO': Info, warnings, and errors
   * - 'WARNING': Warnings and errors
   * - 'ERROR': Only errors (least verbose)
   *
   * Standard values for different environments:
   * - Development: 'DEBUG'
   * - Test/Staging: 'WARNING'
   * - Production: 'ERROR'
   *
   * Default: 'ERROR'
   */
  logLevel: 'DEBUG',

  /**
   * Base URL for API requests
   * This URL is used as the prefix for all API requests
   * For local development, you might use a localhost URL
   *
   * Examples:
   * - 'http://localhost:3000/api'
   * - 'https://api.dev.example.com/v1'
   * - 'https://api.example.com/v1'
   *
   * Default: 'https://api.example.com/v1'
   */
  apiUrl: 'https://api.staging.example.com/v1',

  /**
   * Authentication token expiration time in minutes
   * Controls how long users stay logged in before needing
   * to re-authenticate
   *
   * Allowed values: Any positive integer
   * Recommended:
   * - Development: 1440 (24 hours) for easier testing
   * - Production: 60 (1 hour) for better security
   *
   * Default: 60
   */
  authTokenExpiryMinutes: 120,
  
  /**
   * Name of the operator/entity that hosts this instance of TMI
   * This will be displayed on the About page and in other places
   * that reference the operator of the service
   *
   * Examples:
   * - 'Acme Corporation'
   * - 'Security Team'
   * - 'John Doe'
   *
   * Default: 'TMI Operator'
   */
  operatorName: 'Example Operator',
  
  /**
   * Contact information for the operator of this TMI instance
   * This will be displayed on the About page and can be an
   * email address, URL, or other contact information
   *
   * Examples:
   * - 'contact@example.com'
   * - 'https://example.com/contact'
   * - '+1 (555) 123-4567'
   *
   * Default: 'contact@example.com'
   */
  operatorContact: 'contact@example.com',

  /**
   * Port on which the application server will listen
   * This controls the port number used by the Angular dev server
   * 
   * Allowed values: Any valid port number (1-65535)
   * Recommended:
   * - Development: 4200 (Angular default)
   * - Production: 80 (HTTP) or 443 (HTTPS)
   * 
   * Default: 4200
   */
  serverPort: 4200,
  
  /**
   * Network interface on which the application server will listen
   * Controls which network interfaces can access the application
   * 
   * Allowed values:
   * - 'localhost' or '127.0.0.1': Only local connections (more secure)
   * - '0.0.0.0': All network interfaces (accessible from other machines)
   * - Specific IP: Only connections to that IP
   * 
   * Default: '0.0.0.0'
   */
  serverInterface: '0.0.0.0',
  
  /**
   * Whether to enable TLS/HTTPS for the application server
   * When true, the server will use HTTPS instead of HTTP
   * 
   * Allowed values: true, false
   * Recommended:
   * - Development: false (for easier testing)
   * - Production: true (for security)
   * 
   * Default: false
   */
  enableTLS: false,
  
  /**
   * Path to the TLS private key file
   * Required if enableTLS is true
   * Path should be absolute or relative to the project root
   * 
   * Example: './certs/server.key'
   * 
   * Default: undefined
   */
  tlsKeyPath: undefined,
  
  /**
   * Path to the TLS certificate file
   * Required if enableTLS is true
   * Path should be absolute or relative to the project root
   * 
   * Example: './certs/server.crt'
   * 
   * Default: undefined
   */
  tlsCertPath: undefined,
  
  /**
   * TLS subject name
   * Used for certificate validation
   * If not specified, the system hostname will be used
   * 
   * Example: 'example.com'
   * 
   * Default: system hostname
   */
  tlsSubjectName: undefined,
};
