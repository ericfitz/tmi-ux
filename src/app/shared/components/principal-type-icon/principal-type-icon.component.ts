import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PrincipalType } from '@app/pages/tm/models/threat-model.model';

/**
 * Component to display a Material icon for principal type (user or group)
 * - Users: 'person' icon
 * - Groups: 'group' icon
 */
@Component({
  selector: 'app-principal-type-icon',
  standalone: true,
  imports: [MatIconModule],
  template: '<mat-icon>{{ getIconName() }}</mat-icon>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrincipalTypeIconComponent {
  /**
   * Principal type ('user' or 'group')
   */
  @Input() principalType: PrincipalType = 'user';

  /**
   * Get the Material icon name for the principal type
   */
  getIconName(): string {
    return this.principalType === 'group' ? 'group' : 'person';
  }
}
