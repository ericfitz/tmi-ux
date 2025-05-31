# X6 Clean Architecture Refactor - Implementation Tracking

## Overview

This document tracks the implementation of a clean architecture refactor for the AntV/X6 collaborative diagramming functionality. The goal is to improve maintainability, testability, and support for real-time collaboration while working directly with X6's native APIs.

## Architecture Goals

- **Long-term maintainability**: Clear separation of concerns with layered architecture
- **Testability**: Integration tests with real X6 instances using Vitest
- **Collaboration support**: Real-time multi-user editing with conflict resolution
- **Reduced complexity**: Eliminate over-abstraction and event conflicts

## Current Problems Being Solved

1. **Over-abstraction**: BaseShape wrappers re-implement X6 functionality
2. **Event conflicts**: DfdEventBusService intercepts X6 events causing interaction issues
3. **Complexity**: Multiple overlapping services with unclear responsibilities
4. **Testing challenges**: Heavy mocking required due to tight coupling

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  DFD Component  │    │  Collaboration Component        │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │DfdApplication   │ │Collaboration     │ │  CommandBus  │ │
│  │Service          │ │ApplicationService│ │              │ │
│  └─────────────────┘ └──────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                           │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │DiagramAggregate │ │CollaborationSess │ │   Commands   │ │
│  │                 │ │ion               │ │ DomainEvents │ │
│  └─────────────────┘ └──────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │X6GraphAdapter   │ │WebSocketAdapter  │ │ChangeDetect  │ │
│  │                 │ │                  │ │ionService    │ │
│  └─────────────────┘ └──────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation Refactoring (3-4 weeks)

#### 1.1 Domain Layer Setup

- [ ] Create domain directory structure
- [ ] Implement DiagramAggregate
- [ ] Define domain events
- [ ] Create value objects (NodeData, EdgeData, Point)
- [ ] Implement domain commands
- [ ] Add domain event handlers

#### 1.2 Application Layer Setup

- [ ] Create application directory structure
- [ ] Implement DfdApplicationService
- [ ] Create CommandBus with middleware support
- [ ] Add command handlers
- [ ] Implement application event handlers

#### 1.3 Infrastructure Layer Setup

- [ ] Create infrastructure directory structure
- [ ] Implement X6GraphAdapter
- [ ] Create ChangeDetectionService
- [ ] Build SerializationService
- [ ] Add logging and error handling

### Phase 2: Collaboration Integration (2-3 weeks)

#### 2.1 Collaboration Domain

- [ ] Implement CollaborationSession aggregate
- [ ] Define collaboration events and commands
- [ ] Add conflict resolution logic
- [ ] Create user presence tracking

#### 2.2 WebSocket Integration

- [ ] Create WebSocketAdapter
- [ ] Implement CollaborationApplicationService
- [ ] Add real-time change synchronization
- [ ] Handle connection management

#### 2.3 User Presence Features

- [ ] Implement user tracking
- [ ] Add cursor and selection sharing
- [ ] Create presence indicators UI
- [ ] Add user activity monitoring

### Phase 3: Migration and Testing (2-3 weeks)

#### 3.1 Gradual Migration

- [ ] Create migration strategy
- [ ] Replace existing services incrementally
- [ ] Maintain backward compatibility
- [ ] Update DfdComponent to use new architecture

#### 3.2 Comprehensive Testing

- [ ] Create integration test suite with real X6
- [ ] Add domain logic unit tests
- [ ] Implement end-to-end collaboration tests
- [ ] Add performance benchmarks

#### 3.3 Performance Optimization

- [ ] Implement change batching
- [ ] Add debouncing for rapid changes
- [ ] Optimize serialization performance
- [ ] Add memory leak prevention

## Detailed Task List

### Phase 1.1: Domain Layer Setup

#### Task 1.1.1: Create Domain Directory Structure

- [ ] Create `src/app/pages/dfd/domain/` directory
- [ ] Create `src/app/pages/dfd/domain/aggregates/` directory
- [ ] Create `src/app/pages/dfd/domain/commands/` directory
- [ ] Create `src/app/pages/dfd/domain/events/` directory
- [ ] Create `src/app/pages/dfd/domain/value-objects/` directory
- [ ] Create `src/app/pages/dfd/domain/interfaces/` directory

#### Task 1.1.2: Implement Core Value Objects

- [ ] Create `Point` value object
- [ ] Create `NodeData` value object
- [ ] Create `EdgeData` value object
- [ ] Create `DiagramNode` entity
- [ ] Create `DiagramEdge` entity
- [ ] Add validation logic to value objects

#### Task 1.1.3: Define Domain Events

- [ ] Create base `DomainEvent` interface
- [ ] Implement `NodeAddedEvent`
- [ ] Implement `NodeMovedEvent`
- [ ] Implement `NodeRemovedEvent`
- [ ] Implement `EdgeAddedEvent`
- [ ] Implement `EdgeRemovedEvent`
- [ ] Implement `DiagramChangedEvent`

#### Task 1.1.4: Implement Domain Commands

- [ ] Create base `Command` interface
- [ ] Implement `AddNodeCommand`
- [ ] Implement `MoveNodeCommand`
- [ ] Implement `RemoveNodeCommand`
- [ ] Implement `AddEdgeCommand`
- [ ] Implement `RemoveEdgeCommand`
- [ ] Add command validation logic

#### Task 1.1.5: Create DiagramAggregate

- [ ] Implement `DiagramAggregate` class
- [ ] Add node management methods
- [ ] Add edge management methods
- [ ] Implement event emission
- [ ] Add state validation
- [ ] Implement serialization support

### Phase 1.2: Application Layer Setup

#### Task 1.2.1: Create Application Directory Structure

