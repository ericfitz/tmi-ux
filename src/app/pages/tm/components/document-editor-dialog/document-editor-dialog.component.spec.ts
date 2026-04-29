import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Injector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';

import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
} from './document-editor-dialog.component';
import { ContentTokenService } from '@app/core/services/content-token.service';
import { GoogleDrivePickerService } from '@app/core/services/google-drive-picker.service';
import { MicrosoftFilePickerService } from '@app/core/services/microsoft-file-picker.service';
import { LoggerService } from '@app/core/services/logger.service';
import { ThreatModelService } from '../../services/threat-model.service';
import {
  MicrosoftAccountNotLinkedError,
  MicrosoftGraphPermissionRejectedError,
  MicrosoftGraphUnavailableError,
  MicrosoftGrantTimeoutError,
  PickerLoadFailedError,
  type ContentTokenInfo,
  type PickerEvent,
} from '@app/core/models/content-provider.types';
import type { Document } from '../../models/threat-model.model';

describe('DocumentEditorDialogComponent — picker integration', () => {
  let tokens$: BehaviorSubject<ContentTokenInfo[]>;
  let mockTokenSvc: {
    contentTokens$: BehaviorSubject<ContentTokenInfo[]>;
    authorize: ReturnType<typeof vi.fn>;
  };
  let mockPicker: { pick: ReturnType<typeof vi.fn> };
  let mockMsPicker: { pick: ReturnType<typeof vi.fn> };
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockInjector: { get: ReturnType<typeof vi.fn> };
  let mockTms: {
    getDocument: ReturnType<typeof vi.fn>;
    requestDocumentAccess: ReturnType<typeof vi.fn>;
  };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };
  let mockLogger: { warn: ReturnType<typeof vi.fn> };

  function createComponent(data: DocumentEditorDialogData): DocumentEditorDialogComponent {
    return new DocumentEditorDialogComponent(
      mockDialogRef as unknown as MatDialogRef<DocumentEditorDialogComponent>,
      new FormBuilder(),
      data,
      mockTokenSvc as unknown as ContentTokenService,
      mockInjector as unknown as Injector,
      mockTms as unknown as ThreatModelService,
      mockSnack as unknown as MatSnackBar,
      mockTransloco as unknown as TranslocoService,
      mockLogger as unknown as LoggerService,
    );
  }

  beforeEach(() => {
    tokens$ = new BehaviorSubject<ContentTokenInfo[]>([]);
    mockTokenSvc = {
      contentTokens$: tokens$,
      authorize: vi.fn().mockReturnValue(of({ authorization_url: 'https://x', expires_at: '' })),
    };
    mockPicker = { pick: vi.fn() };
    mockMsPicker = { pick: vi.fn() };
    mockDialogRef = { close: vi.fn() };
    mockInjector = {
      get: vi.fn().mockImplementation((token: unknown) => {
        if (token === GoogleDrivePickerService) return mockPicker;
        if (token === MicrosoftFilePickerService) return mockMsPicker;
        return null;
      }),
    };
    mockTms = {
      getDocument: vi.fn(),
      requestDocumentAccess: vi.fn(),
    };
    mockSnack = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) };
    mockLogger = { warn: vi.fn() };
  });

  it('defaults selectedSource to "url" in create mode', () => {
    const c = createComponent({ mode: 'create' });
    expect(c.selectedSource).toBe('url');
  });

  it('exposes pickerSourceOptions including google_workspace and microsoft', () => {
    const c = createComponent({ mode: 'create' });
    expect(c.pickerSourceOptions.some(p => p.id === 'google_workspace')).toBe(true);
    expect(c.pickerSourceOptions.some(p => p.id === 'microsoft')).toBe(true);
  });

  it('hasLinkedToken returns true when an active token matches', () => {
    tokens$.next([
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-26T00:00:00Z',
      },
    ]);
    const c = createComponent({ mode: 'create' });
    c.ngOnInit();
    expect(c.hasLinkedToken('google_workspace')).toBe(true);
  });

  it('onPickFile auto-fills name and uri and stores picker_registration', () => {
    tokens$.next([
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-26T00:00:00Z',
      },
    ]);
    const event: PickerEvent = {
      kind: 'picked',
      file: {
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      },
    };
    mockPicker.pick.mockReturnValue(of(event));
    const c = createComponent({ mode: 'create' });
    c.ngOnInit();
    c.selectedSource = 'google_workspace';
    c.onPickFile();
    expect(c.documentForm.get('name')?.value).toBe('My doc.pdf');
    expect(c.documentForm.get('uri')?.value).toBe('https://drive.google.com/file/d/abc');
    expect(c.pickedFile?.fileId).toBe('abc');
  });

  describe('access refresh', () => {
    const baseDoc: Document = {
      id: 'doc-1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: { reason_code: 'microsoft_not_shared', remediations: [] },
    };

    it('ngOnInit re-fetches document when pending_access and threatModelId provided', () => {
      const refreshed: Document = { ...baseDoc, access_status: 'accessible' };
      mockTms.getDocument.mockReturnValue(of(refreshed));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();
      expect(mockTms.getDocument).toHaveBeenCalledWith('tm-1', 'doc-1');
      expect(c.currentDocument?.access_status).toBe('accessible');
    });

    it('ngOnInit does NOT re-fetch when document is accessible', () => {
      const c = createComponent({
        mode: 'edit',
        document: { ...baseDoc, access_status: 'accessible' },
        threatModelId: 'tm-1',
      });
      c.ngOnInit();
      expect(mockTms.getDocument).not.toHaveBeenCalled();
    });

    it('ngOnInit does NOT re-fetch when threatModelId is missing', () => {
      const c = createComponent({ mode: 'edit', document: baseDoc });
      c.ngOnInit();
      expect(mockTms.getDocument).not.toHaveBeenCalled();
    });

    it('ngOnInit does NOT re-fetch in create mode', () => {
      const c = createComponent({ mode: 'create', threatModelId: 'tm-1' });
      c.ngOnInit();
      expect(mockTms.getDocument).not.toHaveBeenCalled();
    });

    it('ngOnInit silently logs and continues when refresh fails', () => {
      mockTms.getDocument.mockReturnValue(throwError(() => new Error('boom')));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(c.currentDocument).toEqual(baseDoc);
    });

    it('onRecheckAccess POSTs request_access then re-GETs and shows success snackbar', () => {
      mockTms.getDocument.mockReturnValue(of(baseDoc));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();

      mockTms.requestDocumentAccess.mockReturnValue(of({ status: 'sent' }));
      const accessibleDoc: Document = { ...baseDoc, access_status: 'accessible' };
      mockTms.getDocument.mockReturnValue(of(accessibleDoc));

      c.onRecheckAccess();
      expect(mockTms.requestDocumentAccess).toHaveBeenCalledWith('tm-1', 'doc-1');
      expect(c.currentDocument?.access_status).toBe('accessible');
      expect(mockSnack.open).toHaveBeenCalledWith('documentAccess.checkNow.success', undefined, {
        duration: 3000,
      });
    });

    it('onRecheckAccess shows stillPending snackbar when status remains pending', () => {
      mockTms.getDocument.mockReturnValue(of(baseDoc));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();

      mockTms.requestDocumentAccess.mockReturnValue(of({ status: 'sent' }));
      mockTms.getDocument.mockReturnValue(of(baseDoc));

      c.onRecheckAccess();
      expect(mockSnack.open).toHaveBeenCalledWith(
        'documentAccess.checkNow.stillPending',
        undefined,
        { duration: 3000 },
      );
    });

    it('onRecheckAccess shows failed snackbar when request_access errors', () => {
      mockTms.getDocument.mockReturnValue(of(baseDoc));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();

      mockTms.requestDocumentAccess.mockReturnValue(throwError(() => new Error('boom')));
      c.onRecheckAccess();
      expect(mockSnack.open).toHaveBeenCalledWith('documentAccess.checkNow.failed', undefined, {
        duration: 3000,
      });
    });

    it('onRecheckAccess treats 409 as already-accessible, re-GETs, no failure snackbar', () => {
      mockTms.getDocument.mockReturnValue(of(baseDoc));
      const c = createComponent({
        mode: 'edit',
        document: baseDoc,
        threatModelId: 'tm-1',
      });
      c.ngOnInit();

      const accessibleDoc: Document = { ...baseDoc, access_status: 'accessible' };
      mockTms.requestDocumentAccess.mockReturnValue(throwError(() => ({ status: 409 })));
      mockTms.getDocument.mockReturnValue(of(accessibleDoc));

      c.onRecheckAccess();
      expect(c.currentDocument?.access_status).toBe('accessible');
      expect(mockSnack.open).toHaveBeenCalledWith('documentAccess.checkNow.success', undefined, {
        duration: 3000,
      });
      expect(mockSnack.open).not.toHaveBeenCalledWith(
        'documentAccess.checkNow.failed',
        expect.anything(),
        expect.anything(),
      );
    });

    it('onRecheckAccess is a no-op when threatModelId is missing', () => {
      const c = createComponent({ mode: 'edit', document: baseDoc });
      c.ngOnInit();
      c.onRecheckAccess();
      expect(mockTms.requestDocumentAccess).not.toHaveBeenCalled();
    });
  });

  it('onSubmit includes picker_registration after successful pick', () => {
    tokens$.next([
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-26T00:00:00Z',
      },
    ]);
    const event: PickerEvent = {
      kind: 'picked',
      file: {
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      },
    };
    mockPicker.pick.mockReturnValue(of(event));
    const c = createComponent({ mode: 'create' });
    c.ngOnInit();
    c.selectedSource = 'google_workspace';
    c.onPickFile();
    c.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My doc.pdf',
        uri: 'https://drive.google.com/file/d/abc',
        picker_registration: {
          provider_id: 'google_workspace',
          file_id: 'abc',
          mime_type: 'application/pdf',
        },
      }),
    );
  });

  describe('Microsoft picker integration', () => {
    function makeLinked(): ContentTokenInfo {
      return {
        provider_id: 'microsoft',
        status: 'active',
        scopes: [],
        created_at: '2026-04-28T00:00:00Z',
      };
    }

    it('renders Microsoft option in pickerSourceOptions and supports a microsoft pick', () => {
      tokens$.next([makeLinked()]);
      const event: PickerEvent = {
        kind: 'picked',
        file: {
          fileId: 'drive-1:item-1',
          name: 'spec.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          url: 'https://contoso.sharepoint.com/spec.docx',
        },
      };
      mockMsPicker.pick.mockReturnValue(of(event));

      const c = createComponent({ mode: 'create' });
      c.ngOnInit();
      c.selectedSource = 'microsoft';
      c.onPickFile();
      expect(c.documentForm.get('name')?.value).toBe('spec.docx');
      expect(c.pickedFile?.fileId).toBe('drive-1:item-1');
      c.onSubmit();
      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          picker_registration: {
            provider_id: 'microsoft',
            file_id: 'drive-1:item-1',
            mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        }),
      );
    });

    it('renders inline finalizing state and disables cancel/submit while finalizing', () => {
      tokens$.next([makeLinked()]);
      mockMsPicker.pick.mockReturnValue(of<PickerEvent>({ kind: 'finalizing' }));
      const c = createComponent({ mode: 'create' });
      c.ngOnInit();
      c.selectedSource = 'microsoft';
      c.onPickFile();
      expect(c.finalizing).toBe(true);
      expect(c.isCancelDisabled()).toBe(true);
      expect(c.isSubmitDisabled()).toBe(true);
    });

    it('uses provider-specific button label and link prompt for Microsoft', () => {
      const c = createComponent({ mode: 'create' });
      c.selectedSource = 'microsoft';
      expect(c.pickActionKey()).toBe('documentEditor.source.pickActionMicrosoft');
      expect(c.linkPromptKey()).toBe('documentEditor.source.linkPromptMicrosoft');
    });

    it.each([
      [new MicrosoftAccountNotLinkedError(), 'documentEditor.grantError.notLinked', true],
      [
        new MicrosoftGraphPermissionRejectedError(),
        'documentEditor.grantError.permissionDenied',
        false,
      ],
      [new MicrosoftGraphUnavailableError(), 'documentEditor.grantError.unavailable', false],
      [new MicrosoftGrantTimeoutError(), 'documentEditor.grantError.timeout', false],
      [new PickerLoadFailedError(), 'documentEditor.grantError.pickerLoadFailed', false],
      [new Error('boom'), 'documentEditor.grantError.generic', false],
    ])('maps %s to inline error state', (err, expectedKey, expectedCta) => {
      tokens$.next([makeLinked()]);
      mockMsPicker.pick.mockReturnValue(throwError(() => err));
      const c = createComponent({ mode: 'create' });
      c.ngOnInit();
      c.selectedSource = 'microsoft';
      c.onPickFile();
      expect(c.pickerError?.messageKey).toBe(expectedKey);
      expect(c.pickerError?.showLinkAccountCta).toBe(expectedCta);
      expect(c.finalizing).toBe(false);
    });

    it('onCancel is a no-op while finalizing (orphan-grant prevention)', () => {
      tokens$.next([makeLinked()]);
      mockMsPicker.pick.mockReturnValue(of<PickerEvent>({ kind: 'finalizing' }));
      const c = createComponent({ mode: 'create' });
      c.ngOnInit();
      c.selectedSource = 'microsoft';
      c.onPickFile();
      c.onCancel();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });
});
