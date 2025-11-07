/**
 * TypeScript definitions for TMI WebSocket collaborative editing messages
 * Based on tmi-asyncapi.yaml specification
 */

export interface User {
  user_id: string;
  email: string;
  displayName: string;
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

export interface DiagramOperationMessage {
  message_type: 'diagram_operation';
  initiating_user: User;
  operation_id: string;
  sequence_number?: number;
  operation: CellPatchOperation;
}

export interface PresenterRequestMessage {
  message_type: 'presenter_request';
  user: User;
}

export interface PresenterDeniedMessage {
  message_type: 'presenter_denied';
  user: User;
  target_user: string;
}

export interface ChangePresenterMessage {
  message_type: 'change_presenter';
  user: User;
  new_presenter: string;
}

export interface CurrentPresenterMessage {
  message_type: 'current_presenter';
  current_presenter: string;
}

export interface PresenterCursorMessage {
  message_type: 'presenter_cursor';
  user: User;
  cursor_position: CursorPosition;
}

export interface PresenterSelectionMessage {
  message_type: 'presenter_selection';
  user: User;
  selected_cells: string[];
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
  user: User;
}

export interface ResyncResponseMessage {
  message_type: 'resync_response';
  user: User;
  target_user: string;
  method: 'rest_api';
  diagram_id: string;
  threat_model_id: string;
}

export interface UndoRequestMessage {
  message_type: 'undo_request';
  user: User;
}

export interface RedoRequestMessage {
  message_type: 'redo_request';
  user: User;
}

export interface HistoryOperationMessage {
  message_type: 'history_operation';
  operation_type: 'undo' | 'redo';
  message: 'resync_required' | 'no_operations_to_undo' | 'no_operations_to_redo';
}

export interface Participant {
  user: {
    user_id: string;
    name: string;
    email: string;
  };
  permissions: 'reader' | 'writer' | 'owner';
  last_activity: string;
}

export interface ParticipantsUpdateMessage {
  message_type: 'participants_update';
  participants: Participant[];
  host?: string;
  current_presenter?: string | null;
}

export interface ParticipantJoinedMessage {
  message_type: 'participant_joined';
  user: User;
  timestamp: string;
}

export interface ParticipantLeftMessage {
  message_type: 'participant_left';
  user: User;
  timestamp: string;
}

export interface RemoveParticipantMessage {
  message_type: 'remove_participant';
  user: User;
  removed_user: User;
}

export interface SessionTerminatedMessage {
  message_type: 'session_terminated';
  reason: string;
  host_id: string;
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
  | DiagramOperationMessage
  | PresenterRequestMessage
  | PresenterDeniedMessage
  | ChangePresenterMessage
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
  | HistoryOperationMessage
  | ParticipantsUpdateMessage
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | RemoveParticipantMessage
  | SessionTerminatedMessage
  | OperationRejectedMessage
  | ChunkedMessage;

export type TMIMessageType =
  | 'diagram_operation'
  | 'presenter_request'
  | 'presenter_denied'
  | 'change_presenter'
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
  | 'history_operation'
  | 'participants_update'
  | 'participant_joined'
  | 'participant_left'
  | 'remove_participant'
  | 'session_terminated'
  | 'operation_rejected'
  | 'chunked_message';

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

/**
 * Chunked message types for handling large payloads
 */
export interface MessageChunkInfo {
  chunk_id: string;
  total_chunks: number;
  chunk_index: number;
  original_message_type: TMIMessageType;
  total_size: number;
}

export interface ChunkedMessage {
  message_type: 'chunked_message';
  chunk_info: MessageChunkInfo;
  chunk_data: string; // Base64 encoded chunk data
}

export interface ChunkReassemblyInfo {
  chunks: Map<number, string>;
  totalChunks: number;
  originalMessageType: TMIMessageType;
  totalSize: number;
  receivedAt: number;
}

/**
 * Constants for message chunking
 */
export const MESSAGE_CHUNK_CONSTANTS = {
  MAX_MESSAGE_SIZE: 64 * 1024, // 64KB
  CHUNK_SIZE: 60 * 1024, // 60KB to leave room for metadata
  CHUNK_TIMEOUT_MS: 30000, // 30 seconds timeout for chunk assembly
} as const;
