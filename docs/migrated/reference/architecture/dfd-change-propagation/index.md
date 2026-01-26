# DFD Change Propagation Architecture - Documentation Index

This comprehensive documentation analyzes how changes to the Data Flow Diagram (DFD) graph propagate through the TMI-UX system. The analysis reveals a complex architecture with multiple pathways for handling different types of operations.

## Quick Start

1. **[README.md](./README.md)** - Start here for an overview of the architecture and key concerns
2. **[User Actions Flow](./user-actions-flow.md)** - Understand how user interactions propagate through the system
3. **[Change Propagation Matrix](./change-propagation-matrix.md)** - See which systems are affected by different operations
4. **[Architectural Issues](./architectural-issues.md)** - Review identified problems and improvement recommendations

## Complete Documentation

### Flow Diagrams

- **[User Actions Flow](./user-actions-flow.md)** - User interactions (drag, add, delete) and their complete propagation paths
- **[Collaborative Operations Flow](./collaborative-operations-flow.md)** - WebSocket message handling and real-time synchronization
- **[Auto-save Decision Tree](./autosave-decision-tree.md)** - When and how different triggers lead to saves
- **[Visual Effects Pipeline](./visual-effects-pipeline.md)** - How styling and animations are applied without affecting history

### Analysis Documents

- **[Change Propagation Matrix](./change-propagation-matrix.md)** - Comprehensive mapping of operations to affected systems
- **[Architectural Issues](./architectural-issues.md)** - Problems identified and detailed improvement recommendations

## Key Findings Summary

### Architecture Strengths

- ✅ **Robust collaborative editing** with real-time synchronization
- ✅ **Sophisticated history management** that excludes visual-only changes
- ✅ **Comprehensive auto-save system** that prevents data loss
- ✅ **Flexible visual effects** that provide immediate user feedback

### Critical Issues Identified

- ⚠️ **Multiple code paths** for similar operations leading to inconsistent behavior
- ⚠️ **Scattered orchestration** logic across the DfdComponent and multiple services
- ⚠️ **Complex state management** with overlapping responsibilities between stores
- ⚠️ **Permission checking complexity** with race conditions and unclear fallback logic
- ⚠️ **Auto-save logic duplication** across different event sources

### Architectural Complexity Metrics

- **Services involved in change propagation**: 15+
- **Decision points that affect flow**: 20+
- **Different pathways for node creation**: 4
- **State stores requiring synchronization**: 3
- **Lines of coordination logic in DfdComponent**: 500+

## Improvement Roadmap

The [Architectural Issues](./architectural-issues.md) document provides a detailed 4-phase migration strategy:

1. **Phase 1: Foundation** (2-3 weeks) - Create new service interfaces with comprehensive testing
2. **Phase 2: Orchestration** (2-3 weeks) - Implement unified orchestration and state management
3. **Phase 3: Consolidation** (3-4 weeks) - Migrate all pathways to use unified systems
4. **Phase 4: Cleanup** (1-2 weeks) - Remove deprecated code and optimize performance

## Usage Guidelines

### For Developers Working On:

#### DFD Component Features

- Review [User Actions Flow](./user-actions-flow.md) to understand current behavior
- Check [Change Propagation Matrix](./change-propagation-matrix.md) to see which systems your changes will affect
- Consider impact on both solo and collaborative modes

#### Collaborative Editing

- Study [Collaborative Operations Flow](./collaborative-operations-flow.md) for WebSocket message handling
- Understand permission checking complexity in [Architectural Issues](./architectural-issues.md)
- Review state synchronization patterns in [Visual Effects Pipeline](./visual-effects-pipeline.md)

#### Auto-save and Persistence

- Examine [Auto-save Decision Tree](./autosave-decision-tree.md) for triggering logic
- Understand history filtering in the same document
- Consider performance implications of frequent saves

#### Debugging Change Propagation Issues

- Start with [Change Propagation Matrix](./change-propagation-matrix.md) to identify affected systems
- Use flow diagrams to trace the path of specific operations
- Check decision points for unexpected filtering or blocking

### For Architectural Planning

- Begin with [Architectural Issues](./architectural-issues.md) for improvement recommendations
- Review the proposed unified architecture and migration strategy
- Consider the success metrics and risk mitigation approaches

## Maintenance Notes

This documentation should be updated when:

- New services are added to the change propagation flow
- Decision points are modified or added
- New types of operations are introduced
- Collaborative features are extended
- Auto-save behavior is changed

The diagrams use Mermaid syntax and should render properly in GitHub, GitLab, or any Markdown renderer that supports Mermaid.

## Related Documentation

- [TMI-UX Architecture Guide](../overview.md) - Overall application architecture
- [Collaborative Editing](../../features/collaborative-editing.md) - Collaborative editing implementation
<!-- NEEDS-REVIEW: File not found: ../../features/dfd-graph-interaction.md - this file does not exist in the repository -->
<!-- NEEDS-REVIEW: File not found: ../../../../shared-api/api-specs/tmi-asyncapi.yaml - this path does not exist. The AsyncAPI specification may be in a different location or not yet created -->

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- ../overview.md exists and is valid
- ../../features/collaborative-editing.md exists and is valid
- ./README.md, ./user-actions-flow.md, ./collaborative-operations-flow.md, ./autosave-decision-tree.md exist
- ./visual-effects-pipeline.md, ./change-propagation-matrix.md, ./architectural-issues.md exist
- DFD component has 2274 lines (supports "500+ lines of coordination logic" claim)
- Architecture describes real patterns implemented in the codebase

Items needing review:
- ../../features/dfd-graph-interaction.md: File does not exist
- ../../../../shared-api/api-specs/tmi-asyncapi.yaml: File/directory does not exist
- README.md references 3 non-existent files: history-management-flow.md, decision-points-analysis.md, state-synchronization.md
- Service names in documentation use conceptual names; actual implementation uses prefixed naming convention (App*, Infra*):
  - DfdFacadeService -> AppDfdFacade
  - DfdDiagramService -> AppDiagramService
  - DfdStateService -> AppStateService
  - GraphHistoryCoordinator -> AppHistoryService
  - X6GraphAdapter -> InfraX6GraphAdapter
  - VisualEffectsService -> InfraVisualEffectsService
-->
