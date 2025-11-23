// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

import { UserService, DeleteChallengeResponse } from './user.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../testing/mocks';

// Mock interfaces
interface MockApiService {
  delete: ReturnType<typeof vi.fn>;
  deleteWithParams: ReturnType<typeof vi.fn>;
}

describe('UserService', () => {
  let service: UserService;
  let apiService: MockApiService;
  let loggerService: MockLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();

    apiService = {
      delete: vi.fn(),
      deleteWithParams: vi.fn(),
    };

    loggerService = createTypedMockLoggerService();

    service = new UserService(
      apiService as unknown as ApiService,
      loggerService as unknown as LoggerService,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(loggerService.info).toHaveBeenCalledWith('User Service initialized');
  });

  describe('requestDeleteChallenge', () => {
    it('should call ApiService.delete with correct endpoint', () => {
      const mockResponse: DeleteChallengeResponse = {
        challenge_text: 'test-challenge-123',
        expires_at: '2025-10-24T12:00:00Z',
      };

      vi.mocked(apiService.delete).mockReturnValue(of(mockResponse));

      service.requestDeleteChallenge().subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(apiService.delete).toHaveBeenCalledWith('users/me');
        expect(loggerService.info).toHaveBeenCalledWith('Requesting account deletion challenge');
      });
    });

    it('should propagate errors from ApiService', () => {
      const mockError = new Error('API Error');
      vi.mocked(apiService.delete).mockReturnValue(throwError(() => mockError));

      service.requestDeleteChallenge().subscribe({
        error: error => {
          expect(error.message).toBe('API Error');
        },
      });
    });
  });

  describe('confirmDeleteAccount', () => {
    it('should call ApiService.deleteWithParams with correct endpoint and challenge', () => {
      const challenge = 'test-challenge-123';
      vi.mocked(apiService.deleteWithParams).mockReturnValue(of(undefined));

      service.confirmDeleteAccount(challenge).subscribe(() => {
        expect(apiService.deleteWithParams).toHaveBeenCalledWith('users/me', { challenge });
        expect(loggerService.info).toHaveBeenCalledWith(
          'Confirming account deletion with challenge',
        );
      });
    });

    it('should propagate errors from ApiService', () => {
      const challenge = 'test-challenge-123';
      const mockError = new Error('Challenge expired');
      vi.mocked(apiService.deleteWithParams).mockReturnValue(throwError(() => mockError));

      service.confirmDeleteAccount(challenge).subscribe({
        error: error => {
          expect(error.message).toBe('Challenge expired');
        },
      });
    });
  });
});
