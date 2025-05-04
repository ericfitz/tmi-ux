import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Angular component for Security Boundary shape in DFD diagrams
 */
@Component({
  selector: 'app-security-boundary-shape',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="security-boundary-shape">
      <svg width="100%" height="100%">
        <!-- Main rectangle with dashed stroke -->
        <rect
          width="100%"
          height="100%"
          [attr.fill]="fill"
          [attr.fill-opacity]="fillOpacity"
          [attr.stroke]="stroke"
          [attr.stroke-width]="strokeWidth"
          [attr.stroke-dasharray]="strokeDasharray"
          rx="4"
          ry="4"
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
      .security-boundary-shape {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityBoundaryShapeComponent implements OnChanges {
  @Input() label = 'Security Boundary';
  @Input() fill = '#47C769';
  @Input() fillOpacity = 0.2;
  @Input() stroke = '#333333';
  @Input() strokeWidth = 2;
  @Input() strokeDasharray = '5,5';
  @Input() textColor = '#333333';
  @Input() fontSize = 12;
  @Input() fontFamily = '"Roboto Condensed", Arial, sans-serif';
  @Input() embedded = false;
  @Input() parent = true;

  ngOnChanges(changes: SimpleChanges): void {
    // Security boundary typically doesn't change appearance when embedded
    // since it's usually the parent, but we'll include the logic for consistency
    if (changes['embedded'] && this.embedded) {
      this.fill = '#e6f7ff';
    } else if (changes['embedded'] && !this.embedded) {
      this.fill = '#47C769';
    }
  }
}
