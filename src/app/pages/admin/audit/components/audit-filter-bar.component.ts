import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Observable, of, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminUser } from '@app/types/user.types';
import {
  AuditChangeType,
  AuditExportFormat,
  AuditFilter,
  AuditHttpMethod,
  AuditObjectType,
  AuditStream,
  SystemAuditFilter,
  TmAuditFilter,
} from '../models/admin-audit.model';

/** Minimum number of chars before the actor autocomplete fires a search. */
const ACTOR_MIN_LENGTH = 1;

/**
 * Config-driven filter bar shared by both audit views (system + threat-model).
 * Which fields are rendered is determined by the `stream` input.
 */
@Component({
  selector: 'app-audit-filter-bar',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslocoModule,
  ],
  templateUrl: './audit-filter-bar.component.html',
  styleUrl: './audit-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditFilterBarComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  /** Which audit stream this bar serves — drives which fields are shown. */
  @Input({ required: true }) stream!: AuditStream;

  /** Initial filter values (e.g. restored from query params). */
  @Input() initialFilter: AuditFilter = {};

  /** Emitted whenever any filter value changes. Only non-empty values are included. */
  @Output() filterChange = new EventEmitter<AuditFilter>();

  /** Emitted when the user chooses an export format. */
  @Output() exportRequested = new EventEmitter<AuditExportFormat>();

  // ── Shared filter state ──────────────────────────────────────────────────

  /** Bound to the actor autocomplete text input. */
  actorInput = '';

  /** ISO string for the created_after date picker. */
  createdAfter: string | null = null;

  /** ISO string for the created_before date picker. */
  createdBefore: string | null = null;

  /** Actor autocomplete suggestions. */
  actorSuggestions$: Observable<AdminUser[]> = of([]);

  // ── System-only filter state ─────────────────────────────────────────────

  httpMethod: AuditHttpMethod | null = null;
  pathPrefix = '';
  fieldPath = '';

  // ── TM-only filter state ─────────────────────────────────────────────────

  changeType: AuditChangeType | null = null;
  objectType: AuditObjectType | null = null;
  threatModelId = '';

  // ── Enum option lists ────────────────────────────────────────────────────

  readonly httpMethods: AuditHttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
  readonly changeTypes: AuditChangeType[] = [
    'created',
    'updated',
    'patched',
    'deleted',
    'rolled_back',
    'restored',
  ];
  readonly objectTypes: AuditObjectType[] = [
    'threat_model',
    'diagram',
    'threat',
    'asset',
    'document',
    'note',
    'repository',
  ];

  // ── Internal subjects for debounced text inputs ──────────────────────────

  private actorSubject$ = new Subject<string>();
  private pathPrefixSubject$ = new Subject<string>();
  private fieldPathSubject$ = new Subject<string>();
  private threatModelIdSubject$ = new Subject<string>();

  constructor(
    private userAdminService: UserAdminService,
    private logger: LoggerService,
  ) {}

  /** True when the component is operating in the system-audit stream. */
  get isSystemStream(): boolean {
    return this.stream === 'system';
  }

  ngOnInit(): void {
    this._initFromFilter();
    this._wireTextDebounce();
    this._wireActorAutocomplete();
  }

  // ── Template event handlers ──────────────────────────────────────────────

  /** Called by the actor `<input>` on every keystroke. */
  onActorInput(value: string): void {
    this.actorInput = value;
    this.actorSubject$.next(value);
  }

  /** Called when the user picks a suggestion from the actor autocomplete. */
  onActorSelected(event: MatAutocompleteSelectedEvent): void {
    const user = event.option.value as AdminUser;
    this.actorInput = user.email ?? '';
    this._emit();
  }

  /** Display function for the actor autocomplete panel. */
  displayActor = (user: AdminUser | string | null): string => {
    if (!user) return '';
    if (typeof user === 'string') return user;
    return user.email ?? '';
  };

  /** Called by the http_method `<mat-select>`. */
  onHttpMethodChange(value: AuditHttpMethod | null): void {
    this.httpMethod = value;
    this._emit();
  }

  /** Called by the path_prefix text input. */
  onPathPrefixInput(value: string): void {
    this.pathPrefix = value;
    this.pathPrefixSubject$.next(value);
  }

  /** Called by the field_path text input. */
  onFieldPathInput(value: string): void {
    this.fieldPath = value;
    this.fieldPathSubject$.next(value);
  }

  /** Called by the change_type `<mat-select>`. */
  onChangeTypeChange(value: AuditChangeType | null): void {
    this.changeType = value;
    this._emit();
  }

  /** Called by the object_type `<mat-select>`. */
  onObjectTypeChange(value: AuditObjectType | null): void {
    this.objectType = value;
    this._emit();
  }

  /** Called by the threat_model_id text input. */
  onThreatModelIdInput(value: string): void {
    this.threatModelId = value;
    this.threatModelIdSubject$.next(value);
  }

  /** Called by the created_after date picker. */
  onCreatedAfterChange(isoString: string | null): void {
    this.createdAfter = isoString ?? null;
    this._emit();
  }

  /** Called by the created_before date picker. */
  onCreatedBeforeChange(isoString: string | null): void {
    this.createdBefore = isoString ?? null;
    this._emit();
  }

  /** Resets every control and emits an empty filter. */
  clearFilters(): void {
    this.actorInput = '';
    this.createdAfter = null;
    this.createdBefore = null;
    this.httpMethod = null;
    this.pathPrefix = '';
    this.fieldPath = '';
    this.changeType = null;
    this.objectType = null;
    this.threatModelId = '';
    this.filterChange.emit({});
  }

  /** Emits the CSV export request. */
  onExportCsv(): void {
    this.exportRequested.emit('csv');
  }

  /** Emits the NDJSON export request. */
  onExportNdjson(): void {
    this.exportRequested.emit('ndjson');
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Populates controls from `initialFilter` so query-param restoration works upstream. */
  private _initFromFilter(): void {
    const f = this.initialFilter as SystemAuditFilter & TmAuditFilter;
    this.actorInput = f.actor_email ?? '';
    this.createdAfter = f.created_after ?? null;
    this.createdBefore = f.created_before ?? null;

    if (this.stream === 'system') {
      const sf = f as SystemAuditFilter;
      this.httpMethod = sf.http_method ?? null;
      this.pathPrefix = sf.path_prefix ?? '';
      this.fieldPath = sf.field_path ?? '';
    } else {
      const tf = f as TmAuditFilter;
      this.changeType = tf.change_type ?? null;
      this.objectType = tf.object_type ?? null;
      this.threatModelId = tf.threat_model_id ?? '';
    }
  }

  /** Sets up debounced subjects for text inputs; each debounce calls `_emit()`. */
  private _wireTextDebounce(): void {
    this.actorSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._emit());

    this.pathPrefixSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._emit());

    this.fieldPathSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._emit());

    this.threatModelIdSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._emit());
  }

  /** Wires the actor autocomplete search against UserAdminService. */
  private _wireActorAutocomplete(): void {
    this.actorSuggestions$ = this.actorSubject$.pipe(
      debounceTime(300),
      switchMap(term =>
        term.length >= ACTOR_MIN_LENGTH
          ? this.userAdminService
              .list({ email: term, limit: 10 })
              .pipe(switchMap(response => of(response.users)))
          : of([]),
      ),
    );
  }

  /**
   * Builds and emits the current filter, omitting any undefined/null/'' keys
   * so that blank fields don't pollute query params.
   */
  private _emit(): void {
    const raw: Record<string, string | undefined | null> = {
      actor_email: this.actorInput || undefined,
      created_after: this.createdAfter || undefined,
      created_before: this.createdBefore || undefined,
    };

    if (this.stream === 'system') {
      raw['http_method'] = this.httpMethod ?? undefined;
      raw['path_prefix'] = this.pathPrefix || undefined;
      raw['field_path'] = this.fieldPath || undefined;
    } else {
      raw['change_type'] = this.changeType ?? undefined;
      raw['object_type'] = this.objectType ?? undefined;
      raw['threat_model_id'] = this.threatModelId || undefined;
    }

    const filter = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as AuditFilter;

    this.filterChange.emit(filter);
  }
}
