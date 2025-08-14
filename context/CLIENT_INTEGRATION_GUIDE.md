# Client Integration Guide: TMI Collaborative Editing

## Overview

This guide provides frontend developers with everything needed to implement collaborative diagram editing using the TMI WebSocket API. The collaborative editing system supports real-time multi-user editing with conflict resolution, presenter mode, and comprehensive state synchronization.

## Table of Contents

- [Quick Start](#quick-start)
- [Collaboration Session Management](#collaboration-session-management)
- [Authentication & Connection](#authentication--connection)
- [Message Types & Protocol](#message-types--protocol)
- [Core Collaborative Features](#core-collaborative-features)
- [Error Handling & Recovery](#error-handling--recovery)
- [Best Practices](#best-practices)
- [TypeScript Definitions](#typescript-definitions)
- [Example Implementation](#example-implementation)
- [Testing Guide](#testing-guide)

## Quick Start

### 1. Basic Connection Setup

```javascript
import { TMICollaborativeClient } from './tmi-client';

const client = new TMICollaborativeClient({
  diagramId: 'your-diagram-uuid',
  threatModelId: 'your-threat-model-uuid',
  jwtToken: 'your-jwt-token',
  serverUrl: 'ws://localhost:8080' // or wss://api.tmi.example.com
});

// Connect and join session
await client.connect();
```

### 2. Handle Real-time Updates

```javascript
client.on('diagramOperation', (operation) => {
  // Apply remote operation to your diagram
  applyOperationToDiagram(operation);
});

client.on('presenterCursor', (cursor) => {
  // Show presenter's cursor position
  showPresenterCursor(cursor.cursor_position);
});
```

### 3. Send Operations

```javascript
// Send a cell add operation
await client.addCell({
  id: uuid(),
  shape: 'process',
  x: 100, y: 150,
  width: 120, height: 80,
  label: 'New Process'
});

// Send a batch operation
await client.sendBatchOperation([
  { id: 'cell-1', operation: 'add', data: cellData1 },
  { id: 'cell-2', operation: 'update', data: cellData2 }
]);
```

## Collaboration Session Management

### Overview

Before establishing a WebSocket connection for real-time collaboration, clients must use the REST API to manage collaboration sessions. This section covers the complete flow from discovering sessions to joining them.

### 1. Discovering Available Sessions

**GET /collaboration/sessions** - List all active sessions

```javascript
async function getActiveCollaborationSessions(jwtToken) {
  const response = await fetch('/collaboration/sessions', {
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get sessions: ${response.status}`);
  }
  
  const sessions = await response.json();
  return sessions;
}

// Response format - Array of CollaborationSession objects:
// [
//   {
//     "session_id": "053d62c1-8a5d-48db-8a0a-707cacceb6ab",
//     "session_manager": "testuser-25542959@test.tmi", 
//     "threat_model_id": "60fd469a-e3aa-4d04-9ed7-f3203162563d",
//     "threat_model_name": "My Threat Model",
//     "diagram_id": "422b993e-a0ff-416a-8a6b-5dff8b4d6eef",
//     "diagram_name": "Main DFD",
//     "participants": [
//       {
//         "user_id": "testuser-25542959@test.tmi",
//         "joined_at": "2025-08-14T02:45:13.534Z",
//         "permissions": "writer"
//       }
//     ],
//     "websocket_url": "ws://localhost:8080/threat_models/60fd.../diagrams/422b.../ws"
//   }
// ]
```

### 2. Starting a New Collaboration Session

**POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate** - Start or join session

```javascript
async function startOrJoinCollaborationSession(threatModelId, diagramId, jwtToken) {
  const response = await fetch(
    `/threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
      // No body required - user identity comes from JWT
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to join session: ${response.status} ${response.statusText}`);
  }
  
  const session = await response.json();
  return session;
}

// Success Response (200 OK) - CollaborationSession object:
// {
//   "session_id": "053d62c1-8a5d-48db-8a0a-707cacceb6ab",
//   "session_manager": "testuser-25542959@test.tmi",
//   "threat_model_id": "60fd469a-e3aa-4d04-9ed7-f3203162563d", 
//   "threat_model_name": "My Threat Model",
//   "diagram_id": "422b993e-a0ff-416a-8a6b-5dff8b4d6eef",
//   "diagram_name": "Main DFD",
//   "participants": [
//     {
//       "user_id": "testuser-25542959@test.tmi", // Original session creator
//       "joined_at": "2025-08-14T02:45:10.000Z",
//       "permissions": "writer"
//     },
//     {
//       "user_id": "testuser-20492675@test.tmi", // Current user (newly joined)
//       "joined_at": "2025-08-14T02:45:13.534Z", 
//       "permissions": "writer"
//     }
//   ],
//   "websocket_url": "ws://localhost:8080/threat_models/60fd.../diagrams/422b.../ws"
// }
```

### 3. Complete Session Join Flow

**CRITICAL**: The REST API call must complete BEFORE establishing the WebSocket connection to ensure proper participant registration.

```javascript
class CollaborationSessionManager {
  constructor(jwtToken) {
    this.jwtToken = jwtToken;
    this.currentSession = null;
    this.wsClient = null;
  }
  
  async joinCollaborationSession(threatModelId, diagramId) {
    try {
      // Step 1: Join session via REST API (REQUIRED FIRST STEP)
      console.log('Step 1: Joining collaboration session via REST API...');
      this.currentSession = await this.startOrJoinSession(threatModelId, diagramId);
      
      // Step 2: Verify you're included in participants list  
      console.log('Step 2: Verifying participant registration...');
      const currentUser = this.parseJWT(this.jwtToken).sub; // or .email
      const isParticipant = this.currentSession.participants.some(
        p => p.user_id === currentUser
      );
      
      if (!isParticipant) {
        throw new Error('Failed to register as session participant');
      }
      
      console.log(`✅ Successfully joined session with ${this.currentSession.participants.length} participants`);
      
      // Step 3: Establish WebSocket connection using provided URL
      console.log('Step 3: Establishing WebSocket connection...');
      await this.connectWebSocket();
      
      console.log('✅ Collaboration session ready!');
      return this.currentSession;
      
    } catch (error) {
      console.error('Failed to join collaboration session:', error);
      
      // Clean up on failure
      if (this.wsClient) {
        this.wsClient.disconnect();
        this.wsClient = null;
      }
      this.currentSession = null;
      
      throw error;
    }
  }
  
  async startOrJoinSession(threatModelId, diagramId) {
    const response = await fetch(
      `/threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session join failed: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  }
  
  async connectWebSocket() {
    if (!this.currentSession) {
      throw new Error('No active session - call joinCollaborationSession() first');
    }
    
    // Use the websocket_url from the session response
    const wsUrl = this.currentSession.websocket_url + `?token=${this.jwtToken}`;
    
    this.wsClient = new TMICollaborativeClient({
      websocketUrl: wsUrl,
      jwtToken: this.jwtToken,
      diagramId: this.currentSession.diagram_id,
      threatModelId: this.currentSession.threat_model_id
    });
    
    await this.wsClient.connect();
    
    // Set up session-specific event handlers
    this.setupSessionEventHandlers();
  }
  
  setupSessionEventHandlers() {
    this.wsClient.on('connected', () => {
      console.log('WebSocket connected to collaboration session');
    });
    
    this.wsClient.on('diagram_operation', (operation) => {
      console.log(`Received operation from ${operation.user_id}`);
      // Apply operation to your diagram editor
    });
    
    this.wsClient.on('current_presenter', (message) => {
      console.log(`Presenter changed to: ${message.current_presenter}`);
      // Update UI to reflect presenter change
    });
  }
  
  parseJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return JSON.parse(jsonPayload);
  }
}
```

### 4. Error Handling During Session Join

```javascript
class SessionJoinErrorHandler {
  async joinWithRetry(threatModelId, diagramId, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sessionManager.joinCollaborationSession(threatModelId, diagramId);
      } catch (error) {
        lastError = error;
        console.warn(`Session join attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed to join session after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  handleSessionJoinError(error, response) {
    switch (response.status) {
      case 401:
        return 'Authentication failed. Please log in again.';
      case 403:
        return 'You do not have permission to access this diagram.';
      case 404:
        return 'Diagram or threat model not found.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return `Failed to join collaboration session: ${error.message}`;
    }
  }
}
```

### 5. Checking Session Status

**GET /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate** - Get current session

```javascript
async function getSessionStatus(threatModelId, diagramId, jwtToken) {
  const response = await fetch(
    `/threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`,
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.status === 404) {
    return null; // No active session
  }
  
  if (!response.ok) {
    throw new Error(`Failed to get session status: ${response.status}`);
  }
  
  return await response.json(); // CollaborationSession object
}
```

### 6. Leaving a Session  

**DELETE /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate** - Leave session

```javascript
async function leaveCollaborationSession(threatModelId, diagramId, jwtToken) {
  // First close WebSocket connection
  if (this.wsClient) {
    this.wsClient.disconnect();
    this.wsClient = null;
  }
  
  // Then notify server via REST API
  const response = await fetch(
    `/threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok && response.status !== 404) {
    console.warn(`Failed to leave session cleanly: ${response.status}`);
  }
  
  this.currentSession = null;
}
```

### Key Integration Points

**✅ Prerequisites for Collaboration:**
1. Valid JWT token with appropriate permissions (reader/writer/owner)
2. Access to the specific threat model and diagram  
3. Network connectivity to both REST API and WebSocket endpoints

**✅ Critical Sequence:**
1. **REST API first** - Call POST `/threat_models/{id}/diagrams/{id}/collaborate`
2. **Verify participation** - Check you're in the `participants` array
3. **WebSocket second** - Connect using the provided `websocket_url`
4. **Handle events** - Set up message handlers for collaborative features

**⚠️ Common Pitfalls:**
- **Never skip the REST API call** - WebSocket-only connections will fail authorization
- **Check participant list** - Ensure you're registered before proceeding
- **Use provided WebSocket URL** - Don't construct it manually, use the one from the session response
- **Handle connection failures gracefully** - Both REST and WebSocket can fail independently

This session management layer ensures proper authorization and participant tracking before engaging in real-time collaboration.

### 7. Participant Updates via WebSocket Events

**IMPORTANT**: After completing the REST API + WebSocket connection flow, clients do **NOT** need to poll the REST API again unless they want updated participant information when users join/leave.

#### Join/Leave Event Handling

The server automatically sends WebSocket messages when users join or leave the session:

```javascript
class ParticipantManager {
  constructor(wsClient, sessionManager) {
    this.wsClient = wsClient;
    this.sessionManager = sessionManager;
    this.currentParticipants = [];
    
    // Listen for user join/leave events
    this.setupParticipantEventListeners();
  }
  
  setupParticipantEventListeners() {
    // Handle user joining the session
    this.wsClient.on('message', (message) => {
      if (message.event === 'join') {
        console.log(`User ${message.user_id} joined the session`);
        this.handleUserJoined(message.user_id, message.timestamp);
      }
      
      if (message.event === 'leave') {
        console.log(`User ${message.user_id} left the session`);
        this.handleUserLeft(message.user_id, message.timestamp);
      }
    });
  }
  
  async handleUserJoined(userId, timestamp) {
    // Show immediate notification
    this.showNotification(`${this.getDisplayName(userId)} joined the session`, 'info');
    
    // Optionally refresh participant list with full details
    if (this.needsParticipantDetails) {
      await this.refreshParticipantList();
    }
  }
  
  async handleUserLeft(userId, timestamp) {
    // Show immediate notification  
    this.showNotification(`${this.getDisplayName(userId)} left the session`, 'info');
    
    // Remove from local participant list
    this.currentParticipants = this.currentParticipants.filter(p => p.user_id !== userId);
    this.updateParticipantUI();
    
    // Optionally refresh participant list for accurate state
    if (this.needsParticipantDetails) {
      await this.refreshParticipantList();
    }
  }
  
  async refreshParticipantList() {
    try {
      // Get updated session info from REST API
      const session = await this.sessionManager.getSessionStatus(
        this.sessionManager.currentSession.threat_model_id,
        this.sessionManager.currentSession.diagram_id
      );
      
      if (session && session.participants) {
        this.currentParticipants = session.participants;
        this.updateParticipantUI();
        console.log(`Updated participant list: ${session.participants.length} participants`);
      }
    } catch (error) {
      console.warn('Failed to refresh participant list:', error);
    }
  }
  
  updateParticipantUI() {
    // Update your UI to show current participants with their permissions
    const participantElements = this.currentParticipants.map(p => `
      <div class="participant">
        <span class="user-name">${this.getDisplayName(p.user_id)}</span>
        <span class="permission-badge ${p.permissions}">${p.permissions}</span>
        <span class="join-time">${this.formatTime(p.joined_at)}</span>
      </div>
    `);
    
    document.getElementById('participants-list').innerHTML = participantElements.join('');
  }
  
  getDisplayName(userId) {
    // Convert email to display name or use user directory
    return userId.split('@')[0] || userId;
  }
  
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }
}
```

#### WebSocket Message Format

**Join Event:**
```javascript
{
  "event": "join",
  "user_id": "testuser-20492675@test.tmi", 
  "timestamp": "2025-08-14T02:45:13.534Z"
}
```

**Leave Event:**
```javascript
{
  "event": "leave", 
  "user_id": "testuser-20492675@test.tmi",
  "timestamp": "2025-08-14T02:45:20.123Z"
}
```

#### Complete Integration Example

```javascript
class CollaborationClient {
  async initializeCollaboration(threatModelId, diagramId) {
    // Step 1: Join via REST API
    const session = await this.sessionManager.joinCollaborationSession(threatModelId, diagramId);
    console.log(`Joined session with ${session.participants.length} participants`);
    
    // Step 2: Set up participant tracking
    this.participantManager = new ParticipantManager(this.wsClient, this.sessionManager);
    this.participantManager.currentParticipants = session.participants;
    this.participantManager.updateParticipantUI();
    
    // Step 3: Set up collaboration features
    this.setupDiagramCollaboration();
    
    console.log('✅ Collaboration fully initialized');
  }
  
  setupDiagramCollaboration() {
    // Handle diagram operations
    this.wsClient.on('diagram_operation', (operation) => {
      if (operation.user_id !== this.currentUser.email) {
        this.applyRemoteOperation(operation);
        
        // Show who made the change
        this.participantManager.showNotification(
          `${this.participantManager.getDisplayName(operation.user_id)} updated the diagram`,
          'info'
        );
      }
    });
    
    // Handle presenter mode changes
    this.wsClient.on('current_presenter', (message) => {
      this.handlePresenterChange(message.current_presenter);
    });
  }
}
```

#### Key Points for Participant Management

**✅ Automatic Notifications:**
- WebSocket join/leave events are sent automatically
- No additional REST API calls required for basic awareness
- Events include user ID and timestamp

**✅ When to Refresh Participant List:**
- **Basic apps**: Just show join/leave notifications, don't refresh
- **Detailed apps**: Refresh after join/leave to get permission levels and accurate timestamps  
- **Dashboard apps**: Refresh to show participant count and detailed participant info

**✅ Performance Considerations:**
- Join/leave events are lightweight and frequent
- Only refresh full participant list when you need detailed information
- Consider debouncing refresh calls if multiple users join/leave rapidly

**❌ What NOT to do:**
- Don't poll the REST API continuously for participant updates
- Don't refresh participant list on every join/leave unless needed
- Don't assume join/leave events include permission information

The WebSocket events provide real-time awareness of participant changes, while the REST API provides detailed participant information when needed.

## Authentication & Connection

### JWT Token Requirements

The WebSocket connection requires a valid JWT token with the following claims:

```json
{
  "sub": "user-id-or-email",
  "email": "user@example.com", 
  "name": "User Name",
  "exp": 1640995200,
  "role": "writer" // reader, writer, or owner
}
```

### Connection URL Format

```
ws://localhost:8080/threat_models/{threat_model_id}/diagrams/{diagram_id}/ws?token={jwt_token}
```

### Connection Lifecycle

```javascript
class TMICollaborativeClient {
  async connect() {
    this.ws = new WebSocket(this.buildConnectionURL());
    
    this.ws.onopen = () => {
      console.log('Connected to collaborative session');
      this.heartbeat = setInterval(() => this.ping(), 30000);
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };
    
    this.ws.onclose = (event) => {
      this.handleDisconnection(event);
      clearInterval(this.heartbeat);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  handleDisconnection(event) {
    if (event.code !== 1000) { // Not normal closure
      // Implement exponential backoff reconnection
      this.scheduleReconnection();
    }
  }
}
```

## Message Types & Protocol

### Sending Operations

#### Cell Operations (Primary Pattern)
```javascript
const operation = {
  message_type: 'diagram_operation',
  user_id: this.currentUser.email,
  operation_id: uuid(), // Client-generated UUID
  operation: {
    type: 'patch',
    cells: [
      {
        id: 'cell-uuid',
        operation: 'add', // 'add', 'update', 'remove'
        data: { /* cell properties */ }
      }
    ]
  }
};

this.ws.send(JSON.stringify(operation));
```

#### Presenter Mode Operations
```javascript
// Request presenter mode
this.ws.send(JSON.stringify({
  message_type: 'presenter_request',
  user_id: this.currentUser.email
}));

// Send cursor position (only if you're the presenter)
this.ws.send(JSON.stringify({
  message_type: 'presenter_cursor',
  user_id: this.currentUser.email,
  cursor_position: { x: 100, y: 200 }
}));

// Send selection (only if you're the presenter)
this.ws.send(JSON.stringify({
  message_type: 'presenter_selection', 
  user_id: this.currentUser.email,
  selected_cells: ['cell-uuid-1', 'cell-uuid-2']
}));
```

#### History Operations
```javascript
// Request undo
this.ws.send(JSON.stringify({
  message_type: 'undo_request',
  user_id: this.currentUser.email
}));

// Request redo
this.ws.send(JSON.stringify({
  message_type: 'redo_request', 
  user_id: this.currentUser.email
}));
```

### Receiving Messages

#### Core Message Handler
```javascript
handleMessage(message) {
  // Handle legacy event format (join/leave events)
  if (message.event) {
    switch (message.event) {
      case 'join':
        this.handleUserJoined(message);
        break;
      case 'leave':
        this.handleUserLeft(message);
        break;
    }
    return;
  }

  // Handle standard message format
  switch (message.message_type) {
    case 'diagram_operation':
      this.handleDiagramOperation(message);
      break;
      
    case 'current_presenter':
      this.handlePresenterChange(message);
      break;
      
    case 'presenter_cursor':
      this.handlePresenterCursor(message);
      break;
      
    case 'authorization_denied':
      this.handleAuthorizationDenied(message);
      break;
      
    case 'state_correction':
      this.handleStateCorrection(message);
      break;
      
    case 'resync_response':
      this.handleResyncResponse(message);
      break;
      
    case 'history_operation':
      this.handleHistoryOperation(message);
      break;
      
    default:
      console.warn('Unknown message type:', message.message_type);
  }
}

// Handle user join/leave events
handleUserJoined(message) {
  console.log(`User ${message.user_id} joined at ${message.timestamp}`);
  this.emit('user_joined', message);
  
  // Update participant list if needed
  if (this.participantManager) {
    this.participantManager.handleUserJoined(message.user_id, message.timestamp);
  }
}

handleUserLeft(message) {
  console.log(`User ${message.user_id} left at ${message.timestamp}`);
  this.emit('user_left', message);
  
  // Update participant list if needed
  if (this.participantManager) {
    this.participantManager.handleUserLeft(message.user_id, message.timestamp);
  }
}
```

## Core Collaborative Features

### 1. Real-time Diagram Operations

#### CRITICAL: Prevent Echo Loops

**⚠️ Most Important Rule: NEVER send WebSocket messages when applying remote operations**

```javascript
class DiagramCollaborationManager {
  constructor(diagramEditor) {
    this.diagramEditor = diagramEditor;
    this.isApplyingRemoteChange = false; // Echo prevention flag
    
    // Listen to local diagram changes
    this.diagramEditor.on('cellChanged', (change) => {
      if (this.isApplyingRemoteChange) {
        return; // DON'T send WebSocket message for remote changes
      }
      
      // Only send for genuine local changes
      this.sendOperation(change);
    });
  }
  
  // Apply remote operations from other users
  handleDiagramOperation(message) {
    // Skip if this is our own operation (echo prevention)
    if (message.user_id === this.currentUser.email) {
      return;
    }
    
    this.isApplyingRemoteChange = true; // Set flag
    
    try {
      // Apply the remote operation to local diagram
      this.applyOperationToEditor(message.operation);
      
      // Show user feedback
      this.showOperationFeedback(message.user_id, message.operation);
    } finally {
      this.isApplyingRemoteChange = false; // Always clear flag
    }
  }
  
  applyOperationToEditor(operation) {
    for (const cellOp of operation.cells) {
      switch (cellOp.operation) {
        case 'add':
          this.diagramEditor.addCell(cellOp.data);
          break;
        case 'update':
          this.diagramEditor.updateCell(cellOp.id, cellOp.data);
          break;
        case 'remove':
          this.diagramEditor.removeCell(cellOp.id);
          break;
      }
    }
  }
}
```

### 2. Presenter Mode Implementation

```javascript
class PresenterModeManager {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.currentPresenter = null;
    this.isOwner = false;
    this.isPresenter = false;
  }
  
  requestPresenterMode() {
    this.wsClient.send({
      message_type: 'presenter_request',
      user_id: this.currentUser.email
    });
  }
  
  handlePresenterChange(message) {
    this.currentPresenter = message.current_presenter;
    this.isPresenter = (message.current_presenter === this.currentUser.email);
    
    // Update UI to show/hide presenter controls
    this.updatePresenterUI();
    
    if (this.isPresenter) {
      // Start sending cursor/selection updates
      this.enablePresenterMode();
    } else {
      // Stop sending cursor/selection updates
      this.disablePresenterMode();
    }
  }
  
  enablePresenterMode() {
    // Send cursor updates on mouse move
    this.diagramEditor.on('mousemove', (event) => {
      if (this.isPresenter) {
        this.wsClient.send({
          message_type: 'presenter_cursor',
          user_id: this.currentUser.email,
          cursor_position: { x: event.x, y: event.y }
        });
      }
    });
    
    // Send selection updates
    this.diagramEditor.on('selectionChanged', (selectedCells) => {
      if (this.isPresenter) {
        this.wsClient.send({
          message_type: 'presenter_selection',
          user_id: this.currentUser.email,
          selected_cells: selectedCells.map(cell => cell.id)
        });
      }
    });
  }
  
  handlePresenterCursor(message) {
    if (message.user_id !== this.currentUser.email) {
      this.showPresenterCursor(message.cursor_position);
    }
  }
  
  handlePresenterSelection(message) {
    if (message.user_id !== this.currentUser.email) {
      this.highlightPresenterSelection(message.selected_cells);
    }
  }
}
```

### 3. Conflict Resolution & State Correction

```javascript
class StateManager {
  handleStateCorrection(message) {
    console.log('Received state correction, updating local state');
    
    this.isApplyingRemoteChange = true;
    
    try {
      // Apply corrected state for each cell
      for (const cell of message.cells) {
        this.diagramEditor.updateCell(cell.id, cell, { 
          source: 'server_correction' 
        });
      }
      
      // Show user notification
      this.showNotification('Diagram synchronized with server', 'info');
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }
  
  handleAuthorizationDenied(message) {
    // Show error to user
    this.showNotification(
      `Operation denied: ${message.reason}`, 
      'error'
    );
    
    // The server will send a state_correction message next
  }
}
```

## Error Handling & Recovery

### 1. Sync Issue Detection

```javascript
class SyncManager {
  constructor() {
    this.expectedSequence = 0;
    this.outOfSyncWarnings = 0;
  }
  
  handleDiagramOperation(message) {
    // Check for sequence issues (if server provides sequence numbers)
    if (message.sequence_number) {
      if (this.expectedSequence > 0 && 
          message.sequence_number !== this.expectedSequence + 1) {
        this.handleSequenceGap(message.sequence_number);
      }
      this.expectedSequence = message.sequence_number;
    }
    
    // Apply the operation
    this.applyOperation(message.operation);
  }
  
  handleSequenceGap(actualSequence) {
    this.outOfSyncWarnings++;
    console.warn('Sequence gap detected:', {
      expected: this.expectedSequence + 1,
      received: actualSequence,
      warnings: this.outOfSyncWarnings
    });
    
    if (this.outOfSyncWarnings >= 3) {
      this.requestResync();
    }
  }
  
  requestResync() {
    console.log('Requesting resync due to sync issues');
    this.wsClient.send({
      message_type: 'resync_request',
      user_id: this.currentUser.email
    });
  }
  
  handleResyncResponse(message) {
    if (message.method === 'rest_api') {
      this.performRESTResync();
    }
  }
  
  async performRESTResync() {
    try {
      // Use existing REST API to get authoritative state
      const response = await fetch(
        `/threat_models/${this.threatModelId}/diagrams/${this.diagramId}`,
        {
          headers: { 'Authorization': `Bearer ${this.jwtToken}` }
        }
      );
      
      const diagram = await response.json();
      
      // Replace entire local diagram state
      this.isApplyingRemoteChange = true;
      this.diagramEditor.replaceDiagram(diagram);
      this.isApplyingRemoteChange = false;
      
      // Reset sync tracking
      this.outOfSyncWarnings = 0;
      this.expectedSequence = 0;
      
      this.showNotification('Diagram synchronized', 'success');
    } catch (error) {
      console.error('Resync failed:', error);
      this.showNotification('Failed to synchronize diagram', 'error');
    }
  }
}
```

### 2. Reconnection Logic

```javascript
class ConnectionManager {
  constructor() {
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start at 1 second
  }
  
  scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showNotification('Connection lost. Please refresh the page.', 'error');
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 
      30000 // Max 30 seconds
    );
    
    setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }
  
  async attemptReconnection() {
    this.reconnectAttempts++;
    
    try {
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success
      this.showNotification('Connection restored', 'success');
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.scheduleReconnection();
    }
  }
}
```

### 3. Undo/Redo Integration

```javascript
class HistoryManager {
  handleHistoryOperation(message) {
    switch (message.message) {
      case 'resync_required':
        // Server processed undo/redo successfully, need to resync
        this.performRESTResync();
        this.showNotification(
          `${message.operation_type} completed, refreshing diagram`, 
          'info'
        );
        break;
        
      case 'no_operations_to_undo':
        this.showNotification('No operations to undo', 'info');
        break;
        
      case 'no_operations_to_redo':
        this.showNotification('No operations to redo', 'info');
        break;
    }
  }
  
  // Disable local undo/redo during collaboration
  initializeCollaborativeMode() {
    // Replace local undo/redo with server requests
    this.diagramEditor.setUndoHandler(() => {
      this.wsClient.send({
        message_type: 'undo_request',
        user_id: this.currentUser.email
      });
    });
    
    this.diagramEditor.setRedoHandler(() => {
      this.wsClient.send({
        message_type: 'redo_request',
        user_id: this.currentUser.email
      });
    });
  }
}
```

## Best Practices

### 1. Performance Optimization

```javascript
// Throttle high-frequency events
class PerformanceOptimizer {
  constructor() {
    this.cursorThrottle = this.throttle(this.sendCursor.bind(this), 100);
    this.selectionDebounce = this.debounce(this.sendSelection.bind(this), 250);
  }
  
  throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(function() {
          if ((Date.now() - lastRan) >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    }
  }
  
  debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
}
```

### 2. User Experience Guidelines

```javascript
class UXManager {
  showOperationFeedback(userId, operation) {
    // Show subtle notification of other users' actions
    const userName = this.getUserDisplayName(userId);
    const cellCount = operation.cells.length;
    
    let message = `${userName}`;
    if (cellCount === 1) {
      const op = operation.cells[0].operation;
      message += ` ${op}ed a cell`;
    } else {
      message += ` modified ${cellCount} cells`;
    }
    
    this.showToast(message, { duration: 2000, type: 'info' });
  }
  
  showPresenterIndicator(presenterName) {
    // Show who is currently presenting
    this.updatePresenterBadge(presenterName);
    
    // Show presenter cursor with their name
    this.enablePresenterCursorDisplay(presenterName);
  }
  
  handlePermissionError() {
    // Clear explanation for read-only users
    this.showDialog({
      title: 'Read-only Access',
      message: 'You have read-only access to this diagram. You can view changes but cannot edit.',
      type: 'info'
    });
  }
}
```

### 3. Data Validation

```javascript
class ValidationManager {
  validateOperation(operation) {
    // Validate before sending
    if (!operation.operation_id || !this.isValidUUID(operation.operation_id)) {
      throw new Error('Invalid operation ID');
    }
    
    if (!operation.operation || !operation.operation.cells) {
      throw new Error('Invalid operation structure');
    }
    
    for (const cellOp of operation.operation.cells) {
      this.validateCellOperation(cellOp);
    }
  }
  
  validateCellOperation(cellOp) {
    if (!cellOp.id || !this.isValidUUID(cellOp.id)) {
      throw new Error('Invalid cell ID');
    }
    
    if (!['add', 'update', 'remove'].includes(cellOp.operation)) {
      throw new Error('Invalid cell operation type');
    }
    
    if ((cellOp.operation === 'add' || cellOp.operation === 'update') && !cellOp.data) {
      throw new Error('Cell data required for add/update operations');
    }
  }
}
```

## TypeScript Definitions

```typescript
// Collaboration Session Types
interface CollaborationSession {
  session_id: string;
  session_manager: string;
  threat_model_id: string;
  threat_model_name: string;
  diagram_id: string;
  diagram_name: string;
  participants: SessionParticipant[];
  websocket_url: string;
}

interface SessionParticipant {
  user_id: string;
  joined_at: string; // ISO 8601 timestamp
  permissions: 'reader' | 'writer';
}

interface SessionManagerConfig {
  jwtToken: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

interface SessionJoinResult {
  session: CollaborationSession;
  isNewSession: boolean;
  participantCount: number;
}

// Message Types
interface DiagramOperationMessage {
  message_type: 'diagram_operation';
  user_id: string;
  operation_id: string;
  sequence_number?: number;
  operation: CellPatchOperation;
}

interface CellPatchOperation {
  type: 'patch';
  cells: CellOperation[];
}

interface CellOperation {
  id: string;
  operation: 'add' | 'update' | 'remove';
  data?: Cell;
}

interface Cell {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  [key: string]: any;
}

// Presenter Mode
interface PresenterRequestMessage {
  message_type: 'presenter_request';
  user_id: string;
}

interface CurrentPresenterMessage {
  message_type: 'current_presenter';
  current_presenter: string;
}

interface PresenterCursorMessage {
  message_type: 'presenter_cursor';
  user_id: string;
  cursor_position: { x: number; y: number };
}

// Error Handling
interface AuthorizationDeniedMessage {
  message_type: 'authorization_denied';
  original_operation_id: string;
  reason: string;
}

interface StateCorrectionMessage {
  message_type: 'state_correction';
  cells: Cell[];
}

interface ResyncResponseMessage {
  message_type: 'resync_response';
  user_id: string;
  target_user: string;
  method: 'rest_api';
  diagram_id: string;
  threat_model_id: string;
}

// History Operations
interface UndoRequestMessage {
  message_type: 'undo_request';
  user_id: string;
}

interface HistoryOperationMessage {
  message_type: 'history_operation';
  operation_type: 'undo' | 'redo';
  message: 'resync_required' | 'no_operations_to_undo' | 'no_operations_to_redo';
}

// Participant Join/Leave Events (Legacy Format)
interface UserJoinedEvent {
  event: 'join';
  user_id: string;
  timestamp: string; // ISO 8601 timestamp
}

interface UserLeftEvent {
  event: 'leave';
  user_id: string;
  timestamp: string; // ISO 8601 timestamp
}

// Union type for all WebSocket messages
type WebSocketMessage = DiagramOperationMessage | 
                       PresenterRequestMessage | 
                       CurrentPresenterMessage | 
                       PresenterCursorMessage |
                       AuthorizationDeniedMessage |
                       StateCorrectionMessage |
                       ResyncResponseMessage |
                       UndoRequestMessage |
                       HistoryOperationMessage |
                       UserJoinedEvent |
                       UserLeftEvent;

// Client Configuration
interface TMIClientConfig {
  diagramId: string;
  threatModelId: string;
  jwtToken: string;
  serverUrl: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}
```

## Example Implementation

### Complete Client Class

```javascript
class TMICollaborativeClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.ws = null;
    this.currentUser = this.parseJWT(config.jwtToken);
    this.isConnected = false;
    this.isApplyingRemoteChange = false;
    
    // Managers
    this.connectionManager = new ConnectionManager(this);
    this.presenterManager = new PresenterModeManager(this);
    this.syncManager = new SyncManager(this);
    this.historyManager = new HistoryManager(this);
  }
  
  async connect() {
    const url = this.buildWebSocketURL();
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      this.isConnected = true;
      this.emit('connected');
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.emit('disconnected', event);
      if (event.code !== 1000) {
        this.connectionManager.scheduleReconnection();
      }
    };
    
    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }
  
  handleMessage(message) {
    // Emit specific events for different message types
    this.emit(message.message_type, message);
    this.emit('message', message);
  }
  
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }
  
  // High-level API methods
  async addCell(cellData) {
    const operation = {
      message_type: 'diagram_operation',
      user_id: this.currentUser.email,
      operation_id: this.generateUUID(),
      operation: {
        type: 'patch',
        cells: [{
          id: cellData.id,
          operation: 'add',
          data: cellData
        }]
      }
    };
    
    this.send(operation);
  }
  
  async updateCell(cellId, updates) {
    const operation = {
      message_type: 'diagram_operation',
      user_id: this.currentUser.email,
      operation_id: this.generateUUID(),
      operation: {
        type: 'patch',
        cells: [{
          id: cellId,
          operation: 'update',
          data: updates
        }]
      }
    };
    
    this.send(operation);
  }
  
  async removeCell(cellId) {
    const operation = {
      message_type: 'diagram_operation',
      user_id: this.currentUser.email,
      operation_id: this.generateUUID(),
      operation: {
        type: 'patch',
        cells: [{
          id: cellId,
          operation: 'remove'
        }]
      }
    };
    
    this.send(operation);
  }
  
  requestPresenterMode() {
    this.send({
      message_type: 'presenter_request',
      user_id: this.currentUser.email
    });
  }
  
  sendUndo() {
    this.send({
      message_type: 'undo_request',
      user_id: this.currentUser.email
    });
  }
  
  sendRedo() {
    this.send({
      message_type: 'redo_request',
      user_id: this.currentUser.email
    });
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
  }
}
```

## Testing Guide

### Unit Testing Message Handlers

```javascript
describe('TMICollaborativeClient', () => {
  let client;
  let mockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    client = new TMICollaborativeClient(testConfig);
    client.ws = mockWebSocket;
  });
  
  test('should handle diagram operations without echo', () => {
    const operation = {
      message_type: 'diagram_operation',
      user_id: 'other@example.com', // Not current user
      operation_id: 'test-uuid',
      operation: {
        type: 'patch',
        cells: [{ id: 'cell-1', operation: 'add', data: mockCellData }]
      }
    };
    
    const applySpy = jest.spyOn(client, 'applyOperationToEditor');
    client.handleMessage(operation);
    
    expect(applySpy).toHaveBeenCalledWith(operation.operation);
  });
  
  test('should not echo own operations', () => {
    const operation = {
      message_type: 'diagram_operation',
      user_id: client.currentUser.email, // Same as current user
      operation_id: 'test-uuid',
      operation: { type: 'patch', cells: [] }
    };
    
    const applySpy = jest.spyOn(client, 'applyOperationToEditor');
    client.handleMessage(operation);
    
    expect(applySpy).not.toHaveBeenCalled();
  });
});
```

### Integration Testing

```javascript
describe('Collaborative Editing Integration', () => {
  test('should maintain sync across multiple clients', async () => {
    const client1 = new TMICollaborativeClient(config1);
    const client2 = new TMICollaborativeClient(config2);
    
    await Promise.all([client1.connect(), client2.connect()]);
    
    // Client 1 adds a cell
    await client1.addCell(testCell);
    
    // Client 2 should receive the operation
    await new Promise(resolve => {
      client2.on('diagram_operation', (op) => {
        expect(op.operation.cells[0].data).toEqual(testCell);
        resolve();
      });
    });
  });
});
```

### Error Scenario Testing

```javascript
test('should handle authorization denied gracefully', () => {
  const deniedMessage = {
    message_type: 'authorization_denied',
    original_operation_id: 'test-uuid',
    reason: 'insufficient_permissions'
  };
  
  const errorSpy = jest.spyOn(client, 'emit');
  client.handleMessage(deniedMessage);
  
  expect(errorSpy).toHaveBeenCalledWith('authorization_denied', deniedMessage);
});

test('should request resync after multiple sync warnings', () => {
  const sendSpy = jest.spyOn(client, 'send');
  
  // Simulate multiple sequence gaps
  for (let i = 0; i < 3; i++) {
    client.syncManager.handleSequenceGap(i + 10);
  }
  
  expect(sendSpy).toHaveBeenCalledWith({
    message_type: 'resync_request',
    user_id: client.currentUser.email
  });
});
```

## Summary

This client integration guide provides everything needed to implement robust collaborative editing:

- ✅ **Complete WebSocket protocol implementation** with all message types
- ✅ **Echo prevention** to avoid infinite loops  
- ✅ **Presenter mode** with cursor and selection sharing
- ✅ **State synchronization** with automatic conflict resolution
- ✅ **Error handling** with graceful recovery mechanisms
- ✅ **Performance optimization** with throttling and debouncing
- ✅ **TypeScript support** with complete type definitions
- ✅ **Testing strategies** for both unit and integration scenarios

Follow the patterns in this guide to build a production-ready collaborative diagram editor that integrates seamlessly with the TMI server.