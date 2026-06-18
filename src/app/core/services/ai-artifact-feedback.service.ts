import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { version } from '../../../../package.json';
import { ApiService } from './api.service';

// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: classify user feedback direction as thumbs-up or thumbs-down (pure)
export type ArtifactFeedbackSentiment = 'up' | 'down';

// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: enumerate AI artifact types that can receive user feedback (pure)
export type ArtifactFeedbackTargetType = 'note' | 'diagram' | 'threat' | 'threat_classification';

/**
 * False-positive taxonomy (top-level). Allowed only when sentiment='down' and
 * target_type='threat'. Subreasons depend on the chosen reason.
 */
// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: enumerate top-level reasons a threat detection is a false positive (pure)
export type FalsePositiveReason =
  | 'detection_misfired'
  | 'real_but_mitigated'
  | 'real_but_not_exploitable'
  | 'out_of_scope'
  | 'intended_behavior'
  | 'duplicate'
  | 'already_remediated'
  | 'detection_rule_flawed';

// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: enumerate secondary qualifiers for a false-positive threat reason (pure)
export type FalsePositiveSubreason =
  | 'code_does_not_exist'
  | 'trigger_conditions_not_met'
  | 'component_outside_threat_model'
  | 'sanctioned_by_design'
  | 'not_a_real_risk'
  | 'needs_tuning';

/**
 * Per-reason subreason policy. `null` means no subreason; an empty array means
 * "verbatim required, no subreason"; otherwise the array enumerates valid
 * subreason values.
 */
export const FALSE_POSITIVE_TAXONOMY: Record<
  FalsePositiveReason,
  { subreasons: FalsePositiveSubreason[]; verbatimRequired: boolean }
> = {
  detection_misfired: {
    subreasons: ['code_does_not_exist', 'trigger_conditions_not_met'],
    verbatimRequired: false,
  },
  real_but_mitigated: { subreasons: [], verbatimRequired: true },
  real_but_not_exploitable: { subreasons: [], verbatimRequired: true },
  out_of_scope: { subreasons: ['component_outside_threat_model'], verbatimRequired: true },
  intended_behavior: { subreasons: ['sanctioned_by_design'], verbatimRequired: true },
  duplicate: { subreasons: [], verbatimRequired: true },
  already_remediated: { subreasons: [], verbatimRequired: true },
  detection_rule_flawed: {
    subreasons: ['not_a_real_risk', 'needs_tuning'],
    verbatimRequired: false,
  },
};

export interface ArtifactFeedbackInput {
  sentiment: ArtifactFeedbackSentiment;
  targetType: ArtifactFeedbackTargetType;
  targetId: string;
  /** Required when targetType === 'threat_classification' (e.g. 'cwe'). */
  targetField?: string;
  verbatim?: string;
  /** Allowed only when sentiment='down' and targetType='threat'. */
  falsePositiveReason?: FalsePositiveReason;
  falsePositiveSubreason?: FalsePositiveSubreason;
}

export interface ArtifactFeedbackResponse {
  id: string;
  threat_model_id: string;
  sentiment: ArtifactFeedbackSentiment;
  target_type: ArtifactFeedbackTargetType;
  target_id: string;
  target_field?: string;
  verbatim?: string;
  false_positive_reason?: FalsePositiveReason;
  false_positive_subreason?: FalsePositiveSubreason;
  created_by: string;
  created_at: string;
}

const CLIENT_ID = 'tmi-ux';

/**
 * Captures user feedback on AI-generated artifacts (notes, diagrams, threats)
 * and on individual threat-classification fields. Posts to
 * /threat_models/{tmId}/feedback. The server is the source of truth for the
 * false-positive taxonomy; the client mirrors it for input validation only.
 */
@Injectable({ providedIn: 'root' })
// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: submit user feedback on AI-generated threat model artifacts to the API
export class AiArtifactFeedbackService {
  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: inject API service dependency
  constructor(private readonly api: ApiService) {}

  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: post user sentiment and optional false-positive details on a threat model artifact
  submit(
    threatModelId: string,
    input: ArtifactFeedbackInput,
  ): Observable<ArtifactFeedbackResponse> {
    const body: Record<string, unknown> = {
      sentiment: input.sentiment,
      target_type: input.targetType,
      target_id: input.targetId,
      client_id: CLIENT_ID,
      client_version: version,
    };

    if (input.targetField) {
      body['target_field'] = input.targetField;
    }
    const trimmed = input.verbatim?.trim();
    if (trimmed) {
      body['verbatim'] = trimmed;
    }
    if (input.sentiment === 'down' && input.targetType === 'threat') {
      if (input.falsePositiveReason) {
        body['false_positive_reason'] = input.falsePositiveReason;
      }
      if (input.falsePositiveSubreason) {
        body['false_positive_subreason'] = input.falsePositiveSubreason;
      }
    }

    return this.api.post<ArtifactFeedbackResponse>(
      `/threat_models/${threatModelId}/feedback`,
      body,
    );
  }
}
