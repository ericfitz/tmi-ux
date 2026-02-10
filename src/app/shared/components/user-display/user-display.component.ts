import { Component, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@app/auth/services/auth.service';
import { BrandingConfigService } from '@app/core/services/branding-config.service';

/**
 * Flexible input type compatible with Principal, UserProfile, and AdminUser
 */
export interface UserDisplayInput {
  display_name?: string;
  name?: string;
  email?: string;
  provider?: string;
  provider_id?: string;
}

/**
 * Displays a user name as plain text or as a hyperlink to a corporate directory.
 *
 * Hyperlinks are rendered only when all conditions are met:
 * 1. user_hyperlink_template is configured on the server
 * 2. user_hyperlink_provider is configured on the server
 * 3. The signed-in user's auth provider matches user_hyperlink_provider
 * 4. The target user's auth provider matches user_hyperlink_provider
 * 5. The target user has an email address for template substitution
 */
@Component({
  selector: 'app-user-display',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    @if (hyperlinkUrl) {
      <a
        [href]="hyperlinkUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="user-link"
        [matTooltip]="tooltipText"
        >{{ displayText }}</a
      >
    } @else {
      <span [matTooltip]="tooltipText">{{ displayText }}</span>
    }
  `,
  styles: `
    :host {
      display: inline;
    }
    .user-link {
      color: inherit;
      text-decoration: underline;
      text-decoration-style: dotted;
    }
    .user-link:hover {
      text-decoration-style: solid;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDisplayComponent implements OnChanges {
  @Input() user: UserDisplayInput | null = null;
  @Input() fallback = '';
  @Input() showEmailTooltip = true;

  displayText = '';
  tooltipText = '';
  hyperlinkUrl: string | null = null;

  constructor(
    private brandingConfig: BrandingConfigService,
    private authService: AuthService,
  ) {}

  ngOnChanges(): void {
    this.displayText = this.computeDisplayText();
    this.tooltipText = this.computeTooltipText();
    this.hyperlinkUrl = this.computeHyperlinkUrl();
  }

  private computeDisplayText(): string {
    if (!this.user) {
      return this.fallback;
    }
    return this.user.display_name || this.user.name || this.user.email || this.fallback;
  }

  private computeTooltipText(): string {
    if (!this.showEmailTooltip || !this.user?.email) {
      return '';
    }
    return this.user.email;
  }

  private computeHyperlinkUrl(): string | null {
    const template = this.brandingConfig.userHyperlinkTemplate;
    const requiredProvider = this.brandingConfig.userHyperlinkProvider;

    if (!template || !requiredProvider) {
      return null;
    }

    if (!this.user?.provider || !this.user?.email) {
      return null;
    }

    // Signed-in user must be from the configured provider
    const signedInProfile = this.authService.userProfile;
    if (!signedInProfile || signedInProfile.provider !== requiredProvider) {
      return null;
    }

    // Target user must be from the configured provider
    if (this.user.provider !== requiredProvider) {
      return null;
    }

    // Build URL from template
    const url = template
      .replace('{{user.email}}', encodeURIComponent(this.user.email))
      .replace('{{user.name}}', encodeURIComponent(this.user.display_name || this.user.name || ''));

    // Security: reject non-HTTP URLs
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return null;
    }

    return url;
  }
}
