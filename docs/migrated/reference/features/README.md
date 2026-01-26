# Features Reference Documentation

Technical documentation for major features implemented in TMI-UX.

## Contents

### Collaborative Editing

- **[collaborative-editing.md](collaborative-editing.md)** - Real-time collaborative editing implementation
  - WebSocket communication architecture
  - State synchronization
  - Conflict resolution
  - Presence and awareness
  - Permission management

### Data Flow Diagram (DFD) Editor

- **[dfd-user-interaction-guide.md](dfd-user-interaction-guide.md)** - User interaction patterns for the DFD editor
  - Node and edge manipulation
  - Selection and multi-select
  - Keyboard shortcuts
  - Context menus
  - Visual feedback

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Overall application architecture
- [DFD Change Propagation](../architecture/dfd-change-propagation/) - Detailed DFD architecture analysis
- [X6 Complete Guide](../libraries/x6-complete-guide.md) - Graph library integration
- [Session Management](../architecture/session-management.md) - Authentication and session handling

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- collaborative-editing.md: File exists at docs/reference/features/collaborative-editing.md
- dfd-user-interaction-guide.md: File exists (corrected from dfd-graph-interaction.md)
- ../architecture/overview.md: File exists at docs/reference/architecture/overview.md
- ../architecture/dfd-change-propagation/: Directory exists with 8 files
- ../libraries/x6-complete-guide.md: File exists at docs/reference/libraries/x6-complete-guide.md
- ../architecture/session-management.md: File exists at docs/reference/architecture/session-management.md

Corrections made:
- Fixed reference from dfd-graph-interaction.md to dfd-user-interaction-guide.md (actual filename)

Items needing review:
- None
-->
