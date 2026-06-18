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
// SEM@6b35da8ffade83ef6579f36d41c97823a2565785: manage user account operations including deletion and ownership transfer
export class UserService {
  // SEM@fbed61cffb1a9a41593309e41f1b6f8a61a5f4d2: inject dependencies and log service initialization (mutates shared state)
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
  // SEM@44287f3f5c43dfa5aaf5fa36290065fd39725079: fetch the authenticated user profile including admin status (reads DB)
  getCurrentUser(): Observable<UserProfile> {
    this.logger.info('Fetching current user profile');
    return this.apiService.get<UserProfile>('users/me');
  }

  /**
   * Request a challenge for account deletion (Step 1 of 2-step process)
   * @returns Observable with challenge text and expiration
   */
  // SEM@fbed61cffb1a9a41593309e41f1b6f8a61a5f4d2: request an account-deletion challenge token from the API (reads DB)
  requestDeleteChallenge(): Observable<DeleteChallengeResponse> {
    this.logger.info('Requesting account deletion challenge');
    return this.apiService.delete<DeleteChallengeResponse>('users/me');
  }

  /**
   * Confirm account deletion with challenge (Step 2 of 2-step process)
   * @param challenge The challenge text from Step 1
   * @returns Observable that completes on successful deletion (204)
   */
  // SEM@fbed61cffb1a9a41593309e41f1b6f8a61a5f4d2: delete the authenticated user account by confirming a challenge token (reads DB)
  confirmDeleteAccount(challenge: string): Observable<void> {
    this.logger.info('Confirming account deletion with challenge');
    return this.apiService.deleteWithParams<void>('users/me', { challenge });
  }

  /**
   * Transfer ownership of all owned resources to another user
   */
  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: transfer all owned resources to a target user via the API (reads DB)
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
