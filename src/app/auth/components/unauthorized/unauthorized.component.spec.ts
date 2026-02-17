// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { Params } from '@angular/router';
import { UnauthorizedComponent } from './unauthorized.component';

describe('UnauthorizedComponent', () => {
  let component: UnauthorizedComponent;
  let queryParamsSubject: BehaviorSubject<Params>;
  let mockRoute: { queryParams: BehaviorSubject<Params> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryParamsSubject = new BehaviorSubject<Params>({});

    mockRoute = {
      queryParams: queryParamsSubject,
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    component = new UnauthorizedComponent(mockRoute as any, mockRouter as any, mockLogger as any);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to 403 status code', () => {
    expect(component.statusCode).toBe(403);
  });

  describe('ngOnInit', () => {
    it('should parse query params on init', () => {
      queryParamsSubject.next({
        requiredRole: 'admin',
        currentUrl: '/admin/users',
        reason: 'insufficient_permissions',
      });

      component.ngOnInit();

      expect(component.requiredRole).toBe('admin');
      expect(component.currentUrl).toBe('/admin/users');
      expect(component.reason).toBe('insufficient_permissions');
    });

    it('should set statusCode from explicit param', () => {
      queryParamsSubject.next({ statusCode: '404' });

      component.ngOnInit();

      expect(component.statusCode).toBe(404);
    });

    it('should set statusCode to 401 for unauthorized_api reason', () => {
      queryParamsSubject.next({ reason: 'unauthorized_api' });

      component.ngOnInit();

      expect(component.statusCode).toBe(401);
    });

    it('should prefer explicit statusCode over reason-derived code', () => {
      queryParamsSubject.next({
        reason: 'unauthorized_api',
        statusCode: '500',
      });

      component.ngOnInit();

      expect(component.statusCode).toBe(500);
    });

    it('should default to 403 when no statusCode or recognized reason', () => {
      queryParamsSubject.next({ reason: 'unknown_reason' });

      component.ngOnInit();

      expect(component.statusCode).toBe(403);
    });

    it('should set fields to null when params are missing', () => {
      queryParamsSubject.next({});

      component.ngOnInit();

      expect(component.requiredRole).toBeNull();
      expect(component.currentUrl).toBeNull();
      expect(component.reason).toBeNull();
    });

    it('should log unauthorized access attempt', () => {
      queryParamsSubject.next({
        requiredRole: 'admin',
        currentUrl: '/admin',
      });

      component.ngOnInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unauthorized access attempt'),
      );
    });
  });

  describe('goBack', () => {
    it('should navigate to home page', () => {
      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
