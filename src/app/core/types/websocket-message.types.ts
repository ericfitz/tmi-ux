/**
 * TypeScript definitions for TMI WebSocket collaborative editing messages
 * Based on tmi-asyncapi.yaml specification
 */

/**
 * User information from WebSocket messages
 * Server now uses full User schema from OpenAPI (includes Principal base fields)
 * Based on JWT claims with user_id as primary identifier
 */
export interface User {
  user_id: string; // JWT 'sub' claim (primary identifier, e.g., "auth0|507f1f77bcf86cd799439011")
  email?: string; // Fallback identifier for authorization
  displayName?: string; // JWT 'name' claim (optional)
  provider?: string; // Identity provider (e.g., "google", "github", "microsoft", "test") - from Principal base
  provider_id?: string; // Provider-specific user ID - from Principal base
  principal_type?: 'user'; // Always "user" when present - from Principal base
}

export interface CursorPosition {
  x: number;
  y: number;
}

/**
 * Cell in X6 v2 native nested format matching the API schema
 *
 * The API accepts both formats for backward compatibility:
 * - Nested format (X6 v2): position {x,y} and size {width,height} objects
 * - Flat format (X6 v1 legacy): x, y, width, height as direct properties
 *
 * The API prefers nested format, and X6 v2's toJSON() produces nested format.
 * The application normalizes all cells to nested format on import for consistency.
 *
 * No convenience properties - use attrs.text.text for labels
 */
export interface Cell {
  id: string;
  shape: string;
  // X6 v2 native nested format properties
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  // X6 v1 legacy flat format (accepted for backward compatibility, normalized to nested on import)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  attrs?: Record<string, unknown>;
  source?: unknown; // For edges - X6 source format
  target?: unknown; // For edges - X6 target format
  [key: string]: unknown;
}

export interface CellOperation {
  id: string;
  operation: 'add' | 'update' | 'remove';
  data?: Cell;
}

export interface CellPatchOperation {
  type: 'patch';
  cells: CellOperation[];
}

/**
 * Client-to-server diagram operation request
 * Client does not send initiating_user - server uses authenticated context
 */
export interface DiagramOperationRequestMessage {
  message_type: 'diagram_operation_request';
  operation_id: string;
  sequence_number?: number;
  operation: CellPatchOperation;
}

/**
 * Server-to-client diagram operation event (broadcast)
 * Server adds initiating_user showing who triggered the operation
 */
export interface DiagramOperationEventMessage {
  message_type: 'diagram_operation_event';
  initiating_user: User;
  operation_id: string;
  sequence_number?: number;
  operation: CellPatchOperation;
}

/**
 * @deprecated Use DiagramOperationEventMessage for received messages
 * Kept for backward compatibility during transition
 */
export type DiagramOperationMessage = DiagramOperationEventMessage;

export interface PresenterRequestMessage {
  message_type: 'presenter_request';
}

/**
 * Extended version of PresenterRequestMessage with server-added user field
 * NOTE: The AsyncAPI schema does not include a user field (clients send without it),
 * but the server includes it when broadcasting the request to the host.
 * This is a gap between the schema and implementation.
 */
export interface PresenterRequestMessageWithUser extends PresenterRequestMessage {
  user: User;
}

export interface PresenterDeniedMessage {
  message_type: 'presenter_denied';
  current_presenter: User;
}

/**
 * Client-to-server request to change the active presenter (host only)
 * Client does not send initiating_user - server uses authenticated context
 */
export interface ChangePresenterRequestMessage {
  message_type: 'change_presenter_request';
  new_presenter?: User;
}

/**
 * @deprecated Use ChangePresenterRequestMessage for client requests
 * Kept for backward compatibility during transition
 */
export type ChangePresenterMessage = ChangePresenterRequestMessage;

/**
 * Server-to-client event broadcasting current presenter (broadcast to all)
 * Includes initiating_user showing who triggered the presenter change
 */
export interface CurrentPresenterMessage {
  message_type: 'current_presenter';
  initiating_user: User;
  current_presenter: User;
}

export interface PresenterCursorMessage {
  message_type: 'presenter_cursor';
  cursor_position: CursorPosition;
  user?: User; // Optional when sending, server adds when broadcasting
}

export interface PresenterSelectionMessage {
  message_type: 'presenter_selection';
  selected_cells: string[];
  user?: User; // Optional when sending, server adds when broadcasting
}

export interface AuthorizationDeniedMessage {
  message_type: 'authorization_denied';
  original_operation_id: string;
  reason: 'insufficient_permissions' | 'read_only_user' | 'invalid_user';
}

export interface StateCorrectionMessage {
  message_type: 'state_correction';
  update_vector: number;
}

export interface DiagramStateSyncMessage {
  message_type: 'diagram_state_sync';
  diagram_id: string;
  update_vector: number | null;
  cells: Cell[];
}

export interface ResyncRequestMessage {
  message_type: 'resync_request';
}

export interface ResyncResponseMessage {
  message_type: 'resync_response';
  method: 'rest_api';
  diagram_id: string;
  threat_model_id?: string;
}

/**
 * Client-to-server undo request
 * Client does not send initiating_user - server uses authenticated context
 */
export interface UndoRequestMessage {
  message_type: 'undo_request';
}

/**
 * Client-to-server redo request
 * Client does not send initiating_user - server uses authenticated context
 */
export interface RedoRequestMessage {
  message_type: 'redo_request';
}

