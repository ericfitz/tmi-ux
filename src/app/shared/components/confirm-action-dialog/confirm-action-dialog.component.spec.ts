// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { ConfirmActionDialogComponent } from './confirm-action-dialog.component';
import { ConfirmActionDialogData } from './confirm-action-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

describe('ConfirmActionDialogComponent', () => {
  let component: ConfirmActionDialogComponent;
  let dialogRef: MockDialogRef;

  const createComponent = (data: ConfirmActionDialogData): ConfirmActionDialogComponent => {
    dialogRef = {
      close: vi.fn(),
    };
    return new ConfirmActionDialogComponent(dialogRef as any, data);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Creation and Basic Properties', () => {
    it('should create', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
      expect(component).toBeTruthy();
    });

    it('should expose data', () => {
      const data: ConfirmActionDialogData = {
        title: 'test.title',
        message: 'test.message',
      };
      component = createComponent(data);
      expect(component.data).toBe(data);
    });
  });

  describe('Icon', () => {
    it('should default to warning icon', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
      expect(component.icon).toBe('warning');
    });

    it('should use custom icon when provided', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
        icon: 'info',
      });
      expect(component.icon).toBe('info');
    });
  });

  describe('Button Labels', () => {
    it('should default confirm label to common.confirm', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
      expect(component.confirmLabel).toBe('common.confirm');
    });

    it('should use custom confirm label when provided', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
        confirmLabel: 'common.delete',
      });
      expect(component.confirmLabel).toBe('common.delete');
    });

    it('should default cancel label to common.cancel', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
      expect(component.cancelLabel).toBe('common.cancel');
    });

    it('should use custom cancel label when provided', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
        cancelLabel: 'custom.cancel',
      });
      expect(component.cancelLabel).toBe('custom.cancel');
    });
  });

  describe('Destructive State', () => {
    it('should default to destructive', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
      expect(component.isDestructive).toBe(true);
    });

    it('should allow non-destructive confirm', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
        confirmIsDestructive: false,
      });
      expect(component.isDestructive).toBe(false);
    });

    it('should allow explicit destructive confirm', () => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
        confirmIsDestructive: true,
      });
      expect(component.isDestructive).toBe(true);
    });
  });

  describe('Dialog Actions', () => {
    beforeEach(() => {
      component = createComponent({
        title: 'test.title',
        message: 'test.message',
      });
    });

    it('should close dialog with confirmed: false when cancel is clicked', () => {
      component.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
    });

    it('should close dialog with confirmed: true when confirm is clicked', () => {
      component.onConfirm();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });
  });
});
