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

export interface Cell {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
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
  user: User;
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
  permissions: 'reader' | 'writer';
  last_activity: string;
}

export interface ParticipantsUpdateMessage {
  message_type: 'participants_update';
  participants: Participant[];
  host: string;
  current_presenter: string | null;
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

export interface SessionTerminatedMessage {
  message_type: 'session_terminated';
  reason: string;
  host_id: string;
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
  | ResyncRequestMessage
  | ResyncResponseMessage
  | UndoRequestMessage
  | RedoRequestMessage
  | HistoryOperationMessage
  | ParticipantsUpdateMessage
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | SessionTerminatedMessage;

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
  | 'resync_request'
  | 'resync_response'
  | 'undo_request'
  | 'redo_request'
  | 'history_operation'
  | 'participants_update'
  | 'participant_joined'
  | 'participant_left'
  | 'session_terminated';

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
