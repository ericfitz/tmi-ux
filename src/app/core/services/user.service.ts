/**
 * User Service
 *
 * This service handles user-related API operations including account management.
 *
 * Key functionality:
 * - Request account deletion challenge
 * - Confirm account deletion with challenge
 * - Provides proper error handling and logging
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { UserProfile } from '@app/auth/models/auth.models';
import { TransferOwnershipResult } from '@app/types/transfer.types';

/**
 * Response from requesting account deletion challenge
 */
export interface DeleteChallengeResponse {
  challenge_text: string;
  expires_at: string;
}

/**
 * Service for user-related operations
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {
    this.logger.info('User Service initialized');
  }

  /**
   * Get current user profile with admin status
   * @returns Observable with user profile including is_admin flag
   */
  getCurrentUser(): Observable<UserProfile> {
    this.logger.info('Fetching current user profile');
    return this.apiService.get<UserProfile>('users/me');
  }

  /**
   * Request a challenge for account deletion (Step 1 of 2-step process)
   * @returns Observable with challenge text and expiration
   */
  requestDeleteChallenge(): Observable<DeleteChallengeResponse> {
    this.logger.info('Requesting account deletion challenge');
    return this.apiService.delete<DeleteChallengeResponse>('users/me');
  }

  /**
   * Confirm account deletion with challenge (Step 2 of 2-step process)
   * @param challenge The challenge text from Step 1
   * @returns Observable that completes on successful deletion (204)
   */
  confirmDeleteAccount(challenge: string): Observable<void> {
    this.logger.info('Confirming account deletion with challenge');
    return this.apiService.deleteWithParams<void>('users/me', { challenge });
  }

  /**
   * Transfer ownership of all owned resources to another user
   */
  transferOwnership(targetUserId: string): Observable<TransferOwnershipResult> {
    return this.apiService
      .post<TransferOwnershipResult>('me/transfer', { target_user_id: targetUserId })
      .pipe(
        tap(result => {
          this.logger.info('Ownership transferred', {
            threatModels: result.threat_models_transferred.count,
            surveyResponses: result.survey_responses_transferred.count,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to transfer ownership', error);
          throw error;
        }),
      );
  }
}
