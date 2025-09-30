# AI Agent Documentation

## Overview

This directory contains context and implementation guidance for AI coding agents working on this project. These documents include architecture proposals, implementation plans, design documents, and technical context not intended for end users.

For user-facing documentation, see the parent [docs/](../) directory.

## Current Directory Contents

AI assistants should update this list when adding or removing files.

### Design and Planning Documents

- **collaboration-participant-list-ux-design.md**
  UX design for collaboration participant list feature

- **pdf-report-diagram-rendering-design.md**
  Design document for pre-rendered diagram storage to enable full diagram inclusion in PDF reports using stored PNG/SVG images

### Testing Documentation

- **dfd-integration-testing-approach.md**
  Integration testing approach for DFD services to eliminate mock logic duplication and improve test reliability

- **dfd-integration-test-plan.md**
  Comprehensive integration test plan for the DFD graph component using real X6 graph operations, designed to catch styling and state issues

### Implementation Guides

- **developers-guide-antvx6-graphing-library.md**
  Developer guide for working with the AntV X6 graphing library

### Reference Information

- **interesting-x6-events.txt**
  Log samples of X6 graph events showing actual event data for node operations, edge connections, selection changes, and data modifications

## Related Documentation

### Architecture Documentation
See [../reference/architecture/](../reference/architecture/) for:
- Architecture overview and principles
- Service provisioning standards
- Naming conventions
- Session management
- DFD change propagation analysis

### Developer Documentation
See [../developer/](../developer/) for:
- Environment configuration
- Testing utilities
- Core services setup
- Feature implementation guides

### Technical References
See [../reference/](../reference/) for:
- X6 complete guide
- Collaborative editing implementation
- Security headers
- Feature documentation

## Usage Guidelines for AI Agents

1. **Implementation Plans**: Use this directory for storing implementation plans, progress tracking, and design documents
2. **Context Documents**: Store technical context and background information here
3. **Testing Strategies**: Document testing approaches and plans
4. **Research Notes**: Keep research findings and technical analysis here

## Files Moved to New Locations

The documentation structure has been reorganized. Previous files have been moved to:

- API documentation → `/shared-api/docs/`
- Architecture documentation → `../reference/architecture/`
- Feature documentation → `../reference/features/`
- Developer guides → `../developer/`
