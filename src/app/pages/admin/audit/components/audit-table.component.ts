import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AuditColumnDef } from '@app/pages/admin/audit/models/admin-audit.model';

@Component({
  selector: 'app-audit-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './audit-table.component.html',
  styleUrl: './audit-table.component.scss',
})
export class AuditTableComponent {
  @Input() columns: AuditColumnDef[] = [];
  @Input() rows: readonly unknown[] = [];
  @Input() loading = false;
  @Input() nextCursor: string | null | undefined = undefined;
  @Input() prevCursor: string | null | undefined = undefined;
  @Input() anchorId: string | null = null;
  @Input() hasError = false;

  @Output() older = new EventEmitter<void>();
  @Output() newer = new EventEmitter<void>();
  @Output() rowClick = new EventEmitter<{ id: string }>();
  @Output() retry = new EventEmitter<void>();

  /** Returns column keys for mat-table's displayedColumns. */
  get displayedColumns(): string[] {
    return this.columns.map(c => c.key);
  }

  /** Renders a column's cell text for a row (widens the row to an indexable record). */
  cellValue(col: AuditColumnDef, row: unknown): string {
    return col.cell(row as Record<string, unknown>);
  }

  /** Extracts a row's id for anchor highlighting and click events. */
  rowId(row: unknown): string {
    return String((row as Record<string, unknown>)['id'] ?? '');
  }

  onRowClick(row: unknown): void {
    this.rowClick.emit({ id: this.rowId(row) });
  }

  onOlderClick(): void {
    this.older.emit();
  }

  onNewerClick(): void {
    this.newer.emit();
  }

  onRetryClick(): void {
    this.retry.emit();
  }
}
