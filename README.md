# TMI UX

Angular-based user interface for the TMI application.

> **Note:** Documentation about architecture, implementation plans, and development guidelines can be found in the [context](./context) directory.

## Development

### Prerequisites

- Node.js (see `.nvmrc` for version)
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Configuration

The application supports multiple environment configurations:

1. **Default Configuration**
   ```bash
   npm run dev  # Uses environment.ts file
   ```

2. **Environment-specific Configurations**
   ```bash
   npm run dev:staging  # Uses environment.staging.ts file
   npm run dev:test     # Uses environment.test.ts file
   npm run dev:prod     # Uses environment.prod.ts file
   ```

3. **Custom Configuration with Environment Variables**
   ```bash
   # Set environment variables first
   export TMI_INTERFACE=0.0.0.0    # Listen on all interfaces
   export TMI_PORT=8080            # Custom port
   export TMI_SSL=true             # Enable HTTPS
   export TMI_SSL_KEY=./certs/key.pem    # Path to SSL key
   export TMI_SSL_CERT=./certs/cert.pem  # Path to SSL certificate
   
   # Run with custom configuration
   npm run dev:custom
   ```

### Environment Files

Environment files are located in `src/environments/`. The application uses:

- `environment.ts` - Default development environment
- `environment.dev.ts` - Development environment (when configured)
- `environment.prod.ts` - Production environment
- `environment.staging.ts` - Staging environment
- `environment.test.ts` - Test environment
- `environment.example.ts` - Example with documentation

To create a custom environment:
1. Copy `environment.example.ts` to a new file (e.g., `environment.custom.ts`)
2. Configure values as needed
3. Update `angular.json` with a new configuration if needed

### Available Environment Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `production` | Enable production mode | `false` |
| `logLevel` | Logging verbosity ('DEBUG', 'INFO', 'WARNING', 'ERROR') | `'ERROR'` |
| `apiUrl` | API server URL | `'https://api.example.com/v1'` |
| `authTokenExpiryMinutes` | Authentication token validity | `60` |
| `operatorName` | Name of service operator | `'TMI Operator'` |
| `operatorContact` | Contact information | `'contact@example.com'` |
| `serverPort` | Server listening port | `4200` |
| `serverInterface` | Server listening interface | `'0.0.0.0'` |
| `enableTLS` | Enable HTTPS | `false` |
| `tlsKeyPath` | Path to TLS private key | `undefined` |
| `tlsCertPath` | Path to TLS certificate | `undefined` |
| `tlsSubjectName` | TLS subject name | System hostname |

## Building

```bash
# Production build
npm run build:prod

# Staging build
npm run build:staging

# Test build
npm run build:test
```

## Code Quality

```bash
# Run linting
npm run lint

# Run SCSS linting
npm run lint:scss

# Run all linting
npm run lint:all

# Format code
npm run format

# Check formatting
npm run format:check

# Run all checks
npm run check
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
ng test --include=**/path/to/file.spec.ts

# Run tests for a specific component
ng test --include=**/component-name/*.spec.ts
```