// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { WebhookService } from './webhook.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  WebhookFilter,
  WebhookSubscription,
  WebhookSubscriptionInput,
} from '@app/types/webhook.types';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data
  const mockWebhook: WebhookSubscription = {
    id: 'webhook-123',
    owner_id: 'user-456',
    threat_model_id: 'tm-789',
    url: 'https://example.com/webhook',
    events: ['threat_model.created', 'threat_model.updated'],
    description: 'Test webhook',
    enabled: true,
    secret: 'secret-key',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockWebhookInput: WebhookSubscriptionInput = {
    threat_model_id: 'tm-789',
    url: 'https://example.com/webhook',
    events: ['threat_model.created'],
    description: 'New webhook',
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    // Create service with mocked dependencies
    service = new WebhookService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty webhooks observable', () => {
      service.webhooks$.subscribe(webhooks => {
        expect(webhooks).toEqual([]);
      });
    });
  });

  describe('list()', () => {
    it('should call API with no parameters when filter is not provided', () => {
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list().subscribe(webhooks => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', undefined);
        expect(webhooks).toEqual([mockWebhook]);
      });
    });

    it('should update webhooks$ observable with response data', () => {
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list().subscribe(() => {
        service.webhooks$.subscribe(webhooks => {
          expect(webhooks).toEqual([mockWebhook]);
        });
      });
    });

    it('should log debug message with webhook count', () => {
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Webhooks loaded', { count: 1 });
      });
    });

    it('should build query parameters from filter with threat_model_id', () => {
      const filter: WebhookFilter = {
        threat_model_id: 'tm-123',
      };

      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', {
          threat_model_id: 'tm-123',
        });
      });
    });

    it('should build query parameters from filter with limit and offset', () => {
      const filter: WebhookFilter = {
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', {
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should build query parameters from filter with all fields', () => {
      const filter: WebhookFilter = {
        threat_model_id: 'tm-123',
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', {
          threat_model_id: 'tm-123',
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should handle limit=0 in filter', () => {
      const filter: WebhookFilter = {
        limit: 0,
      };

      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', {
          limit: 0,
        });
      });
    });

    it('should return undefined params for empty filter object', () => {
      const filter: WebhookFilter = {};

      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list webhooks', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('get()', () => {
    const testId = 'webhook-123';

    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockWebhook));

      service.get(testId).subscribe(webhook => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions/webhook-123');
        expect(webhook).toEqual(mockWebhook);
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockWebhook));

      service.get(testId).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Webhook loaded', { id: testId });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.get(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get webhook', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    it('should call API with correct endpoint and data', () => {
      mockApiService.post.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.create(mockWebhookInput).subscribe(webhook => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          'webhooks/subscriptions',
          mockWebhookInput,
        );
        expect(webhook).toEqual(mockWebhook);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.create(mockWebhookInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Webhook created', {
          id: mockWebhook.id,
        });
      });
    });

    it('should refresh webhook list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.create(mockWebhookInput).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(mockWebhookInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create webhook', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if creation fails', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(mockWebhookInput).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('update()', () => {
    const testId = 'webhook-123';

    it('should call API with correct endpoint and data', () => {
      mockApiService.put.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.update(testId, mockWebhookInput).subscribe(webhook => {
        expect(mockApiService.put).toHaveBeenCalledWith(
          'webhooks/subscriptions/webhook-123',
          mockWebhookInput,
        );
        expect(webhook).toEqual(mockWebhook);
      });
    });

    it('should log info message on success', () => {
      mockApiService.put.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.update(testId, mockWebhookInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Webhook updated', {
          id: mockWebhook.id,
        });
      });
    });

    it('should refresh webhook list after update', () => {
      mockApiService.put.mockReturnValue(of(mockWebhook));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.update(testId, mockWebhookInput).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update(testId, mockWebhookInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update webhook', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if update fails', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update(testId, mockWebhookInput).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('delete()', () => {
    const testId = 'webhook-123';

    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('webhooks/subscriptions/webhook-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.delete(testId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Webhook deleted', { id: testId });
      });
    });

    it('should refresh webhook list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of([mockWebhook]));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('webhooks/subscriptions', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete webhook', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testId).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('test()', () => {
    const testId = 'webhook-123';

    it('should call API with correct endpoint', () => {
      mockApiService.post.mockReturnValue(of(undefined));

      service.test(testId).subscribe(() => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          'webhooks/subscriptions/webhook-123/test',
          {},
        );
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(undefined));

      service.test(testId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Webhook test triggered', {
          id: testId,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Test failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.test(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to test webhook', error);
          expect(err).toBe(error);
        },
      });
    });
  });
});
