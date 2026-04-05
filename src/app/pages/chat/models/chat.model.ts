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
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  sequence: number;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  threatModelId: string;
  title: string;
  sourceSnapshot: SourceSnapshotEntry[];
  status: 'active' | 'archived';
  createdAt: string;
  modifiedAt: string;
}

export interface SourceSnapshotEntry {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
}

// Session creation SSE events
export interface SessionCreatedEvent {
  sessionId: string;
  sourceCount: number;
}

export interface ProgressEvent {
  phase: string;
  entityType: string;
  entityName: string;
  progress: number;
  detail?: string;
}

export interface ReadyEvent {
  sessionId: string;
  sourcesLoaded: number;
  chunksEmbedded: number;
  cachedReused: number;
  newlyEmbedded: number;
}

// Message streaming SSE events
export interface MessageStartEvent {
  messageId: string;
  role: 'assistant';
}

export interface TokenEvent {
  content: string;
}

export interface MessageEndEvent {
  messageId: string;
  tokenCount: number;
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
