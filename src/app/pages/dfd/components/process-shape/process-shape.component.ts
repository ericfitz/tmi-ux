import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Angular component for Process shape in DFD diagrams
 */
@Component({
  selector: 'app-process-shape',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="process-shape">
      <svg width="100%" height="100%">
        <circle
          cx="50%"
          cy="50%"
          [attr.r]="radius"
          [attr.fill]="fill"
          [attr.stroke]="stroke"
          [attr.stroke-width]="strokeWidth"
        ></circle>
        <text
          x="50%"
          y="50%"
          text-anchor="middle"
          dominant-baseline="middle"
          [attr.fill]="textColor"
          [attr.font-size]="fontSize"
          [attr.font-family]="fontFamily"
        >
          {{ label }}
        </text>
      </svg>
    </div>
  `,
  styles: [
    `
      .process-shape {
        width: 100%;
        height: 100%;
        position: relative;
        aspect-ratio: 1 / 1;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessShapeComponent implements OnChanges {
  @Input() label = 'Process';
  @Input() fill = '#FFFFFF';
  @Input() stroke = '#333333';
  @Input() strokeWidth = 2;
  @Input() textColor = '#333333';
  @Input() fontSize = 12;
  @Input() fontFamily = '"Roboto Condensed", Arial, sans-serif';
  @Input() embedded = false;

  // Calculate radius based on the component's size
  get radius(): string {
    return '40%'; // Using percentage to ensure it scales properly
  }

  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in inputs
    if (changes['embedded'] && this.embedded) {
      this.fill = '#e6f7ff'; // Change fill color when embedded
    } else if (changes['embedded'] && !this.embedded) {
      this.fill = '#FFFFFF'; // Restore original fill color
    }
  }
}
