# TMI WebSocket Collaboration Integration Plan

## Overview

Complete migration from REST-based diagram operations to WebSocket-based collaborative editing for the DFD module. This plan implements real-time collaborative editing with proper conflict resolution, presenter mode, and server-managed history.

## Architecture Decision: Hybrid REST + WebSocket

**Strategy:** Keep REST for loading/auth/metadata, use WebSocket for real-time collaborative editing operations.

### Why Hybrid Approach:
- Leverages existing stable REST infrastructure for diagram loading and authentication
- WebSocket provides real-time collaboration for cell operations (add/update/remove)
- Clean separation between collaborative and non-collaborative modes
- Fallback mechanism if WebSocket connection fails

## Current State Analysis

### Existing Infrastructure (Ready to Use):
- ✅ Complete WebSocket infrastructure (`WebSocketAdapter`, `DfdCollaborationService`)
- ✅ Event-driven architecture with proper observables
- ✅ Domain-driven design supporting incremental operations
- ✅ Clean service layer with separation of concerns
- ✅ Existing collaboration session management

### Current REST Integration Points:
- `ThreatModelService.patchDiagramCells()` - Current diagram persistence
- `DfdDiagramService.saveDiagramChanges()` - Main save orchestrator
- Auto-save triggered by history modifications in `DfdComponent`

## Implementation Plan

### Phase 1: WebSocket Foundation

**1. Enhance WebSocketAdapter**
- Add TMI collaborative message type handlers
- Implement message routing for diagram operations
- Add echo prevention patterns

**2. Create CollaborativeOperationService**
- Handle outgoing diagram operations to WebSocket
- Manage operation IDs and sequencing
- Implement rate limiting and validation

**3. Message Type Integration**
- `diagram_operation` - Cell add/update/remove operations
- `presenter_request/current_presenter` - Presenter mode
- `undo_request/redo_request` - Server-managed history
- `history_operation` - History operation results
- `authorization_denied` - Permission errors
- `state_correction` - Conflict resolution
- `resync_request/resync_response` - Full sync recovery

### Phase 2: DFD Integration 

**1. Modify DfdDiagramService**
- Add collaboration mode detection in `saveDiagramChanges()`
- Route to WebSocket for collaborative sessions
- Keep REST for non-collaborative editing

**2. Update DfdComponent Auto-Save**
- Check `collaborationService.isCollaborating$` 
- Send incremental WebSocket updates during collaboration
- Maintain REST auto-save for solo editing

**3. Remote Operation Application**
- Add WebSocket message handlers to DfdComponent
- Use existing domain services (`DfdNodeService.createNodeFromInfo()`)
- Apply same visual effects as local operations
- Implement echo prevention with `isApplyingRemoteChange` flag

**4. History Mode Switching**
- Disable local history during collaboration
- Replace undo/redo handlers with WebSocket requests
- Handle server history responses with resync logic
- Restore local history when collaboration ends

### Phase 3: Read-Only User Enforcement

**1. Permission Integration**
- Use existing `DfdCollaborationService.hasPermission('edit')`
- Add `isReadOnlyMode` property to DfdComponent
- Check permissions on component initialization

**2. UI Disabling**
- Disable toolbar buttons for read-only users
- Hide context menu edit options
- Show read-only access banner
- Disable keyboard shortcuts

**3. Graph Interaction Prevention**
- Add `setReadOnlyMode()` to X6GraphAdapter
- Disable X6 selection, moving, resizing for read-only users
- Prevent cell creation and deletion

**4. Service-Level Blocking**
- Add permission checks to all DfdFacadeService editing methods
- Block WebSocket operation sending for read-only users
- Return appropriate error messages

### Phase 4: Advanced Collaboration Features

**1. Presenter Mode**
- Integrate cursor position tracking with X6 mouse events
- Handle selection sharing via WebSocket
- Show presenter indicators and cursor visualization

**2. User Presence**
- Display active collaborators
- Show operation feedback ("User X added a node")
- Handle join/leave notifications

**3. Error Handling and Recovery**
- Implement state correction handling
- Add resync mechanism using existing REST API
- Handle authorization denied scenarios gracefully

**4. Performance Optimization**
- Throttle cursor position updates (100ms)
- Debounce selection updates (250ms)
- Batch cell operations where possible

## Technical Implementation Details

### Echo Prevention Pattern
```typescript
class DfdComponent {
  private isApplyingRemoteChange = false;
  
  handleRemoteOperation(message: DiagramOperationMessage) {
    if (message.user_id === this.currentUser.email) return;
    
    this.isApplyingRemoteChange = true;
    try {
      this.applyOperationToGraph(message.operation);
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }
  
  // In event handlers
  onLocalGraphChange(change: any) {
    if (this.isApplyingRemoteChange) return; // Prevent echo
    this.sendWebSocketOperation(change);
  }
}
```

### Operation Routing Logic
```typescript
// In DfdDiagramService
saveDiagramChanges(graph: Graph, diagramId: string, threatModelId: string): Observable<boolean> {
  if (this.collaborationService.isCollaborating$.value) {
    // WebSocket mode: send incremental operations
    return this.sendWebSocketOperation(this.extractChanges(graph));
  } else {
    // REST mode: use existing PATCH operation
    return this.threatModelService.patchDiagramCells(threatModelId, diagramId, cells);
  }
}
```

### Server History Integration
```typescript
// Replace local undo/redo during collaboration
setupServerManagedHistory(): void {
  this.x6GraphAdapter.setUndoHandler(() => {
    this.webSocketAdapter.sendMessage({
      message_type: 'undo_request',
      user_id: this.currentUser.email
    });
  });
  
  // Handle server responses
  this.webSocketAdapter.onMessage('history_operation').subscribe(message => {
    if (message.message === 'resync_required') {
      this.performRESTResync();
    }
  });
}
```

## Key Benefits

1. **Clean Architecture**: Leverages existing infrastructure without major rewrites
2. **Real-time Collaboration**: True collaborative editing with conflict resolution
3. **Permission Enforcement**: Multi-layer read-only access prevention
4. **Visual Consistency**: Remote operations use same styling and effects as local operations
5. **Robust Error Handling**: Comprehensive fallback and recovery mechanisms
6. **Server Authority**: Server manages history and resolves conflicts authoritatively

## Files to Modify

### Core DFD Files:
- `src/app/pages/dfd/dfd.component.ts` - Main component integration
- `src/app/pages/dfd/dfd.component.html` - UI permission enforcement
- `src/app/pages/dfd/services/dfd-diagram.service.ts` - Operation routing
- `src/app/pages/dfd/services/dfd-facade.service.ts` - Service-level permission checks

### Infrastructure Files:
- `src/app/pages/dfd/infrastructure/adapters/websocket.adapter.ts` - Message handling
- `src/app/pages/dfd/infrastructure/adapters/x6-graph.adapter.ts` - Read-only mode
- `src/app/pages/dfd/services/dfd-collaboration.service.ts` - Enhanced permissions

### New Files:
- `src/app/pages/dfd/services/collaborative-operation.service.ts` - WebSocket operations
- `src/app/pages/dfd/models/websocket-message.types.ts` - TypeScript definitions

This plan provides a complete migration to WebSocket-based collaborative editing while maintaining the robustness and visual consistency of the existing system.