import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { version } from '../../../../package.json';
import { gitCommit } from '../../../build-info.json';
import { ApiService } from './api.service';

// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: union type representing thumbs-up or thumbs-down sentiment on usability feedback (pure)
export type UsabilityFeedbackSentiment = 'up' | 'down';

/**
 * Surfaces are short snake_case identifiers tagging WHERE the feedback was
 * submitted (the UI location, not the artifact). The set is intentionally
 * open-ended; new surfaces can be added at the call site without server
 * coordination.
 */
// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: string alias identifying the UI surface where usability feedback was submitted (pure)
export type UsabilityFeedbackSurface = string;

export interface UsabilityFeedbackInput {
  sentiment: UsabilityFeedbackSentiment;
  surface: UsabilityFeedbackSurface;
  verbatim?: string;
  /**
   * Optional viewport screenshot as a data URL (typically `image/jpeg`).
   * The server contract for this field is tracked in ericfitz/tmi (see
   * the schema bug filed alongside this change). Until the server adopts
   * the field, the value is sent but silently dropped server-side.
   */
  screenshot?: string;
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
// SEM@aec9307215a45f0a44bafee0211ff7b427b4c267: submit usability feedback with client metadata to the API
export class UsabilityFeedbackService {
  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: inject API service dependency for feedback submission (pure)
  constructor(private readonly api: ApiService) {}

  // SEM@aec9307215a45f0a44bafee0211ff7b427b4c267: post usability feedback with sentiment, surface, and enriched client metadata to API
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

    if (input.screenshot) {
      body['screenshot'] = input.screenshot;
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

  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: return current browser viewport dimensions as a WxH string (pure)
  private _viewport(): string {
    if (typeof window === 'undefined') return '';
    const w = Math.max(0, Math.min(99999, Math.floor(window.innerWidth)));
    const h = Math.max(0, Math.min(99999, Math.floor(window.innerHeight)));
    return `${w}x${h}`;
  }
}
