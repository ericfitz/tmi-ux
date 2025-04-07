# Environment Configuration for TMI-UX

This directory contains environment configuration files used to customize application behavior across different deployment environments.

## Available Environment Files

- `environment.ts` - Default development environment
- `environment.prod.ts` - Production environment
- `environment.staging.ts` - Staging environment (production-like for testing)
- `environment.example.ts` - Example with detailed documentation of all options

## Creating Custom Environments

1. Copy `environment.example.ts` to `environment.{your-env-name}.ts`
2. Configure the variables as needed
3. Add a new configuration entry in `angular.json` under the "configurations" section:

```json
"your-env-name": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.your-env-name.ts"
    }
  ],
  "outputHashing": "all"
}
```

4. Add a new script to `package.json` for easy access:

```json
"dev:your-env-name": "ng serve --configuration=your-env-name --open"
```

## Environment Variables

### production: boolean

Indicates if this is a production environment. When true, Angular enables production mode with optimizations.

### logLevel: string

Controls the application's logging verbosity. Valid options from least to most verbose:

- `ERROR` (default) - Only errors are logged
- `WARNING` - Warnings and errors are logged
- `INFO` - Informational messages, warnings, and errors are logged
- `DEBUG` - All messages are logged, including debug information

### apiUrl: string

Base URL for API requests. Examples:
- Development: `http://localhost:3000/api`
- Staging: `https://api.staging.example.com/v1`
- Production: `https://api.example.com/v1`

### authTokenExpiryMinutes: number

How long the authentication token is valid for (in minutes) before requiring re-authentication.
- Development: 1440 (24 hours) is recommended for easier testing
- Production: 60 (1 hour) is recommended for security

## Usage in Code

Import the environment wherever you need access to configuration values:

```typescript
import { environment } from '../environments/environment';

// Use a configuration value
console.log('API URL:', environment.apiUrl);

// Check if we're in production
if (environment.production) {
  // Do production-specific things
}
```