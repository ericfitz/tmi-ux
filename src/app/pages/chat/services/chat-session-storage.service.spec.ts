// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { ChatSessionStorageService } from './chat-session-storage.service';
import { LoggerService } from '../../../core/services/logger.service';
import { createMockLoggerService } from '../../../../testing/mocks';
import { ChatMessage } from '../models/chat.model';

describe('ChatSessionStorageService', () => {
  let service: ChatSessionStorageService;

  beforeEach(() => {
    const logger = createMockLoggerService() as unknown as LoggerService;
    service = new ChatSessionStorageService(logger);
  });

  it('should create a session', async () => {
    const session = await service.createSession('tm-1', 'Test Session');

    expect(session.id).toBeTruthy();
    expect(session.threatModelId).toBe('tm-1');
    expect(session.title).toBe('Test Session');
    expect(session.messages).toHaveLength(0);
    expect(session.createdAt).toBeTruthy();
    expect(session.lastMessageAt).toBeTruthy();
  });

  it('should list sessions for a threat model', async () => {
    await service.createSession('tm-1', 'Session 1');
    await service.createSession('tm-1', 'Session 2');
    await service.createSession('tm-2', 'Other Session');

    const sessions = await service.listSessions('tm-1');
    expect(sessions).toHaveLength(2);
    expect(sessions.every(s => s.threatModelId === 'tm-1')).toBe(true);
  });

  it('should return sessions sorted by lastMessageAt descending', async () => {
    const s1 = await service.createSession('tm-1', 'Older');
    await service.createSession('tm-1', 'Newer');

    // Append a message to s1 to make it more recent
    const msg: ChatMessage = {
      id: 'msg-1',
      sessionId: s1.id,
      role: 'user',
      content: 'Hello',
      timestamp: new Date(Date.now() + 1000).toISOString(),
    };
    await service.appendMessage(s1.id, msg);

    const sessions = await service.listSessions('tm-1');
    expect(sessions[0].id).toBe(s1.id);
  });

  it('should get a session by id', async () => {
    const created = await service.createSession('tm-1', 'Test');
    const retrieved = await service.getSession(created.id);

    expect(retrieved).toBeTruthy();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.title).toBe('Test');
  });

  it('should return undefined for nonexistent session', async () => {
    const result = await service.getSession('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should append messages to a session', async () => {
    const session = await service.createSession('tm-1', 'Chat');

    const msg: ChatMessage = {
      id: 'msg-1',
      sessionId: session.id,
      role: 'user',
      content: 'Hello Timmy',
      timestamp: '2025-06-01T10:00:00Z',
    };

    await service.appendMessage(session.id, msg);

    const updated = await service.getSession(session.id);
    expect(updated!.messages).toHaveLength(1);
    expect(updated!.messages[0].content).toBe('Hello Timmy');
    expect(updated!.lastMessageAt).toBe('2025-06-01T10:00:00Z');
  });

  it('should delete a session', async () => {
    const session = await service.createSession('tm-1', 'To Delete');
    await service.deleteSession(session.id);

    const result = await service.getSession(session.id);
    expect(result).toBeUndefined();

    const sessions = await service.listSessions('tm-1');
    expect(sessions).toHaveLength(0);
  });

  it('should update session title', async () => {
    const session = await service.createSession('tm-1', 'Original');
    await service.updateSessionTitle(session.id, 'Updated Title');

    const updated = await service.getSession(session.id);
    expect(updated!.title).toBe('Updated Title');
  });
});
