/**
 * Style Panel Component
 *
 * A draggable floating panel for editing visual properties of selected DFD cells.
 * Two tabs: Stroke (color) and Fill (color + opacity).
 * Changes are applied immediately to all applicable selected objects and are undo-able.
 *
 * The panel reacts to selection changes:
 * - Nothing selected: all controls disabled
 * - Single selection: shows current values
 * - Multi-selection, same values: shows shared values
 * - Multi-selection, different values: indeterminate state
 * - Mixed types: controls apply to applicable types only
 */

import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSliderModule } from '@angular/material/slider';

import { TranslocoModule } from '@jsverse/transloco';

import { ColorPickerComponent } from '../../../../../shared/components/color-picker/color-picker.component';
import { ColorPaletteEntry } from '../../../types/color-palette.types';
import {
  LabelPosition,
  LabelVerticalPosition,
  LabelHorizontalPosition,
  VERTICAL_POSITIONS,
  HORIZONTAL_POSITIONS,
  getLabelPositionKey,
} from '../../../types/label-position.types';

/** Represents the style properties readable from selected cells */
export interface CellStyleInfo {
  cellId: string;
  isNode: boolean;
  isEdge: boolean;
  nodeType: string | null;
  strokeColor: string | null;
  fillColor: string | null;
  fillOpacity: number | null;
  hasCustomStyles: boolean;
  labelPosition: LabelPosition | null;
}

/** Emitted when the user changes a style property */
export interface StyleChangeEvent {
  property: 'strokeColor' | 'fillColor' | 'fillOpacity' | 'labelPosition';
  value: string | number;
  /** Cell IDs this change applies to */
  applicableCellIds: string[];
}

