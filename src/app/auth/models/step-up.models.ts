/**
 * Response from GET /oauth2/step_up with Accept: application/json.
 * Contract per tmi#455 (verified against published OpenAPI spec).
 */
export interface StepUpResponse {
  result: 'step_up_weak_complete' | 'step_up_redirect';
  /** Present when result is step_up_redirect: the upstream IdP authorize URL */
  redirect_url?: string;
  provider?: string;
  auth_time?: number;
  message?: string;
}

/** Outcome of StepUpService.beginStepUp() as seen by the interceptor */
// SEM@f0cbf56cdd766324ff656d4dcae789fc6db4c69d: enumerate possible outcomes of a step-up re-authentication attempt (pure)
export type StepUpOutcome = 'weak_complete' | 'redirecting' | 'cancelled';
