// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, BehaviorSubject } from 'rxjs';
import { FormBuilder } from '@angular/forms';

import { NotePageComponent } from './note-page.component';
import { ThreatModel, Note } from '../../models/threat-model.model';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';

// Mock interfaces
interface MockActivatedRoute {
  snapshot: {
    paramMap: {
      get: ReturnType<typeof vi.fn>;
    };
    data: Record<string, unknown>;
  };
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  currentLanguage$: BehaviorSubject<{ code: string; rtl: boolean }>;
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
  getActiveLang: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

interface MockThreatModelService {
  updateNote: ReturnType<typeof vi.fn>;
  deleteNote: ReturnType<typeof vi.fn>;
}

interface MockAuthorizationService {
  canEdit$: BehaviorSubject<boolean>;
}

interface MockAddonService {
  list: ReturnType<typeof vi.fn>;
}

describe('NotePageComponent', () => {
  let component: NotePageComponent;
  let route: MockActivatedRoute;
  let router: MockRouter;
  let fb: FormBuilder;
  let snackBar: MockSnackBar;
  let dialog: MockDialog;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let translocoService: MockTranslocoService;
  let threatModelService: MockThreatModelService;
  let authorizationService: MockAuthorizationService;
  let addonService: MockAddonService;

  const mockNote: Note = {
    id: 'note-1',
    name: 'Test Note',
    content: '# Test Content\n\nSome markdown content.',
    description: 'Test description',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    metadata: [],
  };

  const mockThreatModel: ThreatModel = {
    id: 'tm-1',
    name: 'Test Threat Model',
    description: 'Test description',
    threat_model_framework: 'STRIDE',
    threats: [],
    assets: [],
    diagrams: [],
    documents: [],
    notes: [mockNote],
    repositories: [],
    authorization: [],
    owner: { provider: 'test', provider_id: 'user1' },
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    metadata: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    route = {
      snapshot: {
        paramMap: {
          get: vi.fn((key: string) => {
            if (key === 'id') return 'tm-1';
            if (key === 'noteId') return 'note-1';
            return null;
          }),
        },
        data: {
          threatModel: mockThreatModel,
        },
      },
    };

    router = createTypedMockRouter();
    fb = new FormBuilder();
    snackBar = { open: vi.fn() };
    dialog = { open: vi.fn() };
    loggerService = createTypedMockLoggerService();
    languageService = {
      currentLanguage$: new BehaviorSubject({ code: 'en-US', rtl: false }),
      direction$: new BehaviorSubject('ltr' as const),
    };
    translocoService = {
      translate: vi.fn((key: string) => key),
      getActiveLang: vi.fn().mockReturnValue('en-US'),
      load: vi.fn().mockReturnValue(of({})),
    };
    threatModelService = {
      updateNote: vi.fn().mockReturnValue(of(mockNote)),
      deleteNote: vi.fn().mockReturnValue(of(true)),
    };
    authorizationService = {
      canEdit$: new BehaviorSubject(true),
    };
    addonService = {
      list: vi.fn().mockReturnValue(of([])),
    };

    component = new NotePageComponent(
      route as any,
      router as any,
      fb,
      snackBar as any,
      dialog as any,
      loggerService as any,
      languageService as any,
      translocoService as any,
      threatModelService as any,
      authorizationService as any,
      addonService as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load threat model and note from route data', () => {
      component.ngOnInit();

      expect(component.threatModelId).toBe('tm-1');
      expect(component.noteId).toBe('note-1');
      expect(component.threatModel).toBe(mockThreatModel);
      expect(component.note).toBe(mockNote);
    });

    it('should navigate to dashboard if threat model is not found', () => {
      route.snapshot.data = {};
      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should navigate to threat model page if note is not found', () => {
      route.snapshot.data = {
        threatModel: { ...mockThreatModel, notes: [] },
      };
      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1'], {
        queryParams: { error: 'note_not_found' },
      });
    });

    it('should subscribe to canEdit$ and update form editability', () => {
      component.ngOnInit();
      expect(component.canEdit).toBe(true);

      authorizationService.canEdit$.next(false);
      expect(component.canEdit).toBe(false);
    });

    it('should populate form with note data', () => {
      component.ngOnInit();

      expect(component.noteForm.get('name')?.value).toBe('Test Note');
      expect(component.noteForm.get('content')?.value).toBe(
        '# Test Content\n\nSome markdown content.',
      );
      expect(component.noteForm.get('description')?.value).toBe('Test description');
    });

    it('should start in preview mode when content exists', () => {
      component.ngOnInit();
      expect(component.previewMode).toBe(true);
    });
  });

  describe('save', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should not save if form is invalid', () => {
      component.noteForm.get('name')?.setValue('');
      component.save();
      expect(threatModelService.updateNote).not.toHaveBeenCalled();
    });

    it('should not save if user cannot edit', () => {
      authorizationService.canEdit$.next(false);
      component.noteForm.markAsDirty();
      component.save();
      expect(threatModelService.updateNote).not.toHaveBeenCalled();
    });

    it('should save note and navigate back on success', () => {
      component.noteForm.markAsDirty();
      component.save();

      expect(threatModelService.updateNote).toHaveBeenCalledWith(
        'tm-1',
        'note-1',
        expect.objectContaining({ name: 'Test Note' }),
      );
      expect(snackBar.open).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });
  });

  describe('deleteNote', () => {
    beforeEach(() => {
      component.ngOnInit();
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('should not delete if user cannot edit', () => {
      authorizationService.canEdit$.next(false);
      component.deleteNote();
      expect(threatModelService.deleteNote).not.toHaveBeenCalled();
    });

    it('should delete note and navigate back when confirmed', () => {
      component.deleteNote();

      expect(window.confirm).toHaveBeenCalled();
      expect(threatModelService.deleteNote).toHaveBeenCalledWith('tm-1', 'note-1');
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should not delete when user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      component.deleteNote();

      expect(threatModelService.deleteNote).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate back immediately if form is not dirty', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should prompt for confirmation if form is dirty', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.noteForm.markAsDirty();
      component.cancel();

      expect(window.confirm).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should not navigate if user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      component.noteForm.markAsDirty();
      component.cancel();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigateBack', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate to threat model page', () => {
      component.navigateBack();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });
  });

  describe('markdown features', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should toggle preview mode', () => {
      component.previewMode = false;
      component.togglePreview();
      expect(component.previewMode).toBe(true);

      component.togglePreview();
      expect(component.previewMode).toBe(false);
    });

    it('should return current content length', () => {
      component.noteForm.get('content')?.setValue('Hello World');
      expect(component.currentContentLength).toBe(11);
    });

    it('should return markdown content', () => {
      component.noteForm.get('content')?.setValue('# Heading');
      expect(component.markdownContent).toBe('# Heading');
    });

    it('should track text selection', () => {
      const mockEvent = {
        target: {
          selectionStart: 0,
          selectionEnd: 5,
        },
      } as unknown as Event;

      component.onTextareaSelect(mockEvent);
      expect(component.hasSelection).toBe(true);

      const noSelectionEvent = {
        target: {
          selectionStart: 0,
          selectionEnd: 0,
        },
      } as unknown as Event;

      component.onTextareaSelect(noSelectionEvent);
      expect(component.hasSelection).toBe(false);
    });
  });

  describe('ngOnDestroy', () => {
    it('should clean up anchor click handler', () => {
      component.ngOnInit();
      // Just verify it doesn't throw
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