@Component({
  selector: 'app-style-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule,
    MatSliderModule,
    TranslocoModule,
    ColorPickerComponent,
  ],
  templateUrl: './style-panel.component.html',
  styleUrl: './style-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StylePanelComponent implements OnChanges {
  @Input() selectedCells: CellStyleInfo[] = [];
  @Input() diagramPalette: ColorPaletteEntry[] = [];
  @Input() disabled = false;

  @Output() styleChange = new EventEmitter<StyleChangeEvent>();
  @Output() clearCustomFormatting = new EventEmitter<string[]>();
  @Output() diagramPaletteChanged = new EventEmitter<ColorPaletteEntry[]>();

  /** Current stroke color shown in the picker (null = indeterminate) */
  currentStrokeColor: string | null = null;
  /** Current fill color shown in the picker (null = indeterminate) */
  currentFillColor: string | null = null;
  /** Current fill opacity (null = indeterminate) */
  currentFillOpacity: number | null = null;

  /** Whether stroke tab controls should be enabled */
  strokeEnabled = false;
  /** Whether fill tab controls should be enabled */
  fillEnabled = false;
  /** Whether any selected cell has custom styles */
  hasAnyCustomStyles = false;

  /** Current label position (null = indeterminate) */
  currentLabelPosition: LabelPosition | null = null;
  /** Whether label position controls should be enabled */
  labelPositionEnabled = false;

  /** Vertical position values for template iteration */
  readonly verticalPositions = VERTICAL_POSITIONS;
  /** Horizontal position values for template iteration */
  readonly horizontalPositions = HORIZONTAL_POSITIONS;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCells']) {
      this.updateDisplayedValues();
    }
  }

  get noSelection(): boolean {
    return this.selectedCells.length === 0;
  }

  /** Cells that support stroke color changes (nodes except text-box, plus edges) */
  private get strokeApplicableCells(): CellStyleInfo[] {
    return this.selectedCells.filter(c => {
      if (c.isEdge) return true;
      if (c.isNode && c.nodeType !== 'text-box') return true;
      return false;
    });
  }

  /** Cells that support fill changes (all nodes including text-box, not edges) */
  private get fillApplicableCells(): CellStyleInfo[] {
    return this.selectedCells.filter(c => c.isNode);
  }

  /** Cells that support label position changes (nodes except text-box) */
  private get labelApplicableCells(): CellStyleInfo[] {
    return this.selectedCells.filter(c => c.isNode && c.nodeType !== 'text-box');
  }

  private updateDisplayedValues(): void {
    const strokeCells = this.strokeApplicableCells;
    const fillCells = this.fillApplicableCells;
    const labelCells = this.labelApplicableCells;

    this.strokeEnabled = strokeCells.length > 0;
    this.fillEnabled = fillCells.length > 0;
    this.labelPositionEnabled = labelCells.length > 0;
    this.hasAnyCustomStyles = this.selectedCells.some(c => c.hasCustomStyles);

    // Determine current stroke color
    if (strokeCells.length === 0) {
      this.currentStrokeColor = null;
    } else {
      const colors = strokeCells.map(c => c.strokeColor);
      this.currentStrokeColor = colors.every(c => c === colors[0]) ? colors[0] : null;
    }

    // Determine current fill color
    if (fillCells.length === 0) {
      this.currentFillColor = null;
    } else {
      const colors = fillCells.map(c => c.fillColor);
      this.currentFillColor = colors.every(c => c === colors[0]) ? colors[0] : null;
    }

    // Determine current fill opacity
    if (fillCells.length === 0) {
      this.currentFillOpacity = null;
    } else {
      const opacities = fillCells.map(c => c.fillOpacity);
      this.currentFillOpacity = opacities.every(o => o === opacities[0]) ? opacities[0] : null;
    }

    // Determine current label position
    if (labelCells.length === 0) {
      this.currentLabelPosition = null;
    } else {
      const positions = labelCells.map(c => c.labelPosition);
      const firstKey = positions[0] ? getLabelPositionKey(positions[0]) : null;
      const allSame = positions.every(p =>
        p && firstKey ? getLabelPositionKey(p) === firstKey : p === positions[0],
      );
      this.currentLabelPosition = allSame ? positions[0] : null;
    }

    this.cdr.markForCheck();
  }

  onStrokeColorSelected(color: string): void {
    if (this.disabled || !this.strokeEnabled) return;
    const applicableIds = this.strokeApplicableCells.map(c => c.cellId);
    this.currentStrokeColor = color;
    this.styleChange.emit({
      property: 'strokeColor',
      value: color,
      applicableCellIds: applicableIds,
    });
  }

  onFillColorSelected(color: string): void {
    if (this.disabled || !this.fillEnabled) return;
    const applicableIds = this.fillApplicableCells.map(c => c.cellId);
    this.currentFillColor = color;
    this.styleChange.emit({
      property: 'fillColor',
      value: color,
      applicableCellIds: applicableIds,
    });
  }

  onOpacityChange(value: number): void {
    if (this.disabled || !this.fillEnabled) return;
    const applicableIds = this.fillApplicableCells.map(c => c.cellId);
    this.currentFillOpacity = value;
    this.styleChange.emit({
      property: 'fillOpacity',
      value: value / 100, // Convert percentage to 0-1 range
      applicableCellIds: applicableIds,
    });
  }

  onLabelPositionSelected(
    vertical: LabelVerticalPosition,
    horizontal: LabelHorizontalPosition,
  ): void {
    if (this.disabled || !this.labelPositionEnabled) return;
    const position: LabelPosition = { vertical, horizontal };
    const applicableIds = this.labelApplicableCells.map(c => c.cellId);
    this.currentLabelPosition = position;
    this.styleChange.emit({
      property: 'labelPosition',
      value: getLabelPositionKey(position),
      applicableCellIds: applicableIds,
    });
  }

  isActivePosition(vertical: LabelVerticalPosition, horizontal: LabelHorizontalPosition): boolean {
    if (!this.currentLabelPosition) return false;
    return (
      this.currentLabelPosition.vertical === vertical &&
      this.currentLabelPosition.horizontal === horizontal
    );
  }

  onClearCustomFormatting(): void {
    if (this.disabled || this.noSelection) return;
    const allIds = this.selectedCells.map(c => c.cellId);
    this.clearCustomFormatting.emit(allIds);
  }

  onDiagramPaletteChanged(palette: ColorPaletteEntry[]): void {
    this.diagramPaletteChanged.emit(palette);
  }

  get opacityDisplayValue(): number {
    return this.currentFillOpacity !== null ? Math.round(this.currentFillOpacity * 100) : 100;
  }
}
