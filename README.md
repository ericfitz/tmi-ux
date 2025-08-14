# TMI UX

Angular-based user interface for the TMI application.

## Overview & Benefits

TMI (Threat Modeling Improved) is a server based threat modeling web application.

- TMI makes threat modeling **easier and more accurate** with real-time colloboration
- TMI makes threat modeling **faster and less toilsome** with agent-driven or agent-assisted threat model creation
- TMI uses **your workflows** - it fits into your existing security tool chains

## Features

- Full REST API - threat models and their associated data flow diagrams (DFDs) and threats are human- and machine-readable and editable
  - OpenAPI 3.0 specification
- Threats, threat models, diagrams and objects can be extended with arbitrary key-value metadata
- Real-time collaborative diagram editing
- Role-based access control (reader, writer, owner)
- OAuth authentication with configurable OAuth providers
- Supports multiple threat model frameworks (STRIDE, CIA, etc.)
- Supports integration with issue tracking systems
- Apache licensed for customizability
- LLM & agentic functionality will be a separate component under a different license

The associated back-end server, written in Go, is called [TMI](https://github.com/ericfitz/tmi).

## Shared Resources

This repository includes shared resources from the TMI backend repository via git subtree:

- **Location**: `shared-api/` directory
- **Source**: Subtree from the [TMI repository](https://github.com/ericfitz/tmi)
- **Contents**:
  - **API Specifications**: OpenAPI 3.0 REST API spec and AsyncAPI WebSocket spec
  - **Documentation**: Client integration guides, OAuth setup, authorization patterns
  - **SDK Examples**: Reference implementations (Python SDK)

### Key Shared Files

- `shared-api/api-specs/tmi-openapi.json` - OpenAPI 3.0 REST API specification
- `shared-api/api-specs/tmi-asyncapi.yaml` - AsyncAPI WebSocket specification  
- `shared-api/docs/AUTHORIZATION.md` - Authorization and RBAC documentation
- `shared-api/docs/CLIENT_INTEGRATION_GUIDE.md` - Complete client integration guide
- `shared-api/docs/CLIENT_OAUTH_INTEGRATION.md` - OAuth setup and configuration

### Updating Shared Resources

To pull the latest shared resources from the TMI repository:

```bash
git subtree pull --prefix=shared-api https://github.com/ericfitz/tmi.git shared --squash
```

## Demo Videos

NEW! [Demo 2025-08-05](https://youtu.be/dH9V-7fmbLI) Walkthrough of all basic functionality with voiceover

Older

1. [Demo 2025-05-16](https://youtu.be/ikTxE0xJL1w) Shows localization, basic functionality
2. [Demo 2025-05-20](https://youtu.be/quOBYdKNx2E) Shows detailed threat editing

**Note:** Documentation about architecture, implementation plans, and development guidelines can be found in the [context](./context) and [docs](./docs) directories. Authorization details are documented in [AUTHORIZATION.md](./docs/AUTHORIZATION.md) and collaborative editing information in [COLLABORATIVE_EDITING.md](./docs/COLLABORATIVE_EDITING.md).

## Development

### Prerequisites

- Node.js (latest LTS version recommended)
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
   pnpm run dev:local    # Uses environment.local.ts file
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
- `environment.local.ts` - Local development environment
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

The project uses Vitest with the AnalogJS Vite plugin for Angular testing. This provides faster test execution, better developer experience, and improved integration with the Vite build system. Cypress is used for end-to-end and component testing.

```bash
# Run all tests
pnpm test

# Run tests in watch mode (automatically re-runs on file changes)
pnpm run test:watch

# Run tests with the Vitest UI
pnpm run test:ui

# Generate test coverage report
pnpm run test:coverage

# Run tests for a specific component
pnpm run test:component
# or specify any test file
vitest run "src/app/path/to/file.spec.ts"

# Run end-to-end tests
pnpm run test:e2e

# Run end-to-end tests with UI
pnpm run test:e2e:open

# Run component tests with Cypress
pnpm run test:e2e:component

# Run component tests with Cypress UI
pnpm run test:e2e:component:open
```

### Test Strategy

- **Unit Tests**: All components, services, and utilities should have unit tests (Vitest)
- **Integration Tests**: Key component interactions should be tested
- **Component Tests**: UI components are tested with Cypress component testing
- **End-to-End Tests**: Critical user flows are tested with Cypress
- **Test Environment**: Unit tests run in a JSDOM environment (confirmed in vitest.config.ts)
- **Coverage Reporting**: Coverage reports are generated in both text and HTML formats

### Focusing Tests

To focus on specific tests during development:

```typescript
// Focus on a specific test
it.only('should do something', () => {
  // Test code
});

// Focus on a specific test suite
describe.only('Component', () => {
  // Test suites and specs
});
```
