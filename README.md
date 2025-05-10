# TMI UX

Angular-based user interface for the TMI application.

## Overview

TMI (Threat Modeling Improved) is a server based web application enabling collaborative threat modeling with support for:

- Real-time collaborative diagram editing via WebSockets
- Role-based access control (reader, writer, owner)
- OAuth authentication with JWT
- RESTful API with OpenAPI 3.0 specification
- MCP integration (planned)

The associated back-end server, written in Go, is called [TMI](https://github.com/ericfitz/tmi).

> **Note:** Documentation about architecture, implementation plans, and development guidelines can be found in the [context](./context) directory.

## Development

### Prerequisites

- Node.js (see `.nvmrc` for version)
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

### Environment Configuration

The application supports multiple environment configurations:

1. **Default Configuration**

   ```bash
   pnpm run dev  # Uses environment.ts file
   ```

2. **Environment-specific Configurations**

   ```bash
   pnpm run dev:staging  # Uses environment.staging.ts file
   pnpm run dev:test     # Uses environment.test.ts file
   pnpm run dev:prod     # Uses environment.prod.ts file
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
   pnpm run dev:custom
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

| Setting                  | Description                                             | Default                        |
| ------------------------ | ------------------------------------------------------- | ------------------------------ |
| `production`             | Enable production mode                                  | `false`                        |
| `logLevel`               | Logging verbosity ('DEBUG', 'INFO', 'WARNING', 'ERROR') | `'ERROR'`                      |
| `apiUrl`                 | API server URL                                          | `'https://api.example.com/v1'` |
| `authTokenExpiryMinutes` | Authentication token validity                           | `60`                           |
| `operatorName`           | Name of service operator                                | `'TMI Operator'`               |
| `operatorContact`        | Contact information                                     | `'contact@example.com'`        |
| `serverPort`             | Server listening port                                   | `4200`                         |
| `serverInterface`        | Server listening interface                              | `'0.0.0.0'`                    |
| `enableTLS`              | Enable HTTPS                                            | `false`                        |
| `tlsKeyPath`             | Path to TLS private key                                 | `undefined`                    |
| `tlsCertPath`            | Path to TLS certificate                                 | `undefined`                    |
| `tlsSubjectName`         | TLS subject name                                        | System hostname                |

## Building

```bash
# Production build
pnpm run build:prod

# Staging build
pnpm run build:staging

# Test build
pnpm run build:test
```

## Code Quality

```bash
# Run linting
pnpm run lint

# Run SCSS linting
pnpm run lint:scss

# Run all linting
pnpm run lint:all

# Format code
pnpm run format

# Check formatting
pnpm run format:check

# Run all checks
pnpm run check
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
ng test --include=**/path/to/file.spec.ts

# Run tests for a specific component
ng test --include=**/component-name/*.spec.ts
```
