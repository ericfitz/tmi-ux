import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { EditorState } from '../../services/state/editor-state.enum';

@Component({
  selector: 'app-state-indicator',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="state-indicator" *ngIf="visible">
      <div class="state-badge" [ngClass]="stateClass">
        {{ localizedStateText }}
      </div>
    </div>
  `,
  styles: [
    `
      .state-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
      }

      .state-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        text-transform: uppercase;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .state-loading {
        background-color: #2196f3;
        animation: pulse 1.5s infinite;
      }

      .state-ready {
        background-color: #4caf50;
      }

      .state-working {
        background-color: #ff9800;
      }

      .state-error {
        background-color: #f44336;
        animation: pulse 0.5s infinite;
      }

      .state-recovering {
        background-color: #9c27b0;
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
        100% {
          opacity: 1;
        }
      }
    `,
  ],
})
export class StateIndicatorComponent implements OnInit {
  @Input() state: EditorState = EditorState.UNINITIALIZED;
  @Input() visible = true;

  stateClass = '';
  localizedStateText = '';

  constructor(private translocoService: TranslocoService) {}

  ngOnInit(): void {
    this.updateStateClass();
  }

  ngOnChanges(): void {
    this.updateStateClass();
  }

  /**
   * Update the state class for styling the state indicator
   */
  private updateStateClass(): void {
    // Update CSS class for styling
    switch (this.state) {
      case EditorState.UNINITIALIZED:
      case EditorState.INITIALIZING:
      case EditorState.LOADING:
      case EditorState.STABILIZING:
        this.stateClass = 'state-loading';
        break;
      case EditorState.READY:
        this.stateClass = 'state-ready';
        break;
      case EditorState.EDITING_LABEL:
      case EditorState.CREATING_EDGE:
      case EditorState.DELETING:
      case EditorState.SAVING:
        this.stateClass = 'state-working';
        break;
      case EditorState.ERROR:
        this.stateClass = 'state-error';
        break;
      case EditorState.RECOVERING:
        this.stateClass = 'state-recovering';
        break;
      default:
        this.stateClass = '';
    }

    // Update localized state text
    this.updateLocalizedStateText();
  }

  /**
   * Update the localized state text based on the current state
   */
  private updateLocalizedStateText(): void {
    const translationKey = `editor.states.${this.state}`;
    this.localizedStateText = this.translocoService.translate(translationKey);
  }
}
