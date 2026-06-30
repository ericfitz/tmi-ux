import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { AuthService } from '../../auth/services/auth.service';

/**
 * Administration Page Component
 *
 * Main administration dashboard for system administrators.
 * Provides access to admin-only features and management interfaces.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin.component.scss',
})
// SEM@ad7267a2dd7fbf341955a732f42557d735bad83b: root admin landing page listing all administrative sections for navigation
export class AdminComponent {
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: inject router and auth service dependencies (pure)
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}
  adminSections = [
    {
      title: 'admin.sections.users.title',
      description: 'admin.sections.users.description',
      icon: 'person',
      action: 'users',
    },
    {
      title: 'admin.sections.groups.title',
      description: 'admin.sections.groups.description',
      icon: 'group',
      action: 'groups',
    },
    {
      title: 'admin.sections.teams.title',
      description: 'admin.sections.teams.description',
      icon: 'groups',
      action: 'teams',
    },
    {
      title: 'admin.sections.projects.title',
      description: 'admin.sections.projects.description',
      icon: 'folder',
      action: 'projects',
    },
    {
      title: 'admin.sections.quotas.title',
      description: 'admin.sections.quotas.description',
      icon: 'speed',
      action: 'quotas',
    },
    {
      title: 'admin.sections.webhooks.title',
      description: 'admin.sections.webhooks.description',
      icon: 'webhook',
      action: 'webhooks',
    },
    {
      title: 'admin.sections.addons.title',
      description: 'admin.sections.addons.description',
      icon: 'extension',
      action: 'addons',
    },
    {
      title: 'admin.sections.settings.title',
      description: 'admin.sections.settings.description',
      icon: 'settings',
      action: 'settings',
    },
    {
      title: 'admin.sections.surveys.title',
      description: 'admin.sections.surveys.description',
      icon: 'assignment',
      action: 'surveys',
    },
    {
      title: 'admin.sections.audit.title',
      description: 'admin.sections.audit.description',
      icon: 'history',
      action: 'audit',
    },
  ];

  // SEM@36c98b471f199ad07ab7f890bf1fd25427d95e56: navigate to the selected admin section route (pure)
  onSectionClick(action: string): void {
    void this.router.navigate(['/admin', action]);
  }

  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: navigate to the authenticated user's landing page (pure)
  onClose(): void {
    void this.router.navigate([this.authService.getLandingPage()]);
  }
}
