// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import { describe, it, expect, beforeEach } from 'vitest';
import { PrincipalTypeIconComponent } from './principal-type-icon.component';

describe('PrincipalTypeIconComponent', () => {
  let component: PrincipalTypeIconComponent;

  beforeEach(() => {
    component = new PrincipalTypeIconComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getIconName', () => {
    it('should return "person" for user principal type', () => {
      component.principalType = 'user';
      expect(component.getIconName()).toBe('person');
    });

    it('should return "group" for group principal type', () => {
      component.principalType = 'group';
      expect(component.getIconName()).toBe('group');
    });

    it('should default to "person" when principalType is not set', () => {
      expect(component.getIconName()).toBe('person');
    });
  });

  // Template rendering tests removed - these should be done with Playwright integration tests
  // The component's business logic (getIconName) is fully tested above
});
