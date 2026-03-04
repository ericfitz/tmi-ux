// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { CwePickerDialogComponent } from './cwe-picker-dialog.component';
import { CwePickerDialogData } from './cwe-picker-dialog.types';
import { CweWeakness } from '../../../../shared/models/cwe.model';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockCweService {
  loadWeaknesses: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
}

interface MockLoggerService {
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

const MOCK_WEAKNESSES: CweWeakness[] = [
  {
    cwe_id: 'CWE-79',
    name: 'Cross-site Scripting',
    description: 'The product does not neutralize user-controllable input.',
    extended_description: 'When a web application does not properly validate input...',
    parent_id: 'CWE-707',
  },
  {
    cwe_id: 'CWE-89',
    name: 'SQL Injection',
    description: 'The product constructs SQL commands using externally-influenced input.',
    extended_description: 'Without sufficient removal or quoting of SQL syntax...',
    parent_id: 'CWE-943',
  },
];

describe('CwePickerDialogComponent', () => {
  let component: CwePickerDialogComponent;
  let dialogRef: MockDialogRef;
  let cweService: MockCweService;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let data: CwePickerDialogData;

  function createComponent(dialogData?: Partial<CwePickerDialogData>): void {
    data = { existingCweIds: [], ...dialogData };
    dialogRef = { close: vi.fn() };
    cweService = {
      loadWeaknesses: vi.fn().mockReturnValue(of(MOCK_WEAKNESSES)),
      search: vi.fn().mockImplementation((weaknesses: CweWeakness[], query: string) => {
        if (!query.trim()) return weaknesses;
        const lower = query.toLowerCase();
        return weaknesses.filter(
          w => w.cwe_id.toLowerCase().includes(lower) || w.name.toLowerCase().includes(lower),
        );
      }),
    };
    loggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };

    component = new CwePickerDialogComponent(
      dialogRef as any,
      data,
      cweService as any,
      { markForCheck: vi.fn() } as any,
      loggerService as any,
      languageService as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load weaknesses on init', () => {
      component.ngOnInit();

      expect(cweService.loadWeaknesses).toHaveBeenCalled();
      expect(component.allWeaknesses).toEqual(MOCK_WEAKNESSES);
      expect(component.filteredWeaknesses).toEqual(MOCK_WEAKNESSES);
      expect(component.isLoading).toBe(false);
    });

    it('should set direction from language service', () => {
      component.ngOnInit();
      expect(component.currentDirection).toBe('ltr');
    });

    it('should handle load error gracefully', () => {
      cweService.loadWeaknesses.mockReturnValue(throwError(() => new Error('Network error')));

      component.ngOnInit();

      expect(loggerService.error).toHaveBeenCalled();
      expect(component.isLoading).toBe(false);
      expect(component.allWeaknesses).toEqual([]);
    });
  });

  describe('selection', () => {
    it('should set selectedCwe on selection change', () => {
      const mockEvent = {
        options: [{ selected: true, value: MOCK_WEAKNESSES[0] }],
      };

      component.onSelectionChange(mockEvent as any);

      expect(component.selectedCwe).toEqual(MOCK_WEAKNESSES[0]);
    });

    it('should clear selectedCwe when deselected', () => {
      component.selectedCwe = MOCK_WEAKNESSES[0];
      const mockEvent = {
        options: [{ selected: false, value: MOCK_WEAKNESSES[0] }],
      };

      component.onSelectionChange(mockEvent as any);

      expect(component.selectedCwe).toBeNull();
    });
  });

  describe('cancel', () => {
    it('should close dialog with no result', () => {
      component.cancel();

      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('addCwe', () => {
    it('should close dialog with selected CWE ID', () => {
      component.selectedCwe = MOCK_WEAKNESSES[0];

      component.addCwe();

      expect(dialogRef.close).toHaveBeenCalledWith({ cweId: 'CWE-79' });
    });

    it('should not close dialog when no CWE is selected', () => {
      component.selectedCwe = null;

      component.addCwe();

      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
