# AGENTS.md

This file provides guidance to AI coding assistants like Claude Code, Cline, Roo Code, and others, when working with code in this repository.

## API and Backend

- Backend API specification is available in `shared-api/api-specs/tmi-openapi.json` (shared subtree from TMI repository)
- WebSocket API specification is available in `shared-api/api-specs/tmi-asyncapi.yaml`
- Local development server runs at http://localhost:4200
- API URL is configured in environment files (e.g., environment.dev.ts)
- Authentication and authorization details are documented in `shared-api/docs/AUTHORIZATION.md`
- Client integration guide is available in `shared-api/docs/CLIENT_INTEGRATION_GUIDE.md`
- OAuth integration details are in `shared-api/docs/CLIENT_OAUTH_INTEGRATION.md`
- The server uses a role-based access control model with Owner, Writer, and Reader roles
- Authorization middleware enforces permissions for object access and modification

## Build/Test Commands

- Run all pnpm commands from the project root directory
  - Always cd to the project root directory before running a pnpm command
- Development server: `pnpm run dev`
- Production build: `pnpm run build:prod`
- Run all tests: `pnpm run test`
- Run single test: `pnpm run test relative/path/to/file.spec.ts`
- Run tests for specific component: `pnpm run test <componentname>` (currently supported for tm, dfd)
- Focus tests in code: Use `describe.only()` and `it.only()` in spec files
- Lint TypeScript/HTML: `pnpm run lint`
- Lint SCSS: `pnpm run lint:scss`
- Lint all files: `pnpm run lint:all`
- Format code: `pnpm run format`
- Check formatting: `pnpm run format:check`
- Check all (lint+format): `pnpm run check`

## Architecture Overview

### Framework and Technology Stack

- Angular 20+ with standalone components pattern
- AntV X6 graphing library for data flow diagrams (DFD)
- Vitest with AnalogJS Vite plugin for unit testing
  - The code does not use Jasmine test syntax anywhere, only native Vitest
- Cypress for E2E and component testing
- Angular Material for UI components
- Transloco for internationalization
- SCSS for styling with BEM-like conventions

### Module Structure

- **Core Module**: Shared components (navbar, footer), services (API, logger)
- **Auth Module**: Authentication guards, interceptors, OAuth providers
- **Shared Module**: Material modules, common utilities
- **Feature Modules**: Domain-specific functionality (TM, DFD, About, etc.)

### Data Flow Diagram (DFD) Architecture

The DFD module uses a sophisticated layered architecture based on Domain-Driven Design principles:

#### Domain Layer
- **Value Objects**: Core domain entities and business logic
  - `NodeInfo`, `EdgeInfo`: Domain value objects for diagram entities
  - `DiagramInfo`: Aggregate root for diagram state
  - Domain events for state changes and business rules
- **Business Logic**: Pure domain logic without infrastructure dependencies
  - Validation rules, business constraints, and domain operations
  - Immutable value objects with rich behavior

#### Infrastructure Layer
- **X6 Core Operations**: Low-level X6 graph abstraction
  - `X6CoreOperationsService`: Centralized X6 API wrapper for atomic operations
  - Direct X6 calls isolated to this service only
  - Handles graph manipulation, cell creation/removal, and X6-specific operations
- **X6 Adapters**: Feature-specific X6 integrations
  - `X6GraphAdapter`: Main X6 integration and graph management
  - `X6SelectionAdapter`: Selection behavior and visual feedback
  - `X6HistoryManager`, `X6ZOrderAdapter`: Specialized adapters for specific features
  - All adapters delegate to either X6CoreOperationsService or domain services
- **Infrastructure Services**: Technical concerns and X6 coordination
  - Visual effects, embedding, port state management
  - Query services for X6 graph introspection

#### Application Layer
- **Domain Services**: Business operation coordination
  - `EdgeService`: Edge business logic, validation, and port visibility management
  - `DfdNodeService`: Node business logic and lifecycle management
  - These services use X6CoreOperationsService for infrastructure operations
