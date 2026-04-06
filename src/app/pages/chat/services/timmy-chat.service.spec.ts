import '@angular/compiler';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { TimmyChatService } from './timmy-chat.service';
import { ApiService } from '../../../core/services/api.service';
import { SseClientService } from '../../../core/services/sse-client.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { ChatSession, ChatMessage } from '../models/chat.model';
import { SseEvent } from '../../../core/interfaces/sse.interface';

describe('TimmyChatService', () => {
  let service: TimmyChatService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockSseClient: { post: ReturnType<typeof vi.fn> };
  let mockActivityTracker: { markActive: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    mockSseClient = {
      post: vi.fn(),
    };
    mockActivityTracker = {
      markActive: vi.fn(),
    };

    service = new TimmyChatService(
      mockApiService as unknown as ApiService,
      mockSseClient as unknown as SseClientService,
      mockActivityTracker as unknown as ActivityTrackerService,
    );
  });

  describe('listSessions', () => {
    it('should call ApiService.get with correct endpoint and unwrap response', () => {
      const sessions: ChatSession[] = [];
      mockApiService.get.mockReturnValue(of({ sessions, total: 0, limit: 20, offset: 0 }));

      service.listSessions('tm-123').subscribe(result => {
        expect(result).toStrictEqual(sessions);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions');
    });
  });

  describe('getSession', () => {
    it('should call ApiService.get with correct endpoint', () => {
      const session = { id: 's-1' } as ChatSession;
      mockApiService.get.mockReturnValue(of(session));

      service.getSession('tm-123', 's-1').subscribe(result => {
        expect(result).toBe(session);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions/s-1');
    });
  });

  describe('deleteSession', () => {
    it('should call ApiService.delete with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteSession('tm-123', 's-1').subscribe();

      expect(mockApiService.delete).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions/s-1');
    });
  });

  describe('getMessages', () => {
    it('should call ApiService.get with correct endpoint and params and unwrap response', () => {
      const messages: ChatMessage[] = [];
      mockApiService.get.mockReturnValue(of({ messages, total: 0, limit: 20, offset: 0 }));

      service.getMessages('tm-123', 's-1', 50, 0).subscribe(result => {
        expect(result).toStrictEqual(messages);
      });

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        { limit: 50, offset: 0 },
      );
    });

    it('should omit params when not provided', () => {
      mockApiService.get.mockReturnValue(of({ messages: [], total: 0, limit: 20, offset: 0 }));

      service.getMessages('tm-123', 's-1').subscribe();

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        undefined,
      );
    });
  });

  describe('createSession', () => {
    it('should call SseClientService.post with correct endpoint', () => {
      const events: SseEvent[] = [{ event: 'ready', data: '{}' }];
      mockSseClient.post.mockReturnValue(of(...events));

      service.createSession('tm-123').subscribe();

      expect(mockSseClient.post).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions');
    });

    it('should call markActive on the activity tracker', () => {
      mockSseClient.post.mockReturnValue(of({ event: 'ready', data: '{}' }));

      service.createSession('tm-123').subscribe();

      expect(mockActivityTracker.markActive).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should call SseClientService.post with correct endpoint and body', () => {
      const events: SseEvent[] = [{ event: 'message_end', data: '{}' }];
      mockSseClient.post.mockReturnValue(of(...events));

      service.sendMessage('tm-123', 's-1', 'Hello Timmy').subscribe();

      expect(mockSseClient.post).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        { content: 'Hello Timmy' },
      );
    });

    it('should call markActive on the activity tracker', () => {
      mockSseClient.post.mockReturnValue(of({ event: 'message_end', data: '{}' }));

      service.sendMessage('tm-123', 's-1', 'Hello').subscribe();

      expect(mockActivityTracker.markActive).toHaveBeenCalled();
    });
  });
});
