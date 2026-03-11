// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { MockChatService } from './mock-chat.service';
import { ChatContextPayload, ChatMessage } from '../models/chat.model';

describe('MockChatService', () => {
  let service: MockChatService;

  const mockContext: ChatContextPayload = {
    threatModel: {
      id: 'tm-1',
      name: 'Test Model',
      description: 'A test threat model',
      framework: 'STRIDE',
    },
    entities: [
      { type: 'threat', id: 't-1', name: 'SQL Injection', summary: 'SQL injection via input' },
      { type: 'threat', id: 't-2', name: 'XSS', summary: 'Cross-site scripting' },
      { type: 'asset', id: 'a-1', name: 'Database', summary: 'Customer data store' },
      { type: 'note', id: 'n-1', name: 'Security Note', summary: 'Important security info' },
    ],
  };

  beforeEach(() => {
    service = new MockChatService();
  });

  it('should return a ChatMessage observable', async () => {
    const result = await firstValueFrom(service.sendMessage('Hello', mockContext, []));

    expect(result.role).toBe('assistant');
    expect(result.content).toBeTruthy();
    expect(result.id).toBeTruthy();
    expect(result.timestamp).toBeTruthy();
  });

  it('should return a greeting for first message', async () => {
    const result = await firstValueFrom(service.sendMessage('Hello', mockContext, []));

    expect(result.content).toContain('Timmy');
    expect(result.content).toContain('Test Model');
    expect(result.content).toContain('STRIDE');
  });

  it('should respond to threat-related queries', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        sessionId: 's-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        sessionId: 's-1',
        role: 'assistant',
        content: 'Hi!',
        timestamp: '2025-01-01T00:00:01Z',
      },
    ];

    const result = await firstValueFrom(
      service.sendMessage('Tell me about the threats', mockContext, history),
    );

    expect(result.content).toContain('threat');
    expect(result.content).toContain('SQL Injection');
  });

  it('should respond to asset-related queries', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        sessionId: 's-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2025-01-01T00:00:00Z',
      },
    ];

    const result = await firstValueFrom(
      service.sendMessage('What assets are in scope?', mockContext, history),
    );

    expect(result.content).toContain('asset');
    expect(result.content).toContain('Database');
  });

  it('should respond to summary requests', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        sessionId: 's-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2025-01-01T00:00:00Z',
      },
    ];

    const result = await firstValueFrom(
      service.sendMessage('Give me a summary', mockContext, history),
    );

    expect(result.content).toContain('Summary');
    expect(result.content).toContain('Test Model');
  });

  it('should handle empty context gracefully', async () => {
    const emptyContext: ChatContextPayload = {
      threatModel: { id: 'tm-1', name: 'Empty Model', framework: 'CIA' },
      entities: [],
    };

    const result = await firstValueFrom(
      service.sendMessage('Tell me about threats', emptyContext, [
        {
          id: '1',
          sessionId: 's-1',
          role: 'user',
          content: 'Hello',
          timestamp: '2025-01-01T00:00:00Z',
        },
      ]),
    );

    expect(result.content).toContain('No threats');
  });
});
