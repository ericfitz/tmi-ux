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
import type { TranslocoService } from '@jsverse/transloco';

import { InvokeAddonDialogComponent, InvokeAddonDialogData } from './invoke-addon-dialog.component';
import type { Addon, AddonParameter } from '@app/types/addon.types';

describe('InvokeAddonDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockAddonService: { get: ReturnType<typeof vi.fn>; invoke: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let mockUserPreferences: { preferences$: ReturnType<typeof of> };
  let envInjector: EnvironmentInjector;

  function makeAddon(parameters: AddonParameter[] = []): Addon {
    return {
      id: 'addon-1',
      created_at: '2024-01-01',
      name: 'Test Addon',
      webhook_id: 'wh-1',
      icon: 'material-symbols:bolt',
      parameters,
    };
  }

  function makeData(overrides: Partial<InvokeAddonDialogData> = {}): InvokeAddonDialogData {
    return {
      addon: makeAddon(),
      threatModelId: 'tm-1',
      threatModelName: 'My TM',
      objectType: 'threat_model',
      isBulk: true,
      ...overrides,
    };
  }

  /** Construct the component inside an injection context (it uses inject(DestroyRef)). */
  function build(data: InvokeAddonDialogData): InvokeAddonDialogComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new InvokeAddonDialogComponent(
          data,
          mockDialogRef as never,
          mockAddonService as never,
          new FormBuilder(),
          mockLogger as never,
          mockTransloco,
          mockUserPreferences as never,
        ),
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAddonService = {
      get: vi.fn(() => of(makeAddon())),
      invoke: vi.fn(() => of({ invocation_id: 'inv-1' })),
    };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
    } as unknown as TranslocoService;
    mockUserPreferences = { preferences$: of({ showDeveloperTools: false }) };

    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('initialization', () => {
    it('should create', () => {
      expect(build(makeData())).toBeTruthy();
    });

    it('fetches addon details and builds the form on init', () => {
      const params: AddonParameter[] = [
        { name: 'depth', type: 'number', required: true, default_value: '3' },
      ];
      mockAddonService.get.mockReturnValue(of(makeAddon(params)));
      const component = build(makeData());

      component.ngOnInit();

      expect(mockAddonService.get).toHaveBeenCalledWith('addon-1');
      expect(component.loading).toBe(false);
      expect(component.parameters).toEqual(params);
      expect(component.form.get('depth')).toBeTruthy();
    });

    it('falls back to the addon data already in hand when the fetch fails', () => {
      const fallbackParams: AddonParameter[] = [{ name: 'flag', type: 'boolean' }];
      mockAddonService.get.mockReturnValue(throwError(() => new Error('network')));
      const component = build(makeData({ addon: makeAddon(fallbackParams) }));

      component.ngOnInit();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.parameters).toEqual(fallbackParams);
      expect(component.loading).toBe(false);
    });

    it('disables optional parameter controls by default', () => {
      const params: AddonParameter[] = [
        { name: 'required', type: 'string', required: true },
        { name: 'optional', type: 'string', required: false },
      ];
      mockAddonService.get.mockReturnValue(of(makeAddon(params)));
      const component = build(makeData());
      component.ngOnInit();

      expect(component.form.get('required')?.enabled).toBe(true);
      expect(component.form.get('optional')?.disabled).toBe(true);
      expect(component.includedParams['required']).toBe(true);
      expect(component.includedParams['optional']).toBe(false);
    });
  });

  describe('getAddonIcon', () => {
    it('strips the material-symbols: prefix', () => {
      const component = build(makeData());

      expect(component.getAddonIcon()).toBe('bolt');
    });

    it('falls back to "extension" when no icon is set', () => {
      const addon = makeAddon();
      addon.icon = undefined;
      const component = build(makeData({ addon }));

      expect(component.getAddonIcon()).toBe('extension');
    });
  });

  describe('getObjectTypeTranslationKey', () => {
    it('maps a known object type to its translation key', () => {
      const component = build(makeData({ objectType: 'diagram' }));

      expect(component.getObjectTypeTranslationKey()).toBe('common.objectTypes.diagram');
    });

    it('returns the raw object type when unmapped', () => {
      const component = build(makeData({ objectType: 'mystery' as never }));

      expect(component.getObjectTypeTranslationKey()).toBe('mystery');
    });
  });

  describe('isParamRequired', () => {
    it('is true only when required is explicitly true', () => {
      const component = build(makeData());

      expect(component.isParamRequired({ name: 'p', type: 'string', required: true })).toBe(true);
      expect(component.isParamRequired({ name: 'p', type: 'string', required: false })).toBe(false);
      expect(component.isParamRequired({ name: 'p', type: 'string' })).toBe(false);
    });
  });

  describe('toggleParam', () => {
    it('enables the control and marks the param included', () => {
      const params: AddonParameter[] = [{ name: 'optional', type: 'string', required: false }];
      mockAddonService.get.mockReturnValue(of(makeAddon(params)));
      const component = build(makeData());
      component.ngOnInit();

      component.toggleParam('optional', true);

      expect(component.includedParams['optional']).toBe(true);
      expect(component.form.get('optional')?.enabled).toBe(true);
    });

    it('disables the control and marks the param excluded', () => {
      const params: AddonParameter[] = [{ name: 'required', type: 'string', required: true }];
      mockAddonService.get.mockReturnValue(of(makeAddon(params)));
      const component = build(makeData());
      component.ngOnInit();

      component.toggleParam('required', false);

      expect(component.includedParams['required']).toBe(false);
      expect(component.form.get('required')?.disabled).toBe(true);
    });
  });

  describe('canInvoke', () => {
    it('is false while loading', () => {
      const component = build(makeData());
      // ngOnInit not called -> loading stays true.
      expect(component.canInvoke).toBe(false);
    });

    it('is true once loaded with a valid form and no errors', () => {
      mockAddonService.get.mockReturnValue(of(makeAddon([])));
      const component = build(makeData());
      component.ngOnInit();

      expect(component.canInvoke).toBe(true);
    });

    it('is false while an invocation is in flight', () => {
      mockAddonService.get.mockReturnValue(of(makeAddon([])));
      const component = build(makeData());
      component.ngOnInit();
      component.invoking = true;

      expect(component.canInvoke).toBe(false);
    });
  });

  describe('onInvoke', () => {
    it('invokes the addon and closes the dialog with the response', () => {
      mockAddonService.get.mockReturnValue(of(makeAddon([])));
      mockAddonService.invoke.mockReturnValue(of({ invocation_id: 'inv-99' }));
      const component = build(makeData({ objectId: 'obj-1' }));
      component.ngOnInit();

      component.onInvoke();

      expect(mockAddonService.invoke).toHaveBeenCalledWith(
        'addon-1',
        expect.objectContaining({
          threat_model_id: 'tm-1',
          object_type: 'threat_model',
          object_id: 'obj-1',
        }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        submitted: true,
        response: { invocation_id: 'inv-99' },
      });
    });

    it('surfaces an error message and stays open when invocation fails', () => {
      mockAddonService.get.mockReturnValue(of(makeAddon([])));
      mockAddonService.invoke.mockReturnValue(
        throwError(() => ({ error: { message: 'addon exploded' } })),
      );
      const component = build(makeData());
      component.ngOnInit();

      component.onInvoke();

      expect(component.errorMessage).toBe('addon exploded');
      expect(component.invoking).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('does nothing when canInvoke is false', () => {
      const component = build(makeData());
      // loading still true -> canInvoke false.
      component.onInvoke();

      expect(mockAddonService.invoke).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with submitted: false', () => {
      const component = build(makeData());

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ submitted: false });
    });
  });
});
