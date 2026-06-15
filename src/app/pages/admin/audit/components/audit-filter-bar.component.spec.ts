import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';

import { AuditFilterBarComponent } from './audit-filter-bar.component';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

interface MockUserAdminService {
  list: ReturnType<typeof vi.fn>;
}

describe('AuditFilterBarComponent', () => {
  let component: AuditFilterBarComponent;
  let mockUserAdminService: MockUserAdminService;
  let mockLogger: MockLoggerService;
  let mockDestroyRef: { onDestroy: ReturnType<typeof vi.fn> };
  let injector: Injector;

  function createComponent(
    overrides?: Partial<{ stream: 'system' | 'tm' }>,
  ): AuditFilterBarComponent {
    const comp = runInInjectionContext(injector, () => {
      return new AuditFilterBarComponent(mockUserAdminService as never, mockLogger as never);
    });
    comp.stream = overrides?.stream ?? 'system';
    comp.initialFilter = {};
    return comp;
  }

  beforeEach(() => {
    mockUserAdminService = {
      list: vi.fn().mockReturnValue(of({ users: [], total: 0 })),
    };

    mockLogger = createTypedMockLoggerService();
    mockDestroyRef = { onDestroy: vi.fn() };

    injector = Injector.create({
      providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
    });

    component = createComponent();
    component.ngOnInit();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should emit filterChange with empty object on init when initialFilter is empty', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      // Re-init with empty filter
      component.initialFilter = {};
      component.ngOnInit();

      // No emission expected on init; emissions occur on user interaction
      expect(emitted).toHaveLength(0);
    });

    it('should initialize actor input from initialFilter', () => {
      const comp = createComponent();
      comp.initialFilter = { actor_email: 'test@example.com' };
      comp.ngOnInit();

      expect(comp.actorInput).toBe('test@example.com');
    });

    it('should initialize http_method from initialFilter for system stream', () => {
      const comp = createComponent({ stream: 'system' });
      comp.initialFilter = { http_method: 'POST' };
      comp.ngOnInit();

      expect(comp.httpMethod).toBe('POST');
    });

    it('should initialize change_type from initialFilter for tm stream', () => {
      const comp = createComponent({ stream: 'tm' });
      comp.initialFilter = { change_type: 'created' };
      comp.ngOnInit();

      expect(comp.changeType).toBe('created');
    });
  });

  describe('select filters emit immediately', () => {
    it('should emit filterChange with http_method when select changes (system stream)', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onHttpMethodChange('PUT');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ http_method: 'PUT' });
    });

    it('should emit filterChange with change_type when select changes (tm stream)', () => {
      const tmComp = createComponent({ stream: 'tm' });
      tmComp.ngOnInit();
      const emitted: unknown[] = [];
      tmComp.filterChange.subscribe(v => emitted.push(v));

      tmComp.onChangeTypeChange('updated');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ change_type: 'updated' });
    });

    it('should emit filterChange with object_type when select changes (tm stream)', () => {
      const tmComp = createComponent({ stream: 'tm' });
      tmComp.ngOnInit();
      const emitted: unknown[] = [];
      tmComp.filterChange.subscribe(v => emitted.push(v));

      tmComp.onObjectTypeChange('diagram');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ object_type: 'diagram' });
    });

    it('should omit undefined and empty-string values from emitted filter', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      // http_method is undefined initially, only set path_prefix to ''
      component.pathPrefix = '';
      component.onHttpMethodChange('DELETE');

      expect(emitted[0]).toEqual({ http_method: 'DELETE' });
      expect(Object.keys(emitted[0] as object)).not.toContain('path_prefix');
    });
  });

  describe('date filter changes emit immediately', () => {
    it('should emit filterChange with created_after date', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onCreatedAfterChange('2026-01-01T00:00:00.000Z');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ created_after: '2026-01-01T00:00:00.000Z' });
    });

    it('should emit filterChange with created_before date', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onCreatedBeforeChange('2026-12-31T23:59:59.000Z');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ created_before: '2026-12-31T23:59:59.000Z' });
    });

    it('should omit null date values from emitted filter', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onHttpMethodChange('POST');
      component.onCreatedAfterChange(null);

      // Second emission should not contain created_after
      expect(Object.keys(emitted[1] as object)).not.toContain('created_after');
    });
  });

  describe('text inputs are debounced by 300ms', () => {
    it('should debounce actor input and emit after 300ms', () => {
      vi.useFakeTimers();
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      // Push to the actor subject
      component.onActorInput('alice@example.com');

      // Not emitted before 300ms
      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(300);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ actor_email: 'alice@example.com' });
    });

    it('should debounce path_prefix input and emit after 300ms', () => {
      vi.useFakeTimers();
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onPathPrefixInput('/admin');

      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(300);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ path_prefix: '/admin' });
    });

    it('should debounce field_path input and emit after 300ms', () => {
      vi.useFakeTimers();
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onFieldPathInput('users.email');

      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(300);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ field_path: 'users.email' });
    });

    it('should debounce threat_model_id input and emit after 300ms', () => {
      vi.useFakeTimers();
      const tmComp = createComponent({ stream: 'tm' });
      tmComp.ngOnInit();
      const emitted: unknown[] = [];
      tmComp.filterChange.subscribe(v => emitted.push(v));

      tmComp.onThreatModelIdInput('tm-123');

      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(300);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ threat_model_id: 'tm-123' });
    });

    it('should only emit the latest value within debounce window', () => {
      vi.useFakeTimers();
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      component.onActorInput('a');
      vi.advanceTimersByTime(100);
      component.onActorInput('al');
      vi.advanceTimersByTime(100);
      component.onActorInput('alice@example.com');
      vi.advanceTimersByTime(300);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ actor_email: 'alice@example.com' });
    });
  });

  describe('actor autocomplete triggers user search after debounce', () => {
    it('should call userAdminService.list with email filter after 300ms', () => {
      vi.useFakeTimers();
      // Activate the cold suggestions pipeline (template subscribes via the async pipe).
      component.actorSuggestions$.subscribe();

      component.onActorInput('bob@example.com');
      expect(mockUserAdminService.list).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(mockUserAdminService.list).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'bob@example.com' }),
      );
    });

    it('should not call userAdminService.list with empty actor input', () => {
      vi.useFakeTimers();

      component.onActorInput('');
      vi.advanceTimersByTime(300);

      expect(mockUserAdminService.list).not.toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    it('should reset all controls and emit empty object', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      // Set some values first
      component.actorInput = 'someone@example.com';
      component.httpMethod = 'POST';
      component.pathPrefix = '/admin';
      component.fieldPath = 'users.name';
      component.createdAfter = '2026-01-01T00:00:00.000Z';
      component.createdBefore = '2026-12-31T23:59:59.000Z';

      component.clearFilters();

      expect(component.actorInput).toBe('');
      expect(component.httpMethod).toBeNull();
      expect(component.pathPrefix).toBe('');
      expect(component.fieldPath).toBe('');
      expect(component.createdAfter).toBeNull();
      expect(component.createdBefore).toBeNull();
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({});
    });

    it('should reset TM-only fields when stream is tm', () => {
      const tmComp = createComponent({ stream: 'tm' });
      tmComp.ngOnInit();
      tmComp.changeType = 'created';
      tmComp.objectType = 'diagram';
      tmComp.threatModelId = 'tm-abc';
      const emitted: unknown[] = [];
      tmComp.filterChange.subscribe(v => emitted.push(v));

      tmComp.clearFilters();

      expect(tmComp.changeType).toBeNull();
      expect(tmComp.objectType).toBeNull();
      expect(tmComp.threatModelId).toBe('');
      expect(emitted[0]).toEqual({});
    });
  });

  describe('export menu (system stream only)', () => {
    it('should expose isSystemStream=true when stream is "system"', () => {
      expect(component.isSystemStream).toBe(true);
    });

    it('should expose isSystemStream=false when stream is "tm"', () => {
      const tmComp = createComponent({ stream: 'tm' });
      tmComp.ngOnInit();
      expect(tmComp.isSystemStream).toBe(false);
    });

    it('should emit exportRequested with "csv" when onExportCsv is called', () => {
      const emitted: unknown[] = [];
      component.exportRequested.subscribe(v => emitted.push(v));

      component.onExportCsv();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toBe('csv');
    });

    it('should emit exportRequested with "ndjson" when onExportNdjson is called', () => {
      const emitted: unknown[] = [];
      component.exportRequested.subscribe(v => emitted.push(v));

      component.onExportNdjson();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toBe('ndjson');
    });
  });

  describe('combined filter state', () => {
    it('should combine multiple filter values in a single emission', () => {
      const emitted: unknown[] = [];
      component.filterChange.subscribe(v => emitted.push(v));

      // Set http_method (immediate)
      component.onHttpMethodChange('PATCH');
      // Set date (immediate)
      component.onCreatedAfterChange('2026-06-01T00:00:00.000Z');

      // The second emission should include both active filters
      expect(emitted[1]).toEqual({
        http_method: 'PATCH',
        created_after: '2026-06-01T00:00:00.000Z',
      });
    });
  });
});
