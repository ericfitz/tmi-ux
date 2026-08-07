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

import { CopyQuotaDialogComponent, CopyQuotaDialogData } from './copy-quota-dialog.component';
import type { AdminUser } from '@app/types/user.types';
import type { UserAPIQuota, WebhookQuota } from '@app/types/quota.types';

describe('CopyQuotaDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockQuotaService: Record<string, ReturnType<typeof vi.fn>>;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockNotification: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  const data: CopyQuotaDialogData = {
    sourceUuid: 'uuid-source',
    sourceEmail: 'source@example.com',
    sourceName: 'Source User',
    sourceProvider: 'tmi',
  };

  const target: AdminUser = {
    internal_uuid: 'uuid-target',
    email: 'target@example.com',
  } as AdminUser;

  const apiQuota: UserAPIQuota = {
    user_id: 'uuid-source',
    max_requests_per_minute: 200,
    max_requests_per_hour: 9000,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
  };

  const webhookQuota: WebhookQuota = {
    owner_id: 'uuid-source',
    max_subscriptions: 20,
    max_events_per_minute: 30,
    max_subscription_requests_per_minute: 15,
    max_subscription_requests_per_day: 50,
  };

  const notFound = (): ReturnType<typeof throwError> => throwError(() => ({ status: 404 }));

  function build(): CopyQuotaDialogComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new CopyQuotaDialogComponent(
          mockDialogRef as never,
          data,
          new FormBuilder(),
          mockQuotaService as never,
          mockLogger as never,
          mockNotification as never,
          mockTransloco as never,
        ),
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockQuotaService = {
      getUserAPIQuota: vi.fn(() => of(apiQuota)),
      getWebhookQuota: vi.fn(() => of(webhookQuota)),
      updateUserAPIQuota: vi.fn(() => of(apiQuota)),
      updateWebhookQuota: vi.fn(() => of(webhookQuota)),
      listUsers: vi.fn(() => of({ users: [target] })),
    };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('loads both source quotas on init', () => {
    const component = build();
    component.ngOnInit();

    expect(mockQuotaService['getUserAPIQuota']).toHaveBeenCalledWith('uuid-source');
    expect(mockQuotaService['getWebhookQuota']).toHaveBeenCalledWith('uuid-source');
    expect(component.sourceAPIQuota).toEqual(apiQuota);
    expect(component.sourceWebhookQuota).toEqual(webhookQuota);
    expect(component.loadingSource).toBe(false);
    expect(component.hasSomethingToCopy).toBe(true);
  });

  it('treats a 404 as "source on system defaults" for that quota type', () => {
    mockQuotaService['getWebhookQuota'] = vi.fn(notFound);
    const component = build();
    component.ngOnInit();

    expect(component.sourceAPIQuota).toEqual(apiQuota);
    expect(component.sourceWebhookQuota).toBeNull();
    expect(component.loadError).toBe(false);
    expect(component.hasSomethingToCopy).toBe(true);
  });

  it('reports nothing to copy when both source quotas 404', () => {
    mockQuotaService['getUserAPIQuota'] = vi.fn(notFound);
    mockQuotaService['getWebhookQuota'] = vi.fn(notFound);
    const component = build();
    component.ngOnInit();

    expect(component.hasSomethingToCopy).toBe(false);
  });

  it('sets loadError on a non-404 failure', () => {
    mockQuotaService['getUserAPIQuota'] = vi.fn(() => throwError(() => ({ status: 500 })));
    const component = build();
    component.ngOnInit();

    expect(component.loadError).toBe(true);
    expect(mockLogger['error']).toHaveBeenCalled();
  });

  it('excludes the source user from target search results', () => {
    const sourceAsResult = { internal_uuid: 'uuid-source', email: 'source@example.com' };
    mockQuotaService['listUsers'] = vi.fn(() => of({ users: [target, sourceAsResult] }));
    const component = build();

    component.searchUsers('example');

    expect(component.filteredUsers).toEqual([target]);
  });

  it('fetches target quotas when a target is selected', () => {
    const component = build();
    component.ngOnInit();

    component.onSelectTarget(target);

    expect(mockQuotaService['getUserAPIQuota']).toHaveBeenCalledWith('uuid-target');
    expect(mockQuotaService['getWebhookQuota']).toHaveBeenCalledWith('uuid-target');
    expect(component.targetAPIQuota).toEqual(apiQuota);
    expect(component.loadingTarget).toBe(false);
  });

  it('copies both quota types to the target and closes with true', () => {
    const component = build();
    component.ngOnInit();
    component.onSelectTarget(target);

    component.onCopy();

    expect(mockQuotaService['updateUserAPIQuota']).toHaveBeenCalledWith('uuid-target', {
      max_requests_per_minute: 200,
      max_requests_per_hour: 9000,
    });
    expect(mockQuotaService['updateWebhookQuota']).toHaveBeenCalledWith('uuid-target', {
      max_subscriptions: 20,
      max_events_per_minute: 30,
      max_subscription_requests_per_minute: 15,
      max_subscription_requests_per_day: 50,
    });
    expect(mockNotification['showSuccess']).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('copies only the quota type the source has customized', () => {
    mockQuotaService['getWebhookQuota'] = vi.fn(notFound);
    const component = build();
    component.ngOnInit();
    component.onSelectTarget(target);

    component.onCopy();

    expect(mockQuotaService['updateUserAPIQuota']).toHaveBeenCalled();
    expect(mockQuotaService['updateWebhookQuota']).not.toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('does not copy without a target', () => {
    const component = build();
    component.ngOnInit();

    component.onCopy();

    expect(mockQuotaService['updateUserAPIQuota']).not.toHaveBeenCalled();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('stays open and shows an error when a write fails', () => {
    mockQuotaService['updateWebhookQuota'] = vi.fn(() => throwError(() => ({ status: 500 })));
    const component = build();
    component.ngOnInit();
    component.onSelectTarget(target);

    component.onCopy();

    // The sibling write still completes despite the failure
    expect(mockQuotaService['updateUserAPIQuota']).toHaveBeenCalled();
    expect(mockNotification['showError']).toHaveBeenCalled();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(component.copying).toBe(false);
  });

  it('reports "reload needed" when cancelling after a failed write attempt', () => {
    mockQuotaService['updateWebhookQuota'] = vi.fn(() => throwError(() => ({ status: 500 })));
    const component = build();
    component.ngOnInit();
    component.onSelectTarget(target);
    component.onCopy();

    component.onCancel();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('blocks copying when the target quotas fail to load with a non-404', () => {
    const component = build();
    component.ngOnInit();
    mockQuotaService['getUserAPIQuota'] = vi.fn(() => throwError(() => ({ status: 500 })));
    component.onSelectTarget(target);

    component.onCopy();

    expect(component.loadError).toBe(true);
    expect(mockQuotaService['updateUserAPIQuota']).not.toHaveBeenCalled();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('clears target state when the target is cleared', () => {
    const component = build();
    component.ngOnInit();
    component.onSelectTarget(target);

    component.onClearTarget();

    expect(component.targetUser).toBeNull();
    expect(component.targetAPIQuota).toBeNull();
    expect(component.targetWebhookQuota).toBeNull();
  });

  it('closes with false on cancel', () => {
    const component = build();

    component.onCancel();

    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
