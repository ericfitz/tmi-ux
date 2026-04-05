// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TooltipAriaLabelDirective } from './tooltip-aria-label.directive';
import type { ElementRef } from '@angular/core';
import type { MatTooltip } from '@angular/material/tooltip';

describe('TooltipAriaLabelDirective', () => {
  let directive: TooltipAriaLabelDirective;
  let mockElement: HTMLElement;
  let mockTooltip: { message: string };

  beforeEach(() => {
    mockElement = document.createElement('button');
    mockTooltip = { message: '' };
    directive = new TooltipAriaLabelDirective(
      mockTooltip as unknown as MatTooltip,
      { nativeElement: mockElement } as ElementRef<HTMLElement>,
    );
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('ngDoCheck', () => {
    it('should set aria-label when tooltip message is set', () => {
      mockTooltip.message = 'Save changes';
      directive.ngDoCheck();
      expect(mockElement.getAttribute('aria-label')).toBe('Save changes');
    });

    it('should update aria-label when tooltip message changes', () => {
      mockTooltip.message = 'Save';
      directive.ngDoCheck();
      expect(mockElement.getAttribute('aria-label')).toBe('Save');

      mockTooltip.message = 'Save changes';
      directive.ngDoCheck();
      expect(mockElement.getAttribute('aria-label')).toBe('Save changes');
    });

    it('should remove aria-label when tooltip message is cleared', () => {
      mockTooltip.message = 'Save';
      directive.ngDoCheck();
      expect(mockElement.getAttribute('aria-label')).toBe('Save');

      mockTooltip.message = '';
      directive.ngDoCheck();
      expect(mockElement.hasAttribute('aria-label')).toBe(false);
    });

    it('should not modify DOM when message has not changed', () => {
      mockTooltip.message = 'Save';
      directive.ngDoCheck();

      const spy = vi.spyOn(mockElement, 'setAttribute');
      directive.ngDoCheck();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