- [ ] Create `src/app/pages/dfd/application/` directory
- [ ] Create `src/app/pages/dfd/application/services/` directory
- [ ] Create `src/app/pages/dfd/application/handlers/` directory
- [ ] Create `src/app/pages/dfd/application/interfaces/` directory

#### Task 1.2.2: Implement CommandBus

- [ ] Create `CommandBus` service
- [ ] Add middleware support
- [ ] Implement command validation middleware
- [ ] Add logging middleware
- [ ] Add serialization middleware
- [ ] Implement error handling

#### Task 1.2.3: Create DfdApplicationService

- [ ] Implement `DfdApplicationService`
- [ ] Add diagram operation methods
- [ ] Implement X6 event handling
- [ ] Add change detection integration
- [ ] Implement undo/redo support

#### Task 1.2.4: Implement Command Handlers

- [ ] Create `AddNodeCommandHandler`
- [ ] Create `MoveNodeCommandHandler`
- [ ] Create `RemoveNodeCommandHandler`
- [ ] Create `AddEdgeCommandHandler`
- [ ] Create `RemoveEdgeCommandHandler`
- [ ] Add handler registration

### Phase 1.3: Infrastructure Layer Setup

#### Task 1.3.1: Create Infrastructure Directory Structure

- [ ] Create `src/app/pages/dfd/infrastructure/` directory
- [ ] Create `src/app/pages/dfd/infrastructure/adapters/` directory
- [ ] Create `src/app/pages/dfd/infrastructure/services/` directory

#### Task 1.3.2: Implement X6GraphAdapter

- [ ] Create `X6GraphAdapter` service
- [ ] Add graph initialization
- [ ] Implement node operations
- [ ] Implement edge operations
- [ ] Add event listener setup
- [ ] Implement coordinate transformations

#### Task 1.3.3: Create ChangeDetectionService

- [ ] Implement `ChangeDetectionService`
- [ ] Add user vs system change detection
- [ ] Implement remote change marking
- [ ] Add change filtering logic
- [ ] Implement change batching

#### Task 1.3.4: Build SerializationService

- [ ] Create `SerializationService`
- [ ] Implement command serialization
- [ ] Add event serialization
- [ ] Implement deserialization
- [ ] Add version compatibility

## Testing Strategy

### Integration Tests (Primary Focus)

- Use real X6 instances in JSDOM environment
- Test complete workflows end-to-end
- Verify X6 state changes
- Test collaboration scenarios

### Domain Tests (No External Dependencies)

- Pure business logic testing
- No mocking required
- Fast execution
- High coverage of business rules

### Test File Structure

```
src/app/pages/dfd/
├── domain/
│   ├── aggregates/
│   │   └── diagram-aggregate.test.ts
│   ├── commands/
│   │   └── add-node-command.test.ts
│   └── value-objects/
│       └── node-data.test.ts
├── application/
│   ├── services/
│   │   └── dfd-application.service.test.ts
│   └── handlers/
│       └── command-handlers.test.ts
└── infrastructure/
    ├── adapters/
    │   └── x6-graph.adapter.test.ts
    └── services/
        └── change-detection.service.test.ts
```

## Progress Tracking

### Completed Tasks

- [x] Create feature branch: `feature/x6-clean-architecture-refactor`
- [x] Create implementation tracking document
- [x] Task 1.1.1: Create domain directory structure
- [x] Task 1.1.2: Implement core value objects
- [x] Task 1.1.3: Define domain events

### Current Sprint

**Sprint 1: Domain Layer Foundation**

- [x] Task 1.1.1: Create domain directory structure
- [x] Task 1.1.2: Implement core value objects
- [x] Task 1.1.3: Define domain events
- [x] Task 1.1.4: Implement domain commands
- [x] Task 1.1.5: Create DiagramAggregate

### Next Sprint

**Sprint 2: Application Layer Foundation**

- [x] Task 1.2.1: Create application directory structure
- [x] Task 1.2.2: Implement CommandBus
- [x] Task 1.2.3: Create DfdApplicationService
- [x] Task 1.2.4: Implement Command Handlers

## Notes and Decisions

### Architecture Decisions

1. **Direct X6 Integration**: Work with X6's native APIs instead of wrapping them
2. **Event Sourcing**: Capture all changes as domain events for collaboration
3. **Clean Architecture**: Strict layer separation with dependency inversion
4. **Vitest Integration**: Use real X6 instances in tests for better confidence

### Migration Strategy

1. **Incremental**: Replace services one at a time
2. **Backward Compatible**: Maintain existing APIs during transition
3. **Feature Flags**: Use feature toggles for gradual rollout
4. **Parallel Development**: New architecture alongside existing code

### Risk Mitigation

1. **Testing**: Comprehensive test suite before migration
2. **Rollback Plan**: Ability to revert to previous architecture
3. **Performance Monitoring**: Track performance during migration
4. **User Feedback**: Gather feedback during gradual rollout

## Success Metrics

### Technical Metrics

- [ ] Reduce codebase complexity by 40%
- [ ] Achieve 90%+ test coverage with integration tests
- [ ] Eliminate X6 event conflicts
- [ ] Reduce service coupling

### Performance Metrics

- [ ] Maintain current rendering performance
- [ ] Reduce memory usage by 20%
- [ ] Improve collaboration latency
- [ ] Optimize change detection overhead

### Maintainability Metrics

- [ ] Reduce time to add new features
- [ ] Simplify debugging process
- [ ] Improve code readability scores
- [ ] Reduce onboarding time for new developers

---

**Last Updated**: 2025-05-30
**Branch**: `feature/x6-clean-architecture-refactor`
**Status**: In Progress - Phase 1.1
