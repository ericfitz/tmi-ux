// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { HelpDialogComponent } from './help-dialog.component';

describe('HelpDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let component: HelpDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new HelpDialogComponent(mockDialogRef as never);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
