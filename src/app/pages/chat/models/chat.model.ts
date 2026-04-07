/**
 * Chat feature models for the Timmy chat bot.
 *
 * These types define the data structures for chat sessions, messages,
 * SSE events, and preparation status for the server-integrated chat.
 */

// SseEvent is defined in the core interfaces layer so that core services can use
// it without violating the feature-module import restriction.
export type { SseEvent } from '../../../core/interfaces/sse.interface';

export type EntityType = 'document' | 'repository' | 'diagram' | 'note' | 'asset' | 'threat';

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  token_count?: number;
  sequence: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  threat_model_id: string;
  title: string;
  source_snapshot: SourceSnapshotEntry[];
  status: 'active' | 'archived';
  created_at: string;
  modified_at: string;
}

export interface SourceSnapshotEntry {
  entity_type: EntityType;
  entity_id: string;
  entity_name?: string;
}

export interface ListSessionsResponse {
  sessions: ChatSession[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListMessagesResponse {
  messages: ChatMessage[];
  total: number;
  limit: number;
  offset: number;
}

// Session creation SSE events
// Field names match the server's snake_case JSON payloads.
export interface SessionCreatedEvent {
  id: string;
  source_snapshot: SourceSnapshotEntry[];
  status: string;
  threat_model_id: string;
  user_id: string;
  created_at: string;
  modified_at: string;
}

export interface ProgressEvent {
  phase: string;
  entity_type: string;
  entity_name: string;
  progress: number;
  detail?: string;
}

export interface ReadyEvent {
  status: string;
  sources_loaded?: number;
  chunks_embedded?: number;
}

// Message streaming SSE events
// Field names match the server's snake_case JSON payloads.
export interface MessageStartEvent {
  message_id: string;
  role: 'assistant';
}

export interface TokenEvent {
  content: string;
}

export interface MessageEndEvent {
  message_id: string;
  token_count: number;
}

// Error event (can occur in either stream)
export interface ChatErrorEvent {
  code: string;
  message: string;
}

/** Client-side preparation status for the ephemeral status bubble. */
export interface PreparationStatus {
  phase: string;
  entityName: string;
  progress: number;
  current: number;
  total: number;
  ready?: boolean;
  readyStats?: ReadyEvent;
  error?: string;
}
