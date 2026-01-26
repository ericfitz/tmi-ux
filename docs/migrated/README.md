# TMI-UX Documentation

Welcome to the TMI-UX documentation. This directory contains comprehensive documentation organized by audience and purpose.

## 📚 Documentation Structure

### Reference Documentation (`reference/`)

#### Architecture (`reference/architecture/`)

- **[overview.md](reference/architecture/overview.md)** - Complete architecture overview, principles, and patterns
- **[validation.md](reference/architecture/validation.md)** - How to validate architecture compliance
- **[violations.md](reference/architecture/violations.md)** - Known violations and resolution plans
- **[service-provisioning.md](reference/architecture/service-provisioning.md)** - How and where to provide services
- **[naming-conventions.md](reference/architecture/naming-conventions.md)** - File naming standards and patterns
- **[session-management.md](reference/architecture/session-management.md)** - Session and authentication architecture
- **[autosave-data-modeling.md](reference/architecture/autosave-data-modeling.md)** - Auto-save data architecture
- **[dfd-change-propagation/](reference/architecture/dfd-change-propagation/)** - DFD change propagation analysis

#### Libraries (`reference/libraries/`)

- **[x6-complete-guide.md](reference/libraries/x6-complete-guide.md)** - Comprehensive X6 graph library documentation

#### Features (`reference/features/`)

- **[collaborative-editing.md](reference/features/collaborative-editing.md)** - Real-time collaboration implementation
- **[dfd-graph-interaction.md](reference/features/dfd-graph-interaction.md)** - DFD user interaction guide

#### Security (`reference/security/`)

- **[headers.md](reference/security/headers.md)** - HTTP security header implementation

### Developer Documentation (`developer/`)

#### Setup (`developer/setup/`)

- **[environment-configuration.md](developer/setup/environment-configuration.md)** - Environment setup and configuration
- **[core-services.md](developer/setup/core-services.md)** - Core services overview
- **[import-constants.md](developer/setup/import-constants.md)** - Import constant patterns

#### Testing (`developer/testing/`)

- **[testing-utilities.md](developer/testing/testing-utilities.md)** - Testing utilities and patterns

#### Features (`developer/features/`)

- **[validation-framework.md](developer/features/validation-framework.md)** - Validation framework usage

### AI Agent Documentation (`agent/`)

Context and implementation guides for AI coding agents:

- **[README.md](agent/README.md)** - Agent documentation index
- **[collaboration-participant-list-ux-design.md](agent/collaboration-participant-list-ux-design.md)** - Collaboration UX design
- **[dfd-integration-testing-approach.md](agent/dfd-integration-testing-approach.md)** - DFD integration testing strategy
- **[dfd-integration-test-plan.md](agent/dfd-integration-test-plan.md)** - DFD integration test plan
- **[developers-guide-antvx6-graphing-library.md](agent/developers-guide-antvx6-graphing-library.md)** - X6 developer guide
- **[interesting-x6-events.txt](agent/interesting-x6-events.txt)** - X6 event samples
- **[pdf-report-diagram-rendering-design.md](agent/pdf-report-diagram-rendering-design.md)** - PDF diagram rendering design

### Root-Level Documentation

- **[README.md](README.md)** - Documentation index (this file)
- **authentication-component-architecture.png** - Authentication component architecture diagram
- **authentication-flow.png** - OAuth authentication flow diagram
- Other diagrams and supporting files

## 🗺️ Quick Navigation

### For New Developers

1. Start with [/CLAUDE.md](../CLAUDE.md) - AI assistant guidance and project overview
2. Read the [Architecture Guide](reference/architecture/overview.md)
3. Review [Service Provisioning Standards](reference/architecture/service-provisioning.md)
4. Check [Environment Configuration](developer/setup/environment-configuration.md)

### For Contributors

1. Review [Architecture Validation](reference/architecture/validation.md) guidelines
2. Check [Naming Conventions](reference/architecture/naming-conventions.md)
3. Follow [Testing Utilities](developer/testing/testing-utilities.md) patterns

### For Architects

1. Review [Architecture Guide](reference/architecture/overview.md)
2. Examine [DFD Change Propagation](reference/architecture/dfd-change-propagation/) analysis
3. Study [Session Management](reference/architecture/session-management.md) architecture

### For AI Agents

1. Start with [Agent Documentation](agent/README.md)
2. Review relevant implementation guides
3. Check test plans and design documents

## 📝 Documentation Guidelines

### When to Update Documentation

- After making architectural decisions
- When implementing new patterns
- After completing major features
- When deprecating existing approaches

### Documentation Standards

1. Use clear, concise language
2. Include code examples where helpful
3. Update indexes when adding new docs
4. Cross-reference related documentation
5. Use lowercase filenames (except README.md and special files)

### Documentation Organization

- **reference/** - Technical reference and architecture documentation
- **developer/** - Setup guides, testing, and feature implementation
- **agent/** - AI agent context and implementation plans

## 🔍 Finding Information

### By Topic

- **Architecture**: Start with [overview.md](reference/architecture/overview.md)
- **Services**: See [service-provisioning.md](reference/architecture/service-provisioning.md)
- **Testing**: Check [testing-utilities.md](developer/testing/testing-utilities.md)
- **Security**: Review [headers.md](reference/security/headers.md)
- **Collaboration**: See [collaborative-editing.md](reference/features/collaborative-editing.md)

### By Role

- **Frontend Developer**: Focus on [overview.md](reference/architecture/overview.md) and [developer/](developer/)
- **Backend Integration**: Review API docs in `/shared-api/docs/`
- **DevOps**: Check [environment-configuration.md](developer/setup/environment-configuration.md)
- **AI Agents**: Use [agent/](agent/) documentation

## 🤝 Contributing to Documentation

1. Follow the existing format and style
2. Use lowercase filenames (except README.md and special files like LICENSE.txt)
3. Update relevant indexes and cross-references
4. Ensure no duplication of content
5. Keep technical accuracy as priority
6. Submit documentation updates with code changes

For questions or suggestions about documentation, please create an issue or reach out to the team.
