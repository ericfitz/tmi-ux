// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

import {
  DIRECT_WRITE_CONTROLS,
  DirectWriteFieldsComponent,
  directWriteRequestFields,
} from './direct-write-fields.component';

describe('directWriteRequestFields', () => {
  const fb = new FormBuilder();

  it('returns nothing when direct writes are off, even if an addon is set', () => {
    const form = fb.group({ ...DIRECT_WRITE_CONTROLS });
    form.patchValue({ addonId: 'a1' });

    expect(directWriteRequestFields(form)).toEqual({});
  });

  it('returns direct_write alone when no addon is chosen', () => {
    const form = fb.group({ ...DIRECT_WRITE_CONTROLS });
    form.patchValue({ directWrite: true });

    expect(directWriteRequestFields(form)).toEqual({ direct_write: true });
  });

  it('returns both fields when an addon is chosen', () => {
    const form = fb.group({ ...DIRECT_WRITE_CONTROLS });
    form.patchValue({ directWrite: true, addonId: 'a1' });

    expect(directWriteRequestFields(form)).toEqual({ direct_write: true, addon_id: 'a1' });
  });
});

describe('DirectWriteFieldsComponent', () => {
  let mockAddonService: { list: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  function build(): DirectWriteFieldsComponent {
    const component = runInInjectionContext(
      envInjector,
      () => new DirectWriteFieldsComponent(mockAddonService as never, mockLogger as never),
    );
    component.form = new FormBuilder().group({ ...DIRECT_WRITE_CONTROLS });
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockAddonService = { list: vi.fn(() => of({ addons: [{ id: 'a1', name: 'Scanner' }] })) };
    mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('loads addons once when direct writes are first enabled', () => {
    const component = build();

    component.form.get('directWrite')?.setValue(true);
    component.form.get('directWrite')?.setValue(false);
    component.form.get('directWrite')?.setValue(true);

    expect(mockAddonService.list).toHaveBeenCalledTimes(1);
    expect(component.addons).toEqual([{ id: 'a1', name: 'Scanner' }]);
  });

  it('clears the addon when direct writes are disabled', () => {
    const component = build();
    component.form.patchValue({ directWrite: true, addonId: 'a1' });

    component.form.get('directWrite')?.setValue(false);

    expect(component.form.get('addonId')?.value).toBeNull();
  });

  it('logs and allows a retry when the addon list fails to load', () => {
    mockAddonService.list.mockReturnValueOnce(throwError(() => new Error('boom')));
    const component = build();

    component.form.get('directWrite')?.setValue(true);
    component.form.get('directWrite')?.setValue(false);
    component.form.get('directWrite')?.setValue(true);

    expect(mockLogger['error']).toHaveBeenCalledTimes(1);
    expect(mockAddonService.list).toHaveBeenCalledTimes(2);
    expect(component.addons).toEqual([{ id: 'a1', name: 'Scanner' }]);
  });
});
