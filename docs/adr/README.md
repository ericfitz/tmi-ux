# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the TMI-UX project. ADRs document significant architectural decisions made during the project's development.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why certain decisions were made.

## ADR Format

Each ADR follows this template:
- **Title**: ADR-NNN: Brief decision title
- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Date**: When the decision was made
- **Context**: Why we needed to make this decision
- **Decision**: What we decided to do
- **Consequences**: What happens as a result (positive and negative)
- **Implementation**: How we implemented the decision
- **References**: Links to relevant documentation

## Current ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-standalone-components.md) | Adopt Angular Standalone Components | Accepted | 2025-09-05 |
| [002](002-service-provisioning-patterns.md) | Service Provisioning Patterns | Accepted | 2025-09-05 |
| [003](003-abstraction-layer-pattern.md) | Abstraction Layer for Cross-Cutting Concerns | Accepted | 2025-09-05 |
| [004](004-websocket-communication-patterns.md) | WebSocket Communication Patterns | Accepted | 2025-09-05 |

## Creating a New ADR

1. Copy the template from an existing ADR
2. Number it sequentially (e.g., 005-your-decision.md)
3. Fill in all sections
4. Update this README with the new ADR
5. Submit for review via pull request

## References

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR Tools](https://github.com/npryce/adr-tools)
- [ADR GitHub Organization](https://adr.github.io/)