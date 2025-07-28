import { Environment } from './environment.interface';

/**
 * Development environment configuration
 * Used when running the application in development mode
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  apiUrl: 'http://localhost:8080',
  authTokenExpiryMinutes: 1440, // 24 hours for easier development
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'dev@tmi.com',
  serverPort: 4200,
  serverInterface: 'localhost',
  enableTLS: false,
  defaultAuthProvider: 'local',
  oauth: {
    providers: [
      {
        id: 'google',
        name: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['openid', 'email', 'profile'],
        clientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with actual Google OAuth client ID
        redirectUri: 'http://localhost:4200/auth/callback',
        icon: 'fa-brands fa-google',
      },
      {
        id: 'github',
        name: 'GitHub',
        authUrl: 'https://github.com/login/oauth/authorize',
        scopes: ['user:email'],
        clientId: 'YOUR_GITHUB_CLIENT_ID', // Replace with actual GitHub OAuth client ID
        redirectUri: 'http://localhost:4200/auth/callback',
        icon: 'fa-brands fa-github',
      },
    ],
    local: {
      enabled: true,
      icon: 'fa-solid fa-laptop-code',
      users: [
        { id: 'user1', name: 'Alice Developer', email: 'user1@example.com' },
        { id: 'user2', name: 'Bob Tester', email: 'user2@example.com' },
        { id: 'user3', name: 'Charlie Admin', email: 'user3@example.com' },
      ],
    },
  },
};
