import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

/**
 * Audit Logs Page Component
 *
 * Shell component for the audit log feature. Renders a tab nav bar with
 * links to the system-audit and threat-model-audit views, with a router
 * outlet below for rendering the active tab content.
 */
@Component({
  selector: 'app-audit-logs-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    MatTabsModule,
    TranslocoModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './audit-logs-page.component.html',
  styleUrl: './audit-logs-page.component.scss',
})
// SEM@ad7267a2dd7fbf341955a732f42557d735bad83b: shell page component rendering audit log tab nav and router outlet
export class AuditLogsPageComponent {}
