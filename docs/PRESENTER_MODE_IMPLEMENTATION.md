# Presenter Mode Feature Implementation Plan

## Overview
Implement a presenter mode feature that allows the current presenter to broadcast their cursor position and selection state to all participants using graph content-relative coordinates.

## Key Constants & Configuration
```typescript
export const PRESENTER_CURSOR_CONFIG = {
  UPDATE_INTERVAL: 50, // ms - cursor broadcast frequency  
  TIMEOUT_DURATION: 2000, // ms - revert to normal cursor timeout
} as const;
```

## Implementation Tasks

### ✅ Completed Tasks
- [x] Create presenter mode implementation plan file
- [x] Add presenter mode constants configuration
- [x] Add presenter mode state to DfdCollaborationService
- [x] Create presenter toggle button in DFD component
- [x] Implement cursor broadcasting service
- [x] Implement cursor display service for received events
- [x] Implement selection broadcasting functionality
- [x] Implement selection reception functionality
- [x] Wire up all services and components in DFD component

### 🔄 In Progress Tasks
- [ ] Test presenter mode functionality end-to-end

### ⏳ Pending Tasks
None

## Detailed Implementation Plan

### 1. **State Management**
- **DfdCollaborationService**: Add `isPresenterModeActive: boolean`
- Only emit cursor/selection events when both: user is presenter AND mode is active
- Toggle methods restricted to current presenter only

### 2. **UI - Presenter Toggle Button**
- **DFD Component**: Add button beside existing collaboration button
- Show only when `currentPresenterEmail === currentUser.email`
- Material `podium` icon (same as collaboration dialog)
- **Button States**:
  - Inactive: Default color, tooltip: "Start presenting"
  - Active: Green color, tooltip: "Stop presenting"
- Click behavior: Toggle on/off (button style, not toggle component)

### 3. **Cursor Broadcasting Service**
- Track mouse position within graph container (50ms intervals)
- **Coordinate Conversion**: Use `graph.getContentBBox()` to convert mouse position to graph content-relative coordinates
  ```typescript
  const contentBBox = graph.getContentBBox();
  const relativeX = mouseX - contentBBox.x;
  const relativeY = mouseY - contentBBox.y;
  ```
- Send `PresenterCursorMessage` only when presenter mode active
- Include graph content-relative x,y coordinates

### 4. **Cursor Display Service**
- Listen for `PresenterCursorMessage` events
- **Coordinate Conversion**: Convert back to viewport coordinates using current content bounds
  ```typescript
  const contentBBox = graph.getContentBBox();
  const viewportX = contentBBox.x + receivedX;
  const viewportY = contentBBox.y + receivedY;
  ```
- Apply `presenter-cursor.svg` via CSS when receiving events
- Set 2-second timeout to revert to normal cursor
- Generate synthetic mouse events for X6 hover effects

### 5. **Selection Broadcasting**
- Hook into existing X6 `selection:changed` events  
- Send `PresenterSelectionMessage` only when presenter mode active
- Reset the 2-second cursor timeout on selection events

### 6. **Selection Reception**
- Use existing `X6SelectionAdapter.selectCells()` for programmatic selection
- Apply only to non-presenter participants
- Reset cursor timeout when selection events received

### 7. **Integration**
- **DFD Component**: Wire up mouse event listeners and X6 selection events
- Coordinate between cursor service, selection handling, and collaboration state

## Technical Approach
- **Coordinate System**: Graph content-relative coordinates using `graph.getContentBBox()`
  - Handles zoom/pan differences automatically
  - More precise than percentages
  - Identical content bounds across all clients (same diagram data)
- **Cursor Timeout**: Both cursor AND selection events reset 2-second normal cursor timeout
- **Only Current Presenter**: Toggle button only visible to current presenter
- **Broadcasting Control**: Only emit events when presenter mode explicitly activated

## Key Features
- Presenter sees normal cursor, others see custom SVG cursor at correct relative position
- Real-time cursor position updates with hover effect synchronization
- Automatic selection state broadcasting and reception  
- Green button indicates active broadcasting state
- 2-second timeout returns to normal cursor when no presenter events received
- Graph content-relative coordinates handle zoom/pan differences seamlessly

## Files to Create/Modify

### New Files
- `src/app/pages/dfd/services/presenter-cursor.service.ts` - Cursor broadcasting
- `src/app/pages/dfd/services/presenter-cursor-display.service.ts` - Cursor display
- `src/app/pages/dfd/constants/presenter-constants.ts` - Configuration constants

### Files to Modify
- `src/app/core/services/dfd-collaboration.service.ts` - Add presenter mode state
- `src/app/pages/dfd/dfd.component.ts` - Add presenter toggle button
- `src/app/pages/dfd/dfd.component.html` - Button template
- `src/app/pages/dfd/dfd.component.scss` - Button styling
- `src/app/pages/dfd/services/dfd-websocket.service.ts` - Enhanced message handling
- `src/app/pages/dfd/infrastructure/adapters/x6-selection.adapter.ts` - Selection integration

## Message Flow
1. **Cursor Broadcasting**: Mouse move → Convert to content coords → Send PresenterCursorMessage
2. **Cursor Reception**: Receive message → Convert to viewport coords → Apply custom cursor + synthetic events
3. **Selection Broadcasting**: X6 selection change → Send PresenterSelectionMessage  
4. **Selection Reception**: Receive message → Apply selection programmatically
5. **Timeout Management**: Reset 2s timer on any presenter event → Revert to normal cursor on timeout