/**
 * Icon Picker Panel Component
 *
 * A draggable floating panel for browsing and assigning architecture icons
 * to eligible DFD shapes. Provides search, icon preview, placement grid,
 * and grouped result display.
 *
 * Eligible shapes: actor, process, store, security-boundary.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TooltipAriaLabelDirective } from '@app/shared/imports';

import { TranslocoModule } from '@jsverse/transloco';

import { ArchitectureIconService } from '../../../infrastructure/services/architecture-icon.service';
import {
  ArchIconData,
  ArchIconManifestEntry,
  ArchIconSearchResult,
  DEFAULT_ARCH_ICON_PLACEMENT,
  ICON_ELIGIBLE_SHAPES,
} from '../../../types/arch-icon.types';
import {
  ICON_VERTICAL_POSITIONS,
  ICON_HORIZONTAL_POSITIONS,
  IconVerticalPosition,
  IconHorizontalPosition,
  getIconPlacementKey,
} from '../../../types/icon-placement.types';

/** Info about a selected cell relevant to icon picking */
export interface IconPickerCellInfo {
  cellId: string;
  nodeType: string | null;
  arch: ArchIconData | null;
}

/** Emitted when user selects an icon from the search results */
export interface IconSelectedEvent {
  arch: ArchIconData;
  cellIds: string[];
}

/** Emitted when user removes the current icon */
export interface IconRemovedEvent {
  cellIds: string[];
}

/** Emitted when user changes the icon placement */
export interface PlacementChangedEvent {
  placement: { vertical: string; horizontal: string };
  cellIds: string[];
}

