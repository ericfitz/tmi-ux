# TMI-UX Schema Files

This directory contains schema and API documentation files discovered during the security code analysis.

## Files

### Threat Modeling Frameworks (JSON)

These are threat framework definitions used by the TMI application for categorizing threats:

- **stride.json** - STRIDE threat model framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
- **linddun.json** - LINDDUN privacy threat framework
- **cia.json** - CIA triad framework (Confidentiality, Integrity, Availability)
- **die.json** - DIE framework
- **plot4ai.json** - PLOT4AI AI/ML-specific threat framework

**Source:** `/app/repos/tmi-ux/src/assets/frameworks/`

### Backend API Schema (TypeScript)

- **tmi-backend-api-types.d.ts** (1.0MB) - Complete TypeScript type definitions for the TMI backend API

**Details:**
- 28,793 lines of TypeScript type definitions
- Generated from OpenAPI specification
- Source OpenAPI Schema: https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json
- Documents 130+ REST API endpoints
- Generation command: `openapi-typescript {OPENAPI_SPEC} -o src/app/generated/api-types.d.ts`

**Original Location:** `/app/repos/tmi-ux/src/app/generated/api-types.d.ts`

## Security Notes

These schema files are critical for understanding the application's attack surface:

1. **Framework schemas** define the threat categories used in threat modeling
2. **API types** document all backend endpoints, request/response formats, and authentication requirements
3. **Entry Point Analysis** should reference the api-types file to understand the complete API surface

## Usage in Penetration Testing

- Use `tmi-backend-api-types.d.ts` to identify all API endpoints for testing
- Framework schemas show the threat classification system used by the application
- API types include authentication requirements for each endpoint
- Look for endpoints marked as `Admin` or `Reviewer` for authorization testing

## Related Documentation

See the main deliverable: `/deliverables/code_analysis_deliverable.md`
- Section 5: Attack Surface Analysis (references these schemas)
- Section 8: Critical File Paths (lists schema locations)
