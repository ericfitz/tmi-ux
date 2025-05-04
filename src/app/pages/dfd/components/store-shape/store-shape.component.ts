import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Angular component for Store shape in DFD diagrams
 */
@Component({
  selector: 'app-store-shape',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="store-shape">
      <svg width="100%" height="100%">
        <!-- Main rectangle -->
        <rect
          width="100%"
          height="100%"
          [attr.fill]="fill"
          [attr.stroke]="stroke"
          [attr.stroke-width]="strokeWidth"
        ></rect>

        <!-- Left vertical line to create data store appearance -->
        <line
          x1="15%"
          y1="0"
          x2="15%"
          y2="100%"
          [attr.stroke]="stroke"
          [attr.stroke-width]="strokeWidth"
        ></line>

        <text
          x="57.5%"
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
      .store-shape {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreShapeComponent implements OnChanges {
  @Input() label = 'Store';
  @Input() fill = '#FFFFFF';
  @Input() stroke = '#333333';
  @Input() strokeWidth = 2;
  @Input() textColor = '#333333';
  @Input() fontSize = 12;
  @Input() fontFamily = '"Roboto Condensed", Arial, sans-serif';
  @Input() embedded = false;

  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in inputs
    if (changes['embedded'] && this.embedded) {
      this.fill = '#e6f7ff'; // Change fill color when embedded
    } else if (changes['embedded'] && !this.embedded) {
      this.fill = '#FFFFFF'; // Restore original fill color
    }
  }
}
