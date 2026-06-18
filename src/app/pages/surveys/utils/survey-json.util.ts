import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyJsonSchema } from '@app/types/survey.types';
import { SurveyService } from '../services/survey.service';

/**
 * Dependencies required to load a survey JSON schema from the template service.
 */
export interface LoadSurveyJsonDeps {
  surveyService: SurveyService;
  destroyRef: DestroyRef;
  logger: LoggerService;
}

/**
 * Fetch a survey JSON schema from the template service, wiring the
 * `takeUntilDestroyed` lifecycle and shared error logging.
 *
 * Component-local state mutation (setting the schema, toggling loading flags,
 * recording errors, change detection) is delegated to the supplied callbacks so
 * each caller keeps ownership of its own fields.
 *
 * @param deps Service, destroy ref, and logger used to drive the request.
 * @param surveyId Identifier of the survey template to fetch.
 * @param onLoaded Invoked with the fetched schema on success.
 * @param onError Invoked on failure, after the error has been logged.
 */
// SEM@bda57c14c5f510b4c12a35bf845e1041df812b78: fetch a survey JSON schema and deliver it via callbacks with lifecycle teardown (reads DB)
export function loadSurveyJson(
  deps: LoadSurveyJsonDeps,
  surveyId: string,
  onLoaded: (surveyJson: SurveyJsonSchema) => void,
  onError: () => void,
): void {
  deps.surveyService
    .getSurveyJson(surveyId)
    .pipe(takeUntilDestroyed(deps.destroyRef))
    .subscribe({
      next: surveyJson => {
        onLoaded(surveyJson);
      },
      error: (error: unknown) => {
        deps.logger.error('Failed to load survey JSON', error);
        onError();
      },
    });
}
