import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { version } from '../../../../package.json';
import { gitCommit } from '../../../build-info.json';
import { ApiService } from './api.service';

export type UsabilityFeedbackSentiment = 'up' | 'down';

/**
 * Surfaces are short snake_case identifiers tagging WHERE the feedback was
 * submitted (the UI location, not the artifact). The set is intentionally
 * open-ended; new surfaces can be added at the call site without server
 * coordination.
 */
export type UsabilityFeedbackSurface = string;

export interface UsabilityFeedbackInput {
  sentiment: UsabilityFeedbackSentiment;
  surface: UsabilityFeedbackSurface;
  verbatim?: string;
}

export interface UsabilityFeedbackResponse {
  id: string;
  sentiment: UsabilityFeedbackSentiment;
  surface: string;
  verbatim?: string;
  created_by: string;
  created_at: string;
}

const CLIENT_ID = 'tmi-ux';

interface NavigatorWithUAData {
  userAgentData?: { toJSON?: () => unknown };
}

/**
 * Captures general usability feedback (thumbs up/down + optional verbatim)
 * and POSTs it to /usability_feedback. The service automatically populates
 * client-side metadata (version, build hash, viewport, UA) so callers only
 * need to supply sentiment, surface, and the optional comment.
 */
@Injectable({ providedIn: 'root' })
export class UsabilityFeedbackService {
  constructor(private readonly api: ApiService) {}

  submit(input: UsabilityFeedbackInput): Observable<UsabilityFeedbackResponse> {
    const body: Record<string, unknown> = {
      sentiment: input.sentiment,
      surface: input.surface,
      client_id: CLIENT_ID,
      client_version: version,
      client_build: gitCommit,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport: this._viewport(),
    };

    const trimmed = input.verbatim?.trim();
    if (trimmed) {
      body['verbatim'] = trimmed;
    }

    const uaData = (navigator as unknown as NavigatorWithUAData).userAgentData;
    if (uaData?.toJSON) {
      try {
        body['user_agent_data'] = uaData.toJSON();
      } catch {
        // Optional payload — silently drop if serialization fails.
      }
    }

    return this.api.post<UsabilityFeedbackResponse>('/usability_feedback', body);
  }

  private _viewport(): string {
    if (typeof window === 'undefined') return '';
    const w = Math.max(0, Math.min(99999, Math.floor(window.innerWidth)));
    const h = Math.max(0, Math.min(99999, Math.floor(window.innerHeight)));
    return `${w}x${h}`;
  }
}
