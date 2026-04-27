import { describe, it, expect } from 'vitest';
import {
  ContentTokenNotLinkedError,
  PickerAlreadyOpenError,
  PickerSessionExpiredError,
  type ContentProviderId,
} from './content-provider.types';

describe('content-provider.types', () => {
  it('exposes typed error classes with stable names', () => {
    expect(new ContentTokenNotLinkedError('google_workspace').name).toBe(
      'ContentTokenNotLinkedError',
    );
    expect(new PickerAlreadyOpenError().name).toBe('PickerAlreadyOpenError');
    expect(new PickerSessionExpiredError().name).toBe('PickerSessionExpiredError');
  });

  it('captures provider id on the not-linked error', () => {
    const err = new ContentTokenNotLinkedError('google_workspace');
    expect(err.providerId).toBe('google_workspace');
  });

  it('compiles with ContentProviderId union', () => {
    const id: ContentProviderId = 'google_workspace';
    expect(id).toBe('google_workspace');
  });
});
