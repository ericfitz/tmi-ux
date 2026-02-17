// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { extractHttpErrorMessage, extractHttpErrorDetails } from './http-error.utils';

function makeErrorResponse(error: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error, status, statusText: 'Bad Request' });
}

describe('http-error.utils', () => {
  describe('extractHttpErrorMessage', () => {
    it('should return string error body directly', () => {
      const response = makeErrorResponse('Something went wrong');
      expect(extractHttpErrorMessage(response)).toBe('Something went wrong');
    });

    it('should extract "message" field from object body', () => {
      const response = makeErrorResponse({ message: 'Validation failed' });
      expect(extractHttpErrorMessage(response)).toBe('Validation failed');
    });

    it('should extract "error_description" when "message" is absent', () => {
      const response = makeErrorResponse({ error_description: 'Token expired' });
      expect(extractHttpErrorMessage(response)).toBe('Token expired');
    });

    it('should extract "detail" when higher-priority fields are absent', () => {
      const response = makeErrorResponse({ detail: 'Not found' });
      expect(extractHttpErrorMessage(response)).toBe('Not found');
    });

    it('should extract "error" field as last resort', () => {
      const response = makeErrorResponse({ error: 'unauthorized' });
      expect(extractHttpErrorMessage(response)).toBe('unauthorized');
    });

    it('should prefer "message" over other fields', () => {
      const response = makeErrorResponse({
        message: 'Primary message',
        error_description: 'Description',
        detail: 'Detail',
        error: 'Error',
      });
      expect(extractHttpErrorMessage(response)).toBe('Primary message');
    });

    it('should return null for null error body', () => {
      const response = makeErrorResponse(null);
      expect(extractHttpErrorMessage(response)).toBeNull();
    });

    it('should return null for undefined error body', () => {
      const response = makeErrorResponse(undefined);
      expect(extractHttpErrorMessage(response)).toBeNull();
    });

    it('should return null for empty object body', () => {
      const response = makeErrorResponse({});
      expect(extractHttpErrorMessage(response)).toBeNull();
    });

    it('should return null for numeric error body', () => {
      const response = makeErrorResponse(42);
      expect(extractHttpErrorMessage(response)).toBeNull();
    });

    it('should skip falsy field values', () => {
      const response = makeErrorResponse({
        message: '',
        error_description: '',
        detail: 'Actual detail',
      });
      expect(extractHttpErrorMessage(response)).toBe('Actual detail');
    });
  });

  describe('extractHttpErrorDetails', () => {
    it('should extract both error and errorDescription from object body', () => {
      const response = makeErrorResponse({
        error: 'validation_error',
        error_description: 'Name is required',
      });
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBe('validation_error');
      expect(result.errorDescription).toBe('Name is required');
    });

    it('should use "message" as fallback for error field', () => {
      const response = makeErrorResponse({
        message: 'Something failed',
        detail: 'Check input',
      });
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBe('Something failed');
      expect(result.errorDescription).toBe('Check input');
    });

    it('should prefer "error" over "message" for error field', () => {
      const response = makeErrorResponse({
        error: 'bad_request',
        message: 'Message text',
      });
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBe('bad_request');
    });

    it('should prefer "error_description" over "detail" for errorDescription field', () => {
      const response = makeErrorResponse({
        error_description: 'OAuth description',
        detail: 'Generic detail',
      });
      const result = extractHttpErrorDetails(response);
      expect(result.errorDescription).toBe('OAuth description');
    });

    it('should handle string error body', () => {
      const response = makeErrorResponse('Plain text error');
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBe('Plain text error');
      expect(result.errorDescription).toBeNull();
    });

    it('should return nulls for null error body', () => {
      const response = makeErrorResponse(null);
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBeNull();
      expect(result.errorDescription).toBeNull();
    });

    it('should return nulls for empty object body', () => {
      const response = makeErrorResponse({});
      const result = extractHttpErrorDetails(response);
      expect(result.error).toBeNull();
      expect(result.errorDescription).toBeNull();
    });
  });
});
