![Logo](public/TMI-Logo-512x512.png)

# TMI UX

Angular-based user interface for the TMI application.

Try it yourself at [https://www.tmi.dev](https://www.tmi.dev)\
API Server available at [https://github.com/ericfitz/tmi](https://github.com/ericfitz/tmi)\
API clients available at [https://github.com/ericfitz/tmi-clients](https://github.com/ericfitz/tmi-clients)

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
- Take notes manually or with automation using markdown, including Mermaid graph support
- Apache licensed for customizability

The associated back-end server, written in Go, is called [TMI](https://github.com/ericfitz/tmi).

## Documentation

Comprehensive documentation is organized as follows:

### 📚 Main Documentation Hub

- **[/docs](docs/)** - Central documentation directory with guides, standards, and decision records

## Development (this is how you can play with it now)

### Prerequisites

- Clone this repo and change to the repo root
- [Download](https://nodejs.org/en/download/) and install **Node.js** (latest LTS version recommended; I use 20.19.2)
- Download and [Install](https://pnpm.io/installation) **pnpm**

### Setup

```bash
# Install dependencies
pnpm install

# Start application server
pnpm run dev
```

### Environment Configuration

The application supports multiple environment configurations:

1. **Default Configuration**

   ```bash
   pnpm run dev  # Uses environment.ts file; this starts the app listening on port 4200
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

- `environment.ts` - Default environment
- `environment.dev.ts` - Development environment (when configured)
- `environment.local.ts` - Local development environment
- `environment.prod.ts` - Production environment
- `environment.staging.ts` - Staging environment
- `environment.test.ts` - Test environment
- `environment.example.ts` - Example with documentation

To create a custom environment:

1. Copy `environment.example.ts` to a new file (e.g., `environment.custom.ts`)
2. Configure values as needed - at a minimum you need to configure apiUrl to your development TMI server, typically http://localhost:8080
3. Update `angular.json` with a new configuration if needed

### Available Environment Settings

| Setting                  | Description                                          | Default                        |
| ------------------------ | ---------------------------------------------------- | ------------------------------ |
| `production`             | Enable production mode                               | `false`                        |
| `logLevel`               | Logging verbosity ('DEBUG', 'INFO', 'WARN', 'ERROR') | `'ERROR'`                      |
| `apiUrl`                 | API server URL                                       | `'https://api.example.com/v1'` |
| `authTokenExpiryMinutes` | Authentication token validity                        | `60`                           |
| `operatorName`           | Name of service operator                             | `'TMI Operator'`               |
| `operatorContact`        | Contact information                                  | `'contact@example.com'`        |
| `serverPort`             | Server listening port                                | `4200`                         |
| `serverInterface`        | Server listening interface                           | `'0.0.0.0'`                    |
| `enableTLS`              | Enable HTTPS                                         | `false`                        |
| `tlsKeyPath`             | Path to TLS private key                              | `undefined`                    |
| `tlsCertPath`            | Path to TLS certificate                              | `undefined`                    |
| `tlsSubjectName`         | TLS subject name                                     | System hostname                |

## Building & testing

```bash
# Development build
pnpm run build

# Production build
pnpm run build:prod
```

All important commands for building, linting, testing, file validation, and a lot of utilities are exposed through `pnpm` scripts.

Get a list of pnpm scripts with `pnpm run`.

# test
