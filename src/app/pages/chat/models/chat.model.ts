/**
 * Chat feature models for the Timmy chat bot.
 *
 * These types define the data structures for chat sessions, messages,
 * context configuration, and the serialized payload sent to the chat service.
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type EntityType = 'document' | 'repository' | 'diagram' | 'note' | 'asset' | 'threat';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  threatModelId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messages: ChatMessage[];
}

export interface ChatContextPayload {
  threatModel: {
    id: string;
    name: string;
    description?: string;
    framework: string;
  };
  entities: SerializedEntity[];
}

export interface SerializedEntity {
  type: EntityType;
  id: string;
  name: string;
  summary: string;
}

/** Metadata key used to exclude entities from Timmy chat context. */
export const TIMMY_METADATA_KEY = 'timmy';