- **Facade Services**: Application coordination and workflow orchestration
  - `DfdFacadeService`: Main application service
  - `DfdDiagramService`: Diagram-level operations and persistence
- **Service Delegation Pattern**: 
  - Infrastructure adapters delegate business operations to domain services
  - Domain services delegate low-level operations to X6CoreOperationsService
  - Clear separation between UI operations (adapters) and business operations (services)

#### Components Layer
- **UI Components**: User interface and interaction handling
  - Real-time collaboration with WebSocket integration
  - Cell property dialogs and user presence indicators
  - Component-level state management and user event handling

#### Architectural Principles
- **Dependency Direction**: Infrastructure → Application → Domain (no reverse dependencies)
- **Service Delegation**: Adapters use domain services for business logic, X6CoreOperationsService for infrastructure
- **Separation of Concerns**: UI operations vs business operations clearly distinguished
- **Testability**: Each layer can be tested independently with appropriate mocks

### Authentication System

- OAuth 2.0 with configurable providers
  - Local Development Provider for testing does not require an OAuth server
- JWT tokens with automatic refresh
- Role-based access control (Owner, Writer, Reader)
- Local development provider for testing
- Session management with automatic cleanup

### State Management

- Service-based state management pattern
- RxJS observables for reactive data flow
- NgRx-style state objects in some modules (`dfd.state.ts`)
- Event-driven architecture for DFD collaboration

## Code Style

- Indentation: 2 spaces
- Quotes: single quotes for TypeScript
- Max line length: 100 characters
- TypeScript: strict mode enabled with ES modules
- Components: app-prefix selectors, SCSS for styles, OnPush change detection
- Import order: Angular core → Angular modules → Third-party → Project modules
- Observables: Use $ suffix
- Private members: Use \_ prefix
- Error handling: Use catchError with LoggerService
- Type annotations: Use throughout (explicit function return types)
- No explicit any: Avoid using 'any' type
- Documentation: JSDoc style comments
- Services: Provided in root, constructor-based DI
- Subscription management: Initialize as null, unsubscribe in ngOnDestroy
- No console.log: Use LoggerService instead

## Testing Strategy

### Unit Testing (Vitest)

- All services and utilities should have unit tests
- Components tested with Angular Testing Library patterns
- Mock external dependencies
- Coverage reporting enabled

### Integration Testing (Cypress)

- DFD module has comprehensive integration tests
- Tests real X6 graph operations without mocking
- Focuses on styling persistence and state management
- Visual regression testing for graph components

### Test Organization

- Unit tests: `*.spec.ts` files alongside source
- Integration tests: `integration/` directories within modules
- E2E tests: `cypress/e2e/` directory
- Component tests: Cypress component testing enabled

## Environment Configuration

- Multiple environment files in `src/environments/`
- Interface defined in `environment.interface.ts`
- Supports OAuth provider configuration
- TLS/HTTPS configuration for production
- Component-specific debug logging available

## User Preferences

- When starting, run the appropriate tool to list the files in the context directory and the docs directory.
  - Read the README.md file in each of those directories to discover what each file is for.
  - Read any of context or docs files that are relevant to the current prompt.
- When making changes to any file:
  - Always run lint with "pnpm run lint:all" and fix any lint errors or warnings related to changes you made
    - When fixing lint issues about unused items, remove the unused item rather than prefixing with an underscore, unless the item is commented as a placeholder for future functionality
- In addition, when making a change to any file containing executable code:
  - Run a build with "pnpm run build" and fix any build errors
  - Run the related tests with the vitest CLI and fix any test errors related to the change
  - Never complete a task if there are any remaining build errors
- If the file was a test file, run the test using the proper vitest CLI syntax and fix any test errors.
- Never disable or skip tests or suppress test errors. If you encounter a test error, fix the test or the code that is causing the error, or ask the user for guidance
- Always stop and prompt the user before running the application. The user usually already has an instance of the application running on http://localhost:4200
