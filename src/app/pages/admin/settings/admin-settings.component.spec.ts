import '@angular/compiler';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { of, EMPTY, Subject } from 'rxjs';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { AdminSettingsComponent } from './admin-settings.component';
import { SystemSetting } from '@app/types/settings.types';

function makeSetting(key: string, overrides: Partial<SystemSetting> = {}): SystemSetting {
  return { key, value: 'v', type: 'string', source: 'database', ...overrides };
}

describe('AdminSettingsComponent', () => {
  let component: AdminSettingsComponent;

  beforeEach(() => {
    const mockSettingsService = { listSettings: vi.fn().mockReturnValue(of([])) };
    const mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
    const mockRoute = { queryParams: EMPTY };
    const mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const injector = Injector.create({
      providers: [{ provide: DestroyRef, useValue: { onDestroy: vi.fn() } }],
    });

    component = runInInjectionContext(
      injector,
      () =>
        new AdminSettingsComponent(
          mockSettingsService as never,
          mockRouter as never,
          mockRoute as never,
          { open: vi.fn() } as never,
          mockLogger as never,
          {} as never,
          { translate: vi.fn() } as never,
          {} as never,
        ),
    );
  });

  // The table and paginator sit behind @if blocks, so neither exists at init time and both
  // are recreated on every reload. MatTableDataSource subscribes to sortChange/page and
  // initialized, so the stubs need real observables.
  it('binds sort when the table is created after init and keeps it on teardown', () => {
    expect(component.dataSource.sort).toBeFalsy();
    const sort = {
      sortChange: new Subject<void>(),
      initialized: new Subject<void>(),
      sortables: new Map(),
    } as unknown as MatSort;

    component.sort = sort;
    expect(component.dataSource.sort).toBe(sort);

    component.sort = undefined;
    expect(component.dataSource.sort).toBe(sort);
  });

  it('binds the paginator so the data source pages client-side', () => {
    expect(component.dataSource.paginator).toBeFalsy();
    const paginator = {
      page: new Subject<void>(),
      initialized: new Subject<void>(),
      pageIndex: 0,
      pageSize: 2,
      length: 0,
    } as unknown as MatPaginator;

    component.paginator = paginator;
    expect(component.dataSource.paginator).toBe(paginator);

    component.paginator = undefined;
    expect(component.dataSource.paginator).toBe(paginator);
  });

  it('sorts case-insensitively on key and value', () => {
    const accessor = component.dataSource.sortingDataAccessor;
    const item = makeSetting('Alpha', { value: 'Bravo', source: 'database' }) as never;
    expect(accessor(item, 'key')).toBe('alpha');
    expect(accessor(item, 'value')).toBe('bravo');
    expect(accessor(item, 'source')).toBe('database');
  });
});
