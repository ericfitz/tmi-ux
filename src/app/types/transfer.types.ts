/**
 * Types for ownership transfer operations
 */

export interface TransferOwnershipRequest {
  target_user_id: string;
}

export interface TransferOwnershipResult {
  threat_models_transferred: {
    count: number;
    threat_model_ids: string[];
  };
  survey_responses_transferred: {
    count: number;
    survey_response_ids: string[];
  };
}