/**
 * Participant information from AsyncAPI spec
 * Note: Uses 'permissions' (not 'role')
 * User object now includes provider field from full User schema (Principal base)
 * Field names use JSON serialization format: user_id (not provider_id), name (not display_name)
 */
export interface Participant {
  user: {
    principal_type?: 'user'; // Always "user" for participants
    provider?: string; // Identity provider (e.g., "google", "github", "microsoft", "test") - optional per AsyncAPI spec
    user_id: string; // Provider-specific user ID (JSON serialization of provider_id)
    email: string; // Email address (required)
    name?: string; // Display name for UI (JSON serialization of display_name)
    display_name?: string; // Alternative field name from OpenAPI schema (fallback)
  };
  permissions: 'reader' | 'writer'; // Note: no 'owner' value in spec
  last_activity: string;
}

/**
 * Server-to-client event with complete participant list
 * Sent whenever the participant list changes (join/leave/kick)
 * initiating_user is null for system events (join/leave), populated for user-initiated events (kick)
 */
export interface ParticipantsUpdateMessage {
  message_type: 'participants_update';
  initiating_user: User | null; // null for join/leave, User for kicks
  participants: Participant[];
  host: string; // user_id of the host (required)
  current_presenter: string; // user_id of current presenter (required, may be empty string)
}

/**
 * @deprecated Server no longer sends this message type
 * Clients detect joins by comparing participant lists in participants_update
 * Kept for internal synthetic domain events
 */
export interface ParticipantJoinedMessage {
  message_type: 'participant_joined';
  joined_user: User;
  timestamp: string;
}

/**
 * @deprecated Server no longer sends this message type
 * Clients detect leaves by comparing participant lists in participants_update
 * Kept for internal synthetic domain events
 */
export interface ParticipantLeftMessage {
  message_type: 'participant_left';
  departed_user: User;
  timestamp: string;
}

/**
 * Client-to-server request to remove a participant from the session (host only)
 * Client does not send initiating_user - server uses authenticated context
 * When processed, server broadcasts participants_update with initiating_user
 */
export interface RemoveParticipantRequestMessage {
  message_type: 'remove_participant_request';
  removed_user: User;
}

/**
 * @deprecated Use RemoveParticipantRequestMessage for client requests
 * The server does not echo this message back; it broadcasts participants_update instead
 */
export type RemoveParticipantMessage = RemoveParticipantRequestMessage;

/**
 * @deprecated Server no longer sends this message type
 * Kept for backward compatibility during transition
 */
export interface RemoveParticipantMessageWithInitiator extends RemoveParticipantRequestMessage {
  user: User;
}

export interface WebSocketErrorMessage {
  message_type: 'error';
  error: string;
  message: string;
  timestamp: string;
}

export interface OperationRejectedMessage {
  message_type: 'operation_rejected';
  operation_id: string;
  sequence_number?: number;
  reason:
    | 'validation_failed'
    | 'conflict_detected'
    | 'no_state_change'
    | 'diagram_not_found'
    | 'permission_denied'
    | 'invalid_operation_type'
    | 'empty_operation';
  message: string;
  details?: string;
  affected_cells?: string[];
  requires_resync: boolean;
  timestamp: string;
}

export type TMIWebSocketMessage =
  | DiagramOperationRequestMessage
  | DiagramOperationEventMessage
  // deprecated alias
  | PresenterRequestMessage
  | PresenterDeniedMessage
  | ChangePresenterRequestMessage
  // deprecated alias
  | CurrentPresenterMessage
  | PresenterCursorMessage
  | PresenterSelectionMessage
  | AuthorizationDeniedMessage
  | StateCorrectionMessage
  | DiagramStateSyncMessage
  | ResyncRequestMessage
  | ResyncResponseMessage
  | UndoRequestMessage
  | RedoRequestMessage
  | ParticipantsUpdateMessage
  | ParticipantJoinedMessage // deprecated (synthetic only)
  | ParticipantLeftMessage // deprecated (synthetic only)
  | RemoveParticipantRequestMessage
  // deprecated alias
  | WebSocketErrorMessage
  | OperationRejectedMessage;

export type TMIMessageType =
  | 'diagram_operation' // deprecated
  | 'diagram_operation_request'
  | 'diagram_operation_event'
  | 'presenter_request'
  | 'presenter_denied'
  | 'change_presenter' // deprecated
  | 'change_presenter_request'
  | 'current_presenter'
  | 'presenter_cursor'
  | 'presenter_selection'
  | 'authorization_denied'
  | 'state_correction'
  | 'diagram_state_sync'
  | 'resync_request'
  | 'resync_response'
  | 'undo_request'
  | 'redo_request'
  | 'participants_update'
  | 'participant_joined' // deprecated (synthetic only)
  | 'participant_left' // deprecated (synthetic only)
  | 'remove_participant' // deprecated
  | 'remove_participant_request'
  | 'error'
  | 'operation_rejected';

/**
 * Options for applying remote operations to local graph
 */
export interface RemoteOperationOptions {
  suppressHistory?: boolean;
  ensureVisualRendering?: boolean;
  updatePortVisibility?: boolean;
  applyVisualEffects?: boolean;
}

/**
 * Configuration for collaborative operation service
 */
export interface CollaborativeOperationConfig {
  diagramId: string;
  threatModelId: string;
  userId: string;
  threatModelPermission?: 'reader' | 'writer';
  enableThrottling?: boolean;
  cursorThrottleMs?: number;
  selectionDebounceMs?: number;
}
