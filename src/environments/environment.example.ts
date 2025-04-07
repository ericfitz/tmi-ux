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
  authTokenExpiryMinutes: 120
};