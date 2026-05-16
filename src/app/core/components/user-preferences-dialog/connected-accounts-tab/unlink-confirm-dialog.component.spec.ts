// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { UnlinkConfirmDialogComponent } from './unlink-confirm-dialog.component';

describe('UnlinkConfirmDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let component: UnlinkConfirmDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new UnlinkConfirmDialogComponent(mockDialogRef as never, {
      sourceName: 'Google Drive',
    });
  });

  it('should create and expose the source name', () => {
    expect(component).toBeTruthy();
    expect(component.data.sourceName).toBe('Google Drive');
  });

  it('exposes the dialog ref so the template can confirm/cancel', () => {
    // The template binds (click)="ref.close(true|false)" directly.
    component.ref.close(true);
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);

    component.ref.close(false);
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
