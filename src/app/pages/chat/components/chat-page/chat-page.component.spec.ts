// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError, EMPTY } from 'rxjs';

import { ChatPageComponent } from './chat-page.component';
import { ChatMessage } from '../../models/chat.model';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';

interface MockActivatedRoute {
  snapshot: {
    paramMap: {
      get: ReturnType<typeof vi.fn>;
    };
    data: Record<string, unknown>;
  };
}

interface MockTimmyChatService {
  createSession: ReturnType<typeof vi.fn>;
  listSessions: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  deleteSession: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  getMessages: ReturnType<typeof vi.fn>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

interface MockChangeDetectorRef {
  markForCheck: ReturnType<typeof vi.fn>;
}

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let mockRoute: MockActivatedRoute;
  let mockRouter: MockRouter;
  let mockTimmyChat: MockTimmyChatService;
  let mockLogger: MockLoggerService;
  let mockCdr: MockChangeDetectorRef;
  let mockTransloco: MockTranslocoService;

  beforeEach(() => {
    mockRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('tm-123'),
        },
        data: { threatModel: { id: 'tm-123', title: 'Test TM' } },
      },
    };

    mockRouter = createTypedMockRouter();

    mockTimmyChat = {
      createSession: vi.fn().mockReturnValue(EMPTY),
      listSessions: vi.fn().mockReturnValue(of([])),
      getSession: vi.fn().mockReturnValue(EMPTY),
      deleteSession: vi.fn().mockReturnValue(EMPTY),
      sendMessage: vi.fn().mockReturnValue(EMPTY),
      getMessages: vi.fn().mockReturnValue(of([])),
    };

    mockLogger = createTypedMockLoggerService();

    mockCdr = {
      markForCheck: vi.fn(),
    };

    mockTransloco = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    component = new ChatPageComponent(
      mockRoute as any,
      mockRouter as any,
      mockTimmyChat as any,
      mockLogger as any,
      mockCdr as any,
      mockTransloco as any,
      null, // destroyRef
    );

    component.ngOnInit();
  });

  describe('session creation error handling', () => {
    it('should show not-enabled message for 404 errors', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 404, statusText: 'Not Found' })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.notEnabled');
      expect(component.preparationStatus?.error).toBe('chat.errors.notEnabled');
    });

    it('should show not-acceptable message for 406 errors', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 406, statusText: 'Not Acceptable' })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.notAcceptable');
      expect(component.preparationStatus?.error).toBe('chat.errors.notAcceptable');
    });

    it('should show rate-limited message for 429 errors', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 429, statusText: 'Too Many Requests', retryAfter: 120 })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.rateLimited', {
        minutes: 2,
      });
    });

    it('should default retryAfter to 1 minute for 429 without retryAfter', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 429, statusText: 'Too Many Requests' })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.rateLimited', {
        minutes: 1,
      });
    });

    it('should show server-busy message for 503 errors', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 503, statusText: 'Service Unavailable' })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.serverBusy');
      expect(component.preparationStatus?.error).toBe('chat.errors.serverBusy');
    });

    it('should show connection-failed message for unknown errors', () => {
      mockTimmyChat.createSession.mockReturnValue(throwError(() => new Error('Network error')));

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.connectionFailed');
      expect(component.preparationStatus?.error).toBe('chat.errors.connectionFailed');
    });

    it('should show connection-failed message for 500 errors', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 500, statusText: 'Internal Server Error' })),
      );

      component.onMessageSent('test message');

      expect(mockTransloco.translate).toHaveBeenCalledWith('chat.errors.connectionFailed');
    });

    it('should log the error regardless of status code', () => {
      const error = { status: 404, statusText: 'Not Found' };
      mockTimmyChat.createSession.mockReturnValue(throwError(() => error));

      component.onMessageSent('test message');

      expect(mockLogger.error).toHaveBeenCalledWith('Session creation failed', error);
    });

    it('should mark change detection after error', () => {
      mockTimmyChat.createSession.mockReturnValue(
        throwError(() => ({ status: 404, statusText: 'Not Found' })),
      );

      component.onMessageSent('test message');

      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });
  });

  describe('save as note formatting', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'What threats exist?',
        sequence: 0,
        createdAt: '2026-04-05T14:34:00.000Z',
      },
      {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'There are **three** main threats.',
        tokenCount: 42,
        sequence: 1,
        createdAt: '2026-04-05T14:34:05.000Z',
      },
      {
        id: 'msg-3',
        sessionId: 'session-1',
        role: 'user',
        content: 'Tell me more about the first one.',
        sequence: 2,
        createdAt: '2026-04-05T14:35:00.000Z',
      },
      {
        id: 'msg-4',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'The first threat involves injection attacks.',
        tokenCount: 30,
        sequence: 3,
        createdAt: '2026-04-05T14:35:10.000Z',
      },
    ];

    beforeEach(() => {
      component.messages = mockMessages;
    });

    describe('formatSessionAsMarkdown', () => {
      it('should include all messages with role labels and timestamps', () => {
        const result = (component as any).formatSessionAsMarkdown(mockMessages);

        expect(result).toContain('**You**');
        expect(result).toContain('**Timmy**');
        expect(result).toContain('What threats exist?');
        expect(result).toContain('There are **three** main threats.');
        expect(result).toContain('Tell me more about the first one.');
        expect(result).toContain('The first threat involves injection attacks.');
      });

      it('should separate messages with blank lines', () => {
        const result = (component as any).formatSessionAsMarkdown(mockMessages);
        const blocks = result.split('\n\n').filter((b: string) => b.trim());

        expect(blocks.length).toBe(4);
      });
    });

    describe('formatMessageAsMarkdown', () => {
      it('should include the assistant message and preceding user message', () => {
        const result = (component as any).formatMessageAsMarkdown('msg-2', mockMessages);

        expect(result).toContain('**You**');
        expect(result).toContain('What threats exist?');
        expect(result).toContain('**Timmy**');
        expect(result).toContain('There are **three** main threats.');
      });

      it('should include only two messages', () => {
        const result = (component as any).formatMessageAsMarkdown('msg-4', mockMessages);
        const blocks = result.split('\n\n').filter((b: string) => b.trim());

        expect(blocks.length).toBe(2);
        expect(result).toContain('Tell me more about the first one.');
        expect(result).toContain('The first threat involves injection attacks.');
        expect(result).not.toContain('What threats exist?');
      });

      it('should handle first assistant message with no preceding user message', () => {
        const messagesWithoutUser: ChatMessage[] = [
          {
            id: 'msg-solo',
            sessionId: 'session-1',
            role: 'assistant',
            content: 'Hello, I am Timmy.',
            tokenCount: 10,
            sequence: 0,
            createdAt: '2026-04-05T14:34:00.000Z',
          },
        ];
        const result = (component as any).formatMessageAsMarkdown('msg-solo', messagesWithoutUser);

        expect(result).toContain('**Timmy**');
        expect(result).toContain('Hello, I am Timmy.');
        expect(result).not.toContain('**You**');
      });
    });

    describe('generateNoteTitle', () => {
      it('should truncate at word boundary and add ellipsis', () => {
        const longContent =
          'This is a very long message that goes well beyond fifty characters and should be truncated';
        const result = (component as any).generateNoteTitle(longContent);

        expect(result.length).toBeLessThanOrEqual(53);
        expect(result).toContain('\u2026');
        expect(result).not.toContain('truncated');
      });

      it('should return short content as-is', () => {
        const result = (component as any).generateNoteTitle('Short message');

        expect(result).toBe('Short message');
      });

      it('should fall back for code-only content', () => {
        const result = (component as any).generateNoteTitle(
          '```javascript\nconsole.log("hi")\n```',
        );

        expect(result).toMatch(/^Timmy response/);
      });
    });
  });
});
