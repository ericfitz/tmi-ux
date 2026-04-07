// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError, EMPTY, Subject } from 'rxjs';

import { ChatPageComponent } from './chat-page.component';
import { ChatMessage } from '../../models/chat.model';
import { SseEvent } from '../../../../core/interfaces/sse.interface';
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

interface MockThreatModelService {
  createNote: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let mockRoute: MockActivatedRoute;
  let mockRouter: MockRouter;
  let mockTimmyChat: MockTimmyChatService;
  let mockLogger: MockLoggerService;
  let mockCdr: MockChangeDetectorRef;
  let mockTransloco: MockTranslocoService;
  let mockThreatModelService: MockThreatModelService;
  let mockSnackBar: MockSnackBar;

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

    mockThreatModelService = {
      createNote: vi.fn().mockReturnValue(of({ id: 'note-1', name: 'Test', content: '' })),
    };

    mockSnackBar = {
      open: vi.fn().mockReturnValue({ onAction: vi.fn().mockReturnValue(EMPTY) }),
    };

    const mockDatePipe = {
      transform: vi.fn().mockImplementation((date: string) => {
        return new Date(date).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        });
      }),
    };

    component = new ChatPageComponent(
      mockRoute as any,
      mockRouter as any,
      mockTimmyChat as any,
      mockLogger as any,
      mockCdr as any,
      mockTransloco as any,
      mockThreatModelService as any,
      mockSnackBar as any,
      mockDatePipe as any,
      null, // destroyRef
    );

    component.ngOnInit();
  });

  describe('session creation happy path', () => {
    function sessionCreatedEvent(sessionId: string, sourceCount: number): SseEvent {
      const snapshot = Array.from({ length: sourceCount }, (_, i) => ({
        entity_id: `entity-${i}`,
        entity_type: 'threat' as const,
      }));
      return {
        event: 'session_created',
        data: JSON.stringify({
          id: sessionId,
          source_snapshot: snapshot,
          status: 'active',
          threat_model_id: 'tm-123',
          user_id: 'user-1',
          created_at: '2026-04-07T00:00:00Z',
          modified_at: '2026-04-07T00:00:00Z',
        }),
      };
    }

    function readyEvent(): SseEvent {
      return {
        event: 'ready',
        data: JSON.stringify({ status: 'ready' }),
      };
    }

    it('should send message when ready event is received', () => {
      const sessionStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(EMPTY);

      component.onMessageSent('test message');

      sessionStream.next(sessionCreatedEvent('session-abc', 0));
      sessionStream.next(readyEvent());

      expect(mockTimmyChat.sendMessage).toHaveBeenCalledWith(
        'tm-123',
        'session-abc',
        'test message',
      );
      expect(component.activeSessionId).toBe('session-abc');
    });

    it('should send message even if stream never completes', () => {
      const sessionStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(EMPTY);

      component.onMessageSent('test message');

      sessionStream.next(sessionCreatedEvent('session-abc', 0));
      sessionStream.next(readyEvent());
      // Intentionally NOT calling sessionStream.complete()

      expect(mockTimmyChat.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should not double-send when ready fires and then stream completes', () => {
      const sessionStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(EMPTY);

      component.onMessageSent('test message');

      sessionStream.next(sessionCreatedEvent('session-abc', 0));
      sessionStream.next(readyEvent());
      sessionStream.complete();

      expect(mockTimmyChat.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should fall back to sending on complete if no ready event received', () => {
      const sessionStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(EMPTY);

      component.onMessageSent('test message');

      sessionStream.next(sessionCreatedEvent('session-abc', 0));
      // No ready event, just close the stream
      sessionStream.complete();

      expect(mockTimmyChat.sendMessage).toHaveBeenCalledWith(
        'tm-123',
        'session-abc',
        'test message',
      );
    });

    it('should set activeSessionId and load sessions on ready', () => {
      const sessionStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(EMPTY);

      component.onMessageSent('test message');

      sessionStream.next(sessionCreatedEvent('session-abc', 2));
      sessionStream.next(readyEvent());

      expect(component.activeSessionId).toBe('session-abc');
      expect(mockTimmyChat.listSessions).toHaveBeenCalledWith('tm-123');
    });
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
        session_id: 'session-1',
        role: 'user',
        content: 'What threats exist?',
        sequence: 0,
        created_at: '2026-04-05T14:34:00.000Z',
      },
      {
        id: 'msg-2',
        session_id: 'session-1',
        role: 'assistant',
        content: 'There are **three** main threats.',
        token_count: 42,
        sequence: 1,
        created_at: '2026-04-05T14:34:05.000Z',
      },
      {
        id: 'msg-3',
        session_id: 'session-1',
        role: 'user',
        content: 'Tell me more about the first one.',
        sequence: 2,
        created_at: '2026-04-05T14:35:00.000Z',
      },
      {
        id: 'msg-4',
        session_id: 'session-1',
        role: 'assistant',
        content: 'The first threat involves injection attacks.',
        token_count: 30,
        sequence: 3,
        created_at: '2026-04-05T14:35:10.000Z',
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
            session_id: 'session-1',
            role: 'assistant',
            content: 'Hello, I am Timmy.',
            token_count: 10,
            sequence: 0,
            created_at: '2026-04-05T14:34:00.000Z',
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

  describe('onSessionSavedAsNote', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'What threats?',
        sequence: 0,
        created_at: '2026-04-05T14:34:00.000Z',
      },
      {
        id: 'msg-2',
        session_id: 'session-1',
        role: 'assistant',
        content: 'Three threats found.',
        token_count: 20,
        sequence: 1,
        created_at: '2026-04-05T14:34:05.000Z',
      },
    ];

    beforeEach(() => {
      component.messages = mockMessages;
      component.sessions = [
        {
          id: 'session-1',
          threat_model_id: 'tm-123',
          title: 'What threats?',
          source_snapshot: [],
          status: 'active' as const,
          created_at: '2026-04-05T14:34:00.000Z',
          modified_at: '2026-04-05T14:34:05.000Z',
        },
      ];
      component.activeSessionId = 'session-1';
    });

    it('should call createNote with session title and formatted content', () => {
      component.onSessionSavedAsNote('session-1');

      expect(mockThreatModelService.createNote).toHaveBeenCalledWith(
        'tm-123',
        expect.objectContaining({
          name: 'What threats?',
          include_in_report: false,
          timmy_enabled: false,
        }),
      );
    });

    it('should show success snackbar on save', () => {
      component.onSessionSavedAsNote('session-1');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'chat.savedAsNote',
        'chat.savedAsNoteView',
        expect.objectContaining({ duration: 5000 }),
      );
    });

    it('should show error snackbar on failure', () => {
      mockThreatModelService.createNote.mockReturnValue(throwError(() => new Error('API error')));

      component.onSessionSavedAsNote('session-1');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'chat.saveAsNoteError',
        '',
        expect.any(Object),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should use fallback name when session title is empty', () => {
      component.sessions = [
        {
          id: 'session-1',
          threat_model_id: 'tm-123',
          title: '',
          source_snapshot: [],
          status: 'active' as const,
          created_at: '2026-04-05T14:34:00.000Z',
          modified_at: '2026-04-05T14:34:05.000Z',
        },
      ];

      component.onSessionSavedAsNote('session-1');

      expect(mockThreatModelService.createNote).toHaveBeenCalledWith(
        'tm-123',
        expect.objectContaining({
          name: expect.stringContaining('Timmy session'),
          include_in_report: false,
          timmy_enabled: false,
        }),
      );
    });
  });

  describe('message streaming reconciliation', () => {
    function setupSessionAndSendMessage(): Subject<SseEvent> {
      const sessionStream = new Subject<SseEvent>();
      const messageStream = new Subject<SseEvent>();
      mockTimmyChat.createSession.mockReturnValue(sessionStream.asObservable());
      mockTimmyChat.sendMessage.mockReturnValue(messageStream.asObservable());

      component.onMessageSent('test question');

      // Complete session creation
      sessionStream.next({
        event: 'session_created',
        data: JSON.stringify({
          id: 'session-1',
          source_snapshot: [],
          status: 'active',
          threat_model_id: 'tm-123',
          user_id: 'user-1',
          created_at: '2026-04-07T00:00:00Z',
          modified_at: '2026-04-07T00:00:00Z',
        }),
      });
      sessionStream.next({ event: 'ready', data: JSON.stringify({ status: 'ready' }) });

      return messageStream;
    }

    it('should use server content from message_end as authoritative', () => {
      const messageStream = setupSessionAndSendMessage();

      messageStream.next({
        event: 'message_start',
        data: JSON.stringify({ status: 'processing' }),
      });
      messageStream.next({
        event: 'token',
        data: JSON.stringify({ content: 'partial' }),
      });
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'msg-server-1',
          session_id: 'session-1',
          role: 'assistant',
          content: 'full server content',
          token_count: 42,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      const assistantMsg = component.messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.content).toBe('full server content');
      expect(assistantMsg!.id).toBe('msg-server-1');
      expect(assistantMsg!.token_count).toBe(42);
    });

    it('should log warning when assembled content differs from server content', () => {
      const messageStream = setupSessionAndSendMessage();

      messageStream.next({
        event: 'message_start',
        data: JSON.stringify({ status: 'processing' }),
      });
      messageStream.next({
        event: 'token',
        data: JSON.stringify({ content: 'partial' }),
      });
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'msg-server-1',
          session_id: 'session-1',
          role: 'assistant',
          content: 'full server content that is longer',
          token_count: 42,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[chat] Token-assembled content differs from server content',
        expect.objectContaining({
          assembledLength: 7,
          serverLength: 34,
        }),
      );
    });

    it('should not log warning when assembled content matches server content', () => {
      const messageStream = setupSessionAndSendMessage();

      messageStream.next({
        event: 'message_start',
        data: JSON.stringify({ status: 'processing' }),
      });
      messageStream.next({
        event: 'token',
        data: JSON.stringify({ content: 'exact match' }),
      });
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'msg-server-1',
          session_id: 'session-1',
          role: 'assistant',
          content: 'exact match',
          token_count: 5,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle message_start with optional message_id', () => {
      const messageStream = setupSessionAndSendMessage();

      // Server sends message_id in message_start
      messageStream.next({
        event: 'message_start',
        data: JSON.stringify({ status: 'processing', message_id: 'pre-assigned-id' }),
      });
      messageStream.next({
        event: 'token',
        data: JSON.stringify({ content: 'hello' }),
      });
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'pre-assigned-id',
          session_id: 'session-1',
          role: 'assistant',
          content: 'hello',
          token_count: 1,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      const assistantMsg = component.messages.find(m => m.role === 'assistant');
      expect(assistantMsg!.id).toBe('pre-assigned-id');
    });

    it('should clear streamingMessageId after message_end', () => {
      const messageStream = setupSessionAndSendMessage();

      messageStream.next({
        event: 'message_start',
        data: JSON.stringify({ status: 'processing' }),
      });
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'msg-1',
          session_id: 'session-1',
          role: 'assistant',
          content: '',
          token_count: 0,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      expect(component.streamingMessageId).toBeNull();
    });

    it('should log warning when message_end arrives with no matching message', () => {
      const messageStream = setupSessionAndSendMessage();

      // Send message_end WITHOUT a preceding message_start so no assistant
      // message exists in the array.
      messageStream.next({
        event: 'message_end',
        data: JSON.stringify({
          id: 'orphan-msg',
          session_id: 'session-1',
          role: 'assistant',
          content: 'orphan content',
          token_count: 5,
          sequence: 2,
          created_at: '2026-04-07T00:00:01Z',
        }),
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[chat] message_end received but no matching message found',
        expect.objectContaining({ serverId: 'orphan-msg' }),
      );
    });
  });

  describe('onMessageSavedAsNote', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'What threats?',
        sequence: 0,
        created_at: '2026-04-05T14:34:00.000Z',
      },
      {
        id: 'msg-2',
        session_id: 'session-1',
        role: 'assistant',
        content: 'Three threats found.',
        token_count: 20,
        sequence: 1,
        created_at: '2026-04-05T14:34:05.000Z',
      },
    ];

    beforeEach(() => {
      component.messages = mockMessages;
      component.activeSessionId = 'session-1';
    });

    it('should call createNote with generated title and formatted content', () => {
      component.onMessageSavedAsNote('msg-2');

      expect(mockThreatModelService.createNote).toHaveBeenCalledWith(
        'tm-123',
        expect.objectContaining({
          name: 'Three threats found.',
          include_in_report: false,
          timmy_enabled: false,
        }),
      );
    });

    it('should include preceding user message in content', () => {
      component.onMessageSavedAsNote('msg-2');

      const call = mockThreatModelService.createNote.mock.calls[0];
      const noteContent = call[1].content as string;
      expect(noteContent).toContain('What threats?');
      expect(noteContent).toContain('Three threats found.');
    });

    it('should show success snackbar on save', () => {
      component.onMessageSavedAsNote('msg-2');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'chat.savedAsNote',
        'chat.savedAsNoteView',
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});
