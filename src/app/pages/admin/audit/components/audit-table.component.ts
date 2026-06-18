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
// SEM@a30b08f16e58230ce7bdceb97b32740cae062367: render a paginated audit log table with row-click, pagination, and retry events
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
  // SEM@4eda3848e203844745b1671639275a3c55f26217: compute the display text for a column cell given a row (pure)
  cellValue(col: AuditColumnDef, row: unknown): string {
    return col.cell(row as Record<string, unknown>);
  }

  /** Extracts a row's id for anchor highlighting and click events. */
  // SEM@a30b08f16e58230ce7bdceb97b32740cae062367: extract the audit entry ID from an opaque row record (pure)
  rowId(row: unknown): string {
    return (row as { id?: string }).id ?? '';
  }

  // SEM@4eda3848e203844745b1671639275a3c55f26217: dispatch row-click event with the audit entry ID to the parent (pure)
  onRowClick(row: unknown): void {
    this.rowClick.emit({ id: this.rowId(row) });
  }

  // SEM@cbcc3ec1aaec7b489eee0eea6221a528f5f3cc7e: dispatch older-page pagination event to the parent (pure)
  onOlderClick(): void {
    this.older.emit();
  }

  // SEM@cbcc3ec1aaec7b489eee0eea6221a528f5f3cc7e: dispatch newer-page pagination event to the parent (pure)
  onNewerClick(): void {
    this.newer.emit();
  }

  // SEM@cbcc3ec1aaec7b489eee0eea6221a528f5f3cc7e: dispatch retry event to the parent after a load failure (pure)
  onRetryClick(): void {
    this.retry.emit();
  }
}
