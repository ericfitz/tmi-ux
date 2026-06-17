// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { DestroyRef } from '@angular/core';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyJsonSchema } from '@app/types/survey.types';
import { SurveyService } from '../services/survey.service';
import { loadSurveyJson, LoadSurveyJsonDeps } from './survey-json.util';

describe('loadSurveyJson', () => {
  let destroyRef: DestroyRef;
  let mockSurveyService: { getSurveyJson: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
  let deps: LoadSurveyJsonDeps;

  const sampleSchema: SurveyJsonSchema = { title: 'Sample' } as SurveyJsonSchema;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSurveyService = { getSurveyJson: vi.fn() };
    mockLogger = { error: vi.fn() };

    // Minimal DestroyRef: takeUntilDestroyed only registers an onDestroy callback.
    destroyRef = { onDestroy: () => () => {} } as unknown as DestroyRef;

    deps = {
      surveyService: mockSurveyService as unknown as SurveyService,
      destroyRef,
      logger: mockLogger as unknown as LoggerService,
    };
  });

  it('fetches the schema for the given surveyId', () => {
    mockSurveyService.getSurveyJson.mockReturnValue(of(sampleSchema));

    loadSurveyJson(
      deps,
      'survey-123',
      () => {},
      () => {},
    );

    expect(mockSurveyService.getSurveyJson).toHaveBeenCalledWith('survey-123');
  });

  it('invokes onLoaded with the fetched schema on success', () => {
    mockSurveyService.getSurveyJson.mockReturnValue(of(sampleSchema));
    const onLoaded = vi.fn();
    const onError = vi.fn();

    loadSurveyJson(deps, 'survey-123', onLoaded, onError);

    expect(onLoaded).toHaveBeenCalledWith(sampleSchema);
    expect(onError).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('logs and invokes onError on failure', () => {
    const failure = new Error('boom');
    mockSurveyService.getSurveyJson.mockReturnValue(throwError(() => failure));
    const onLoaded = vi.fn();
    const onError = vi.fn();

    loadSurveyJson(deps, 'survey-123', onLoaded, onError);

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to load survey JSON', failure);
  });
});
