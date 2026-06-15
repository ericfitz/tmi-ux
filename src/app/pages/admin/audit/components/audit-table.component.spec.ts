import '@angular/compiler';

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { AuditTableComponent } from './audit-table.component';
import { AuditColumnDef } from '@app/pages/admin/audit/models/admin-audit.model';

/** Two-column, two-row fixture data. */
const TWO_COLUMNS: AuditColumnDef[] = [
  { key: 'id', headerKey: 'admin.audit.col.id', cell: row => String(row['id']) },
  { key: 'action', headerKey: 'admin.audit.col.action', cell: row => String(row['action']) },
];

const TWO_ROWS: Record<string, unknown>[] = [
  { id: 'row-1', action: 'create' },
  { id: 'row-2', action: 'delete' },
];

function buildFixture(
  overrides: Partial<{
    columns: AuditColumnDef[];
    rows: Record<string, unknown>[];
    loading: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    anchorId: string | null;
    hasError: boolean;
  }> = {},
): ComponentFixture<AuditTableComponent> {
  /** Minimal i18n stub: transloco returns the key as-is. */
  const translocoTesting = TranslocoTestingModule.forRoot({
    langs: { en: {} },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });

  void TestBed.configureTestingModule({
    imports: [AuditTableComponent, translocoTesting],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuditTableComponent);
  const comp = fixture.componentInstance;
  comp.columns = overrides.columns ?? TWO_COLUMNS;
  comp.rows = overrides.rows ?? TWO_ROWS;
  comp.loading = overrides.loading ?? false;
  comp.nextCursor = overrides.nextCursor !== undefined ? overrides.nextCursor : null;
  comp.prevCursor = overrides.prevCursor !== undefined ? overrides.prevCursor : null;
  comp.anchorId = overrides.anchorId ?? null;
  comp.hasError = overrides.hasError ?? false;
  fixture.detectChanges();
  return fixture;
}

function query<E extends Element = HTMLElement>(
  fixture: ComponentFixture<AuditTableComponent>,
  selector: string,
): E {
  return fixture.nativeElement.querySelector(selector) as E;
}

function queryAll<E extends Element = HTMLElement>(
  fixture: ComponentFixture<AuditTableComponent>,
  selector: string,
): E[] {
  return Array.from(fixture.nativeElement.querySelectorAll<E>(selector));
}

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('AuditTableComponent', () => {
  describe('(a) renders one row per data record', () => {
    let fixture: ComponentFixture<AuditTableComponent>;

    beforeEach(() => {
      fixture = buildFixture();
    });

    it('should render exactly 2 audit rows', () => {
      const rows = queryAll(fixture, '[data-testid="audit-row"]');
      expect(rows).toHaveLength(2);
    });

    it('should render the mat-table', () => {
      const table = query(fixture, '[data-testid="audit-table"]');
      expect(table).not.toBeNull();
    });
  });

  describe('(b) Newer button', () => {
    it('is disabled when prevCursor is null', () => {
      const fixture = buildFixture({ prevCursor: null });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-newer"]');
      expect(btn.disabled).toBe(true);
    });

    it('is disabled when prevCursor is undefined', () => {
      const fixture = buildFixture({ prevCursor: undefined });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-newer"]');
      expect(btn.disabled).toBe(true);
    });

    it('is enabled when prevCursor is set', () => {
      const fixture = buildFixture({ prevCursor: 'cursor-abc' });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-newer"]');
      expect(btn.disabled).toBe(false);
    });

    it('emits newer when the handler is invoked', () => {
      // mat-button DOM clicks don't dispatch Angular events in JSDOM; test the handler wire-up
      const fixture = buildFixture({ prevCursor: 'cursor-abc' });
      let count = 0;
      fixture.componentInstance.newer.subscribe(() => count++);
      fixture.componentInstance.onNewerClick();
      expect(count).toBe(1);
    });
  });

  describe('(c) Older button', () => {
    it('is disabled when nextCursor is null', () => {
      const fixture = buildFixture({ nextCursor: null });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-older"]');
      expect(btn.disabled).toBe(true);
    });

    it('is disabled when nextCursor is undefined', () => {
      const fixture = buildFixture({ nextCursor: undefined });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-older"]');
      expect(btn.disabled).toBe(true);
    });

    it('is enabled when nextCursor is set', () => {
      const fixture = buildFixture({ nextCursor: 'cursor-xyz' });
      const btn = query<HTMLButtonElement>(fixture, '[data-testid="audit-older"]');
      expect(btn.disabled).toBe(false);
    });

    it('emits older when the handler is invoked', () => {
      // mat-button DOM clicks don't dispatch Angular events in JSDOM; test the handler wire-up
      const fixture = buildFixture({ nextCursor: 'cursor-xyz' });
      let count = 0;
      fixture.componentInstance.older.subscribe(() => count++);
      fixture.componentInstance.onOlderClick();
      expect(count).toBe(1);
    });
  });

  describe('(d) row click emits rowClick with id', () => {
    it('emits { id } when a row is clicked', () => {
      const fixture = buildFixture();
      const emitted: { id: string }[] = [];
      fixture.componentInstance.rowClick.subscribe((v: { id: string }) => emitted.push(v));

      const rows = queryAll<HTMLTableRowElement>(fixture, '[data-testid="audit-row"]');
      rows[0].click();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ id: 'row-1' });
    });

    it('emits the correct id for the second row', () => {
      const fixture = buildFixture();
      const emitted: { id: string }[] = [];
      fixture.componentInstance.rowClick.subscribe((v: { id: string }) => emitted.push(v));

      const rows = queryAll<HTMLTableRowElement>(fixture, '[data-testid="audit-row"]');
      rows[1].click();

      expect(emitted[0]).toEqual({ id: 'row-2' });
    });
  });

  describe('(e) error and empty states', () => {
    it('shows retry button when hasError=true', () => {
      const fixture = buildFixture({ hasError: true });
      const retryBtn = query(fixture, '[data-testid="audit-retry"]');
      expect(retryBtn).not.toBeNull();
    });

    it('retry button emits retry when the handler is invoked', () => {
      // mat-button DOM clicks don't dispatch Angular events in JSDOM; test the handler wire-up
      const fixture = buildFixture({ hasError: true });
      let count = 0;
      fixture.componentInstance.retry.subscribe(() => count++);
      fixture.componentInstance.onRetryClick();
      expect(count).toBe(1);
    });

    it('does not show the table when hasError=true', () => {
      const fixture = buildFixture({ hasError: true });
      const table = query(fixture, '[data-testid="audit-table"]');
      expect(table).toBeNull();
    });

    it('shows empty message when rows=[] and no error and not loading', () => {
      const fixture = buildFixture({ rows: [] });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('admin.audit.empty');
    });

    it('does not show the table when rows are empty', () => {
      const fixture = buildFixture({ rows: [] });
      const table = query(fixture, '[data-testid="audit-table"]');
      expect(table).toBeNull();
    });

    it('does not show retry button when no error', () => {
      const fixture = buildFixture({ hasError: false, rows: TWO_ROWS });
      const retryBtn = query(fixture, '[data-testid="audit-retry"]');
      expect(retryBtn).toBeNull();
    });
  });

  describe('(f) anchor-row class', () => {
    it('adds anchor-row class to the row whose id matches anchorId', () => {
      const fixture = buildFixture({ anchorId: 'row-2' });
      const rows = queryAll<HTMLElement>(fixture, '[data-testid="audit-row"]');
      expect(rows[0].classList.contains('anchor-row')).toBe(false);
      expect(rows[1].classList.contains('anchor-row')).toBe(true);
    });

    it('does not add anchor-row class when anchorId is null', () => {
      const fixture = buildFixture({ anchorId: null });
      const rows = queryAll<HTMLElement>(fixture, '[data-testid="audit-row"]');
      rows.forEach(row => expect(row.classList.contains('anchor-row')).toBe(false));
    });
  });
});
