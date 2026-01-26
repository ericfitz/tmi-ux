# Security Reference Documentation

Security implementation documentation for TMI-UX.

## Contents

### HTTP Security Headers

- **[headers.md](headers.md)** - HTTP security header implementation
  - Content Security Policy (CSP)
  - Cross-Origin Resource Sharing (CORS)
  - Security-related headers
  - Configuration and testing

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Security in overall architecture
- [Session Management](../architecture/session-management.md) - Authentication and authorization

<!-- NEEDS-REVIEW: The following links were removed as /shared-api/docs/ does not exist in this repository.
     API and authorization documentation is maintained in the server repository (docs-server/).
     See .claude/CLAUDE.md for current API documentation paths. -->

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- headers.md: File exists at docs/reference/security/headers.md
- ../architecture/overview.md: File exists at docs/reference/architecture/overview.md, contains security guidelines section
- ../architecture/session-management.md: File exists at docs/reference/architecture/session-management.md

Items needing review:
- /shared-api/docs/: Directory does not exist in tmi-ux repository (removed link)
- /shared-api/docs/AUTHORIZATION.md: File does not exist in tmi-ux repository (removed link)
- API documentation paths: Per .claude/CLAUDE.md, API docs are at docs-server/reference/architecture/AUTHORIZATION.md (separate repo)
-->
