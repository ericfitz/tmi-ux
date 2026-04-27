import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { Injector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
} from './document-editor-dialog.component';
import { ContentTokenService } from '@app/core/services/content-token.service';
import { GoogleDrivePickerService } from '@app/core/services/google-drive-picker.service';
import type { ContentTokenInfo } from '@app/core/models/content-provider.types';

describe('DocumentEditorDialogComponent — picker integration', () => {
  let tokens$: BehaviorSubject<ContentTokenInfo[]>;
  let mockTokenSvc: {
    contentTokens$: BehaviorSubject<ContentTokenInfo[]>;
    authorize: ReturnType<typeof vi.fn>;
  };
  let mockPicker: { pick: ReturnType<typeof vi.fn> };
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockInjector: { get: ReturnType<typeof vi.fn> };

  function createComponent(data: DocumentEditorDialogData): DocumentEditorDialogComponent {
    return new DocumentEditorDialogComponent(
      mockDialogRef as unknown as MatDialogRef<DocumentEditorDialogComponent>,
      new FormBuilder(),
      data,
      mockTokenSvc as unknown as ContentTokenService,
      mockInjector as unknown as Injector,
    );
  }

  beforeEach(() => {
    tokens$ = new BehaviorSubject<ContentTokenInfo[]>([]);
    mockTokenSvc = {
      contentTokens$: tokens$,
      authorize: vi.fn().mockReturnValue(of({ authorization_url: 'https://x', expires_at: '' })),
    };
    mockPicker = { pick: vi.fn() };
    mockDialogRef = { close: vi.fn() };
    mockInjector = {
      get: vi.fn().mockImplementation((token: unknown) => {
        // The registry's pickerService for google_workspace is the GoogleDrivePickerService class.
        if (token === GoogleDrivePickerService) return mockPicker;
        return null;
      }),
    };
  });

  it('defaults selectedSource to "url" in create mode', () => {
    const c = createComponent({ mode: 'create' });
    expect(c.selectedSource).toBe('url');
  });

  it('exposes pickerSourceOptions including google_workspace', () => {
    const c = createComponent({ mode: 'create' });
    expect(c.pickerSourceOptions.some(p => p.id === 'google_workspace')).toBe(true);
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
    mockPicker.pick.mockReturnValue(
      of({
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      }),
    );
    const c = createComponent({ mode: 'create' });
    c.ngOnInit();
    c.selectedSource = 'google_workspace';
    c.onPickFile();
    expect(c.documentForm.get('name')?.value).toBe('My doc.pdf');
    expect(c.documentForm.get('uri')?.value).toBe('https://drive.google.com/file/d/abc');
    expect(c.pickedFile?.fileId).toBe('abc');
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
    mockPicker.pick.mockReturnValue(
      of({
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      }),
    );
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
});
