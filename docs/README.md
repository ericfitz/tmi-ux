# TMI-UX Documentation

Welcome to the TMI-UX documentation. This directory contains comprehensive documentation for developers, architects, and contributors.

## 📚 Documentation Structure

### Architecture Documentation
- **[Architecture Guide](ARCHITECTURE.md)** - Complete architecture overview, principles, and patterns
- **[Architecture Decision Records](adr/)** - Key architectural decisions with context and rationale
- **[Architecture Validation](ARCHITECTURE_VALIDATION.md)** - How to validate architecture compliance
- **[Architecture TODO](ARCHITECTURE_TODO.md)** - Remaining architectural improvements
- **[Architecture Violations](ARCHITECTURE_VIOLATIONS.md)** - Known violations and resolution plans

### Development Standards
- **[Service Provisioning Standards](SERVICE_PROVISIONING_STANDARDS.md)** - How and where to provide services
- **[Naming Conventions](NAMING_CONVENTIONS.md)** - File naming standards and patterns
- **[Security Headers](SECURITY_HEADERS.md)** - HTTP security header implementation

### Performance & Optimization
- **[Bundle Size Analysis](BUNDLE_SIZE_ANALYSIS.md)** - Bundle optimization and tree-shaking results

### Technical Guides
- **[Complete X6 Guide](X6_COMPLETE_GUIDE.md)** - Comprehensive X6 graph library documentation
- **[WebSocket Collaboration](WEBSOCKET_COLLABORATION.md)** - Real-time collaboration implementation

### Implementation Plans
- **[Enhanced Save Behavior](enhanced-save-behavior-implementation-plan.md)** - Auto-save functionality design
- **[Autosave Data Modeling](autosave-data-modeling-architecture.md)** - Data architecture for auto-save

### Diagrams
- **authentication-component-architecture.png** - High level architecture diagram of authentication components
- **authentication-flow.png** - OAuth authentication flow swimlane diagram

## 🗺️ Quick Navigation

### For New Developers
1. Start with [CLAUDE.md](../CLAUDE.md) - AI assistant guidance
2. Read the [Architecture Guide](ARCHITECTURE.md)
3. Review [Service Provisioning Standards](SERVICE_PROVISIONING_STANDARDS.md)
4. Check [Naming Conventions](NAMING_CONVENTIONS.md)

### For Contributors
1. Review relevant [ADRs](adr/) for context
2. Follow [Architecture Validation](ARCHITECTURE_VALIDATION.md) guidelines
3. Update [Architecture TODO](ARCHITECTURE_TODO.md) when completing tasks

### For Architects
1. Browse [Architecture Decision Records](adr/)
2. Review [Architecture Guide](ARCHITECTURE.md)
3. Monitor [Bundle Size Analysis](BUNDLE_SIZE_ANALYSIS.md)

## 📂 Other Documentation Locations

### Context Directory (`/context`)
Developer-specific implementation details:
- DFD (Data Flow Diagram) implementation guides
- Collaborative editing design
- Integration testing approaches
- API references

### Source Documentation
- `/src/app/core/services/README.md` - Core services overview
- `/src/app/pages/tm/validation/VALIDATION_USAGE.md` - Validation framework guide
- `/src/environments/README.md` - Environment configuration
- `/src/testing/README.md` - Testing guidelines

### Root Documentation
- `/README.md` - Project overview and setup
- `/CLAUDE.md` - AI assistant instructions
- `/AGENTS.md` - Additional AI agent guidance

## 📝 Documentation Guidelines

### When to Update Documentation
- After making architectural decisions
- When implementing new patterns
- After completing major features
- When deprecating existing approaches

### Documentation Standards
1. Use clear, concise language
2. Include code examples where helpful
3. Keep documentation close to code
4. Update the index when adding new docs
5. Cross-reference related documentation

### Documentation Review
All documentation should be:
- Technically accurate
- Up-to-date with current implementation
- Free from duplication
- Easy to navigate

## 🔍 Finding Information

### By Topic
- **Architecture**: Start with [ARCHITECTURE.md](ARCHITECTURE.md)
- **Services**: See [SERVICE_PROVISIONING_STANDARDS.md](SERVICE_PROVISIONING_STANDARDS.md)
- **Testing**: Check `/src/testing/README.md`
- **Security**: Review [SECURITY_HEADERS.md](SECURITY_HEADERS.md)

### By Role
- **Frontend Developer**: Focus on component patterns in [ARCHITECTURE.md](ARCHITECTURE.md)
- **Backend Integration**: Review API docs in `/shared-api/docs/`
- **DevOps**: Check environment setup in `/src/environments/README.md`

## 🤝 Contributing to Documentation

1. Follow the existing format and style
2. Update relevant indexes and cross-references
3. Ensure no duplication of content
4. Keep technical accuracy as priority
5. Submit documentation updates with code changes

For questions or suggestions about documentation, please create an issue or reach out to the team.
