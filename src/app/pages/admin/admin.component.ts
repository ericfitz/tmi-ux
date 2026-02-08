import { Component } from '@angular/core';
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
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}
  adminSections = [
    {
      title: 'admin.sections.administrators.title',
      description: 'admin.sections.administrators.description',
      icon: 'supervisor_account',
      action: 'administrators',
    },
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
      title: 'admin.sections.surveys.title',
      description: 'admin.sections.surveys.description',
      icon: 'assignment',
      action: 'surveys',
    },
  ];

  onSectionClick(action: string): void {
    void this.router.navigate(['/admin', action]);
  }

  onClose(): void {
    void this.router.navigate([this.authService.getLandingPage()]);
  }
}
