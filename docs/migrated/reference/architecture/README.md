# Architecture Documentation

Comprehensive architecture documentation for TMI-UX, covering architectural principles, patterns, standards, and analysis.

## Architecture Overview

- **[overview.md](overview.md)** - Complete architecture guide with principles, layer boundaries, and module organization
- **[validation.md](validation.md)** - How to validate architecture compliance and run architecture checks
- **[violations.md](violations.md)** - Known architecture violations and resolution plans

## Standards and Conventions

- **[service-provisioning.md](service-provisioning.md)** - Standards for where and how to provide Angular services
- **[naming-conventions.md](naming-conventions.md)** - File naming standards, patterns, and organizational conventions

## Specific Subsystems

- **[session-management.md](session-management.md)** - Session and authentication architecture
- **[autosave-data-modeling.md](autosave-data-modeling.md)** - Auto-save mechanism, data modeling, and memory caching architecture
- **[dfd-change-propagation/](dfd-change-propagation/)** - Detailed analysis of DFD change propagation architecture (8 documents)

## Quick Reference

### For New Developers

Start with [overview.md](overview.md) to understand the overall architecture, then review [service-provisioning.md](service-provisioning.md) for service patterns.

### For Contributors

Review [validation.md](validation.md) to ensure your changes comply with architecture standards, and check [naming-conventions.md](naming-conventions.md) for file organization.

### For Architects

Study the complete [overview.md](overview.md), examine [dfd-change-propagation/](dfd-change-propagation/) for complex subsystem analysis, and monitor [violations.md](violations.md) for known issues.

## Related Documentation

- [Libraries Reference](../libraries/) - Third-party library integration guides
- [Features Reference](../features/) - Feature implementation documentation
- [Developer Setup](../../developer/setup/) - Environment and project setup
- [Agent Context](../../agent/) - AI agent implementation guides

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- overview.md: File exists at docs/reference/architecture/overview.md
- validation.md: File exists at docs/reference/architecture/validation.md
- violations.md: File exists at docs/reference/architecture/violations.md
- service-provisioning.md: File exists at docs/reference/architecture/service-provisioning.md
- naming-conventions.md: File exists at docs/reference/architecture/naming-conventions.md
- session-management.md: File exists at docs/reference/architecture/session-management.md
- autosave-data-modeling.md: File exists at docs/reference/architecture/autosave-data-modeling.md
- dfd-change-propagation/: Directory exists with 8 markdown files (count verified)
- ../libraries/: Directory exists at docs/reference/libraries/
- ../features/: Directory exists at docs/reference/features/
- ../../developer/setup/: Directory exists at docs/developer/setup/
- ../../agent/: Directory exists at docs/agent/

Items needing review:
- None - all references verified successfully
-->
