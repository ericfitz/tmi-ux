import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Angular component for Actor shape in DFD diagrams
 */
@Component({
  selector: 'app-actor-shape',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="actor-shape">
      <svg width="100%" height="100%">
        <rect
          width="100%"
          height="100%"
          [attr.fill]="fill"
          [attr.stroke]="stroke"
          [attr.stroke-width]="strokeWidth"
          rx="2"
          ry="2"
        ></rect>
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
      .actor-shape {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActorShapeComponent implements OnChanges {
  @Input() label = 'Actor';
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
