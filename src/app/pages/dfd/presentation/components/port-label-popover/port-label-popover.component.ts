/**
 * Port Label Popover Component
 *
 * A floating popover for editing port label text and position.
 * Appears near the clicked port and provides:
 * - Text input for the port label
 * - Radio button group for label position (outside, inside, top, bottom, left, right)
 *   arranged visually with a compass-like layout for directional options.
 *
 * The popover closes on Escape, click-outside, or the close button.
 */

import {
  Component,
  ChangeDetectionStrategy,
  EventEmitter,
  Input,
  Output,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';

/** Port label position options supported by X6 */
// SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: union type of valid port label positions relative to a port (pure)
export type PortLabelPosition = 'outside' | 'inside' | 'top' | 'bottom' | 'left' | 'right';

export const DEFAULT_PORT_LABEL_POSITION: PortLabelPosition = 'outside';

/** Data representing the current state of a port label */
export interface PortLabelData {
  nodeId: string;
  portId: string;
  text: string;
  position: PortLabelPosition;
}

/** Emitted when the user changes port label properties */
export interface PortLabelChangeEvent {
  nodeId: string;
  portId: string;
  text: string;
  position: PortLabelPosition;
}

@Component({
  selector: 'app-port-label-popover',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TooltipAriaLabelDirective,
    MatRadioModule,
    MatInputModule,
    MatFormFieldModule,
    TranslocoModule,
  ],
  templateUrl: './port-label-popover.component.html',
  styleUrl: './port-label-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: popover for editing port label text and position on a diagram node
export class PortLabelPopoverComponent implements OnInit, OnDestroy {
  @Input() portLabel: PortLabelData = {
    nodeId: '',
    portId: '',
    text: '',
    position: DEFAULT_PORT_LABEL_POSITION,
  };

  /** Screen coordinates for positioning the popover */
  @Input() positionX = 0;
  @Input() positionY = 0;

  @Output() labelChanged = new EventEmitter<PortLabelChangeEvent>();
  @Output() closed = new EventEmitter<void>();

  labelText = '';
  labelPosition: PortLabelPosition = DEFAULT_PORT_LABEL_POSITION;

  private _onClickOutside = (event: MouseEvent): void => {
    if (!this._elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  };

  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.close();
    }
  };

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: inject element reference for click-outside detection (pure)
  constructor(private _elementRef: ElementRef) {}

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: initialize label state and register global click and keyboard listeners (mutates shared state)
  ngOnInit(): void {
    this.labelText = this.portLabel.text;
    this.labelPosition = this.portLabel.position;

    // Delay attaching listeners to avoid the opening click from immediately closing
    setTimeout(() => {
      document.addEventListener('mousedown', this._onClickOutside);
      document.addEventListener('keydown', this._onKeydown);
    });
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: remove global click and keyboard listeners on component teardown (mutates shared state)
  ngOnDestroy(): void {
    document.removeEventListener('mousedown', this._onClickOutside);
    document.removeEventListener('keydown', this._onKeydown);
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: update label text and emit change event (mutates shared state)
  onTextChange(value: string): void {
    this.labelText = value;
    this.emitChange();
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: update label position and emit change event (mutates shared state)
  onPositionChange(position: PortLabelPosition): void {
    this.labelPosition = position;
    this.emitChange();
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: emit closed event to dismiss the port label popover (mutates shared state)
  close(): void {
    this.closed.emit();
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: emit port label change event with current text and position (mutates shared state)
  private emitChange(): void {
    this.labelChanged.emit({
      nodeId: this.portLabel.nodeId,
      portId: this.portLabel.portId,
      text: this.labelText,
      position: this.labelPosition,
    });
  }
}
