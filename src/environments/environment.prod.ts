/**
 * Production Environment Configuration
 * 
 * This file contains the production environment configuration with optimized settings for deployment.
 * It provides secure, performance-oriented settings suitable for production environments.
 * 
 * Key functionality:
 * - Enables production mode with optimizations
 * - Sets minimal logging levels for performance
 * - Configures production API endpoints
 * - Uses secure OAuth configuration for production
 * - Optimizes token expiry for security vs usability
 * - Provides production operator contact information
 * - Excludes local development provider for security
 */

import { Environment } from './environment.interface';

/**
 * Production environment configuration
 * Used when building for production
 */
export const environment: Environment = {
  production: true,
  logLevel: 'ERROR', // Only show errors in production
  apiUrl: 'https://api.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator',
  operatorContact: 'contact@example.com',
  defaultAuthProvider: 'google', // Default to Google in production
  oauth: {
    providers: [
      {
        id: 'google',
        name: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['openid', 'email', 'profile'],
        clientId: 'PRODUCTION_GOOGLE_CLIENT_ID', // Will be replaced during build/deployment
        redirectUri: 'https://app.example.com/auth/callback',
        icon: 'fa-brands fa-google'
      },
      {
        id: 'github',
        name: 'GitHub Enterprise',
        authUrl: 'https://github.com/login/oauth/authorize',
        scopes: ['user:email'],
        clientId: 'PRODUCTION_GITHUB_CLIENT_ID', // Will be replaced during build/deployment
        redirectUri: 'https://app.example.com/auth/callback',
        icon: 'fa-brands fa-github'
      }
    ]
    // Note: No local provider in production
  },
};