@Component({
  selector: 'app-icon-picker-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatInputModule,
    MatFormFieldModule,
    TooltipAriaLabelDirective,
    TranslocoModule,
  ],
  templateUrl: './icon-picker-panel.component.html',
  styleUrl: './icon-picker-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@1610b9703ddd3bb3b78930cce96873386708c765: panel for searching and selecting architecture icons for diagram cells
export class IconPickerPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedCells: IconPickerCellInfo[] = [];
  @Input() disabled = false;

  @Output() iconSelected = new EventEmitter<IconSelectedEvent>();
  @Output() iconRemoved = new EventEmitter<IconRemovedEvent>();
  @Output() placementChanged = new EventEmitter<PlacementChangedEvent>();

  /** Search query bound to the input field */
  searchQuery = '';

  /** Search results grouped by subcategory */
  searchResults: ArchIconSearchResult[] = [];

  /** Total match count across all groups */
  matchCount = 0;

  /** Total icons available (manifest size) */
  totalIcons = 0;

  /** Tracks which subcategory groups are collapsed */
  collapsedGroups = new Set<string>();

  /** Vertical position values for placement grid */
  readonly verticalPositions = ICON_VERTICAL_POSITIONS;
  /** Horizontal position values for placement grid */
  readonly horizontalPositions = ICON_HORIZONTAL_POSITIONS;

  private readonly searchSubject$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: inject ChangeDetectorRef and icon service dependencies (pure)
  constructor(
    private cdr: ChangeDetectorRef,
    private iconService: ArchitectureIconService,
  ) {}

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: load icon manifest and wire debounced search on initialization (mutates shared state)
  ngOnInit(): void {
    void this.iconService.loadManifest().then(() => {
      this.cdr.markForCheck();
    });

    this.searchSubject$.pipe(debounceTime(150), takeUntil(this.destroy$)).subscribe(query => {
      this.performSearch(query);
    });
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: mark component for check when selected cells input changes (mutates shared state)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCells']) {
      this.cdr.markForCheck();
    }
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: complete the destroy subject to unsubscribe all subscriptions
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Computed state ---

  get noSelection(): boolean {
    return this.selectedCells.length === 0;
  }

  /** Cells whose nodeType is in ICON_ELIGIBLE_SHAPES */
  get eligibleCells(): IconPickerCellInfo[] {
    return this.selectedCells.filter(
      c => c.nodeType && (ICON_ELIGIBLE_SHAPES as readonly string[]).includes(c.nodeType),
    );
  }

  get hasEligibleCells(): boolean {
    return this.eligibleCells.length > 0;
  }

  /** True when selection exists but none are eligible (text-box, edge, etc.) */
  get selectionNotEligible(): boolean {
    return !this.noSelection && !this.hasEligibleCells;
  }

  /** The arch data from the first eligible cell that has one, if any */
  get currentArch(): ArchIconData | null {
    const withArch = this.eligibleCells.find(c => c.arch !== null);
    return withArch?.arch ?? null;
  }

  get currentIconPath(): string {
    const arch = this.currentArch;
    return arch ? this.iconService.getIconPath(arch) : '';
  }

  get currentIconLabel(): string {
    const arch = this.currentArch;
    return arch ? this.iconService.getIconLabel(arch) : '';
  }

  get currentIconBreadcrumb(): string {
    const arch = this.currentArch;
    return arch ? this.iconService.getIconBreadcrumb(arch) : '';
  }

  get selectedCount(): number {
    return this.eligibleCells.length;
  }

  // --- Search ---

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: dispatch a debounced icon search query from user input (mutates shared state)
  onSearchInput(query: string): void {
    this.searchQuery = query;
    this.searchSubject$.next(query);
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: search the icon manifest and update grouped results and match count (mutates shared state)
  private performSearch(query: string): void {
    this.searchResults = this.iconService.search(query);
    this.matchCount = this.searchResults.reduce((sum, g) => sum + g.icons.length, 0);
    this.cdr.markForCheck();
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: resolve the asset path for an icon manifest entry (pure)
  getIconPathFromEntry(entry: ArchIconManifestEntry): string {
    return this.iconService.getIconPathFromEntry(entry);
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: compute a unique key for an icon search result group (pure)
  getGroupKey(group: ArchIconSearchResult): string {
    return `${group.provider}·${group.subcategory}`;
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: return whether an icon search result group is currently collapsed (pure)
  isGroupCollapsed(group: ArchIconSearchResult): boolean {
    return this.collapsedGroups.has(this.getGroupKey(group));
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: toggle the collapsed state of an icon search result group (mutates shared state)
  toggleGroup(group: ArchIconSearchResult): void {
    const key = this.getGroupKey(group);
    if (this.collapsedGroups.has(key)) {
      this.collapsedGroups.delete(key);
    } else {
      this.collapsedGroups.add(key);
    }
  }

  // --- Actions ---

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: emit icon selection event for eligible cells when an icon is clicked
  onIconClick(entry: ArchIconManifestEntry): void {
    if (this.disabled || !this.hasEligibleCells) return;

    const arch: ArchIconData = {
      provider: entry.provider as ArchIconData['provider'],
      type: entry.type as ArchIconData['type'],
      subcategory: entry.subcategory,
      icon: entry.icon,
      placement: this.currentArch?.placement ?? { ...DEFAULT_ARCH_ICON_PLACEMENT },
    };

    this.iconSelected.emit({
      arch,
      cellIds: this.eligibleCells.map(c => c.cellId),
    });
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: emit icon removal event for all eligible selected cells
  onRemoveIcon(): void {
    if (this.disabled || !this.hasEligibleCells) return;

    this.iconRemoved.emit({
      cellIds: this.eligibleCells.map(c => c.cellId),
    });
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: emit icon placement change for eligible cells (mutates shared state)
  onPlacementSelected(vertical: IconVerticalPosition, horizontal: IconHorizontalPosition): void {
    if (this.disabled || !this.hasEligibleCells || !this.currentArch) return;

    this.placementChanged.emit({
      placement: { vertical, horizontal },
      cellIds: this.eligibleCells.map(c => c.cellId),
    });
  }

  // SEM@1610b9703ddd3bb3b78930cce96873386708c765: check whether a placement matches the current icon arch position (pure)
  isActivePlacement(vertical: IconVerticalPosition, horizontal: IconHorizontalPosition): boolean {
    const arch = this.currentArch;
    if (!arch) return false;
    return arch.placement.vertical === vertical && arch.placement.horizontal === horizontal;
  }

  /** Current placement key for display purposes */
  get currentPlacementKey(): string {
    const arch = this.currentArch;
    if (!arch) return '';
    return getIconPlacementKey(arch.placement);
  }
}
