import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';

/**
 * Component to display an OAuth provider with its logo and capitalized name
 * Format: <logo> ProviderName
 *
 * Can be used in two ways:
 * 1. Pass provider ID string (uses hardcoded fallback icons)
 * 2. Pass full providerInfo object (uses icon from API)
 */
@Component({
  selector: 'app-provider-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './provider-display.component.html',
  styleUrl: './provider-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDisplayComponent {
  /**
   * Provider identifier (e.g., "google", "github", "microsoft")
   * Used for backward compatibility when full provider info is not available
   */
  @Input() provider = '';

  /**
   * Full provider info from API (includes icon URL)
   * When provided, takes precedence over provider string
   */
  @Input() providerInfo: OAuthProviderInfo | null = null;

  /**
   * Get the logo path for the provider
   * Uses icon from providerInfo if available, otherwise falls back to hardcoded mapping
   */
  getProviderLogoPath(): string | null {
    // Use icon from API if available
    if (this.providerInfo?.icon) {
      // If icon starts with 'fa-', it's a FontAwesome icon (not implemented in this component yet)
      if (this.providerInfo.icon.startsWith('fa-')) {
        return null; // FontAwesome icons not yet supported in this component
      }
      // Return the icon URL from API (may be absolute or relative)
      return this.providerInfo.icon;
    }

    // Fall back to hardcoded mapping based on provider ID
    const providerId = this.providerInfo?.id || this.provider;
    const logoMap: Record<string, string> = {
      google: 'assets/signin-logos/google-signin-logo.svg',
      github: 'assets/signin-logos/github-signin-logo.svg',
      microsoft: 'assets/signin-logos/microsoft-signin-logo.svg',
      gitlab: 'assets/signin-logos/gitlab-signin-logo.svg',
      bitbucket: 'assets/signin-logos/bitbucket-signin-logo.svg',
      apple: 'assets/signin-logos/apple-signin-logo.svg',
      test: 'TMI-Logo.svg',
    };
    return logoMap[providerId.toLowerCase()] || null;
  }

  /**
   * Get the properly capitalized provider name
   * Uses name from providerInfo if available, otherwise capitalizes provider ID
   */
  getProviderName(): string {
    // Use name from API if available
    if (this.providerInfo?.name) {
      return this.providerInfo.name;
    }

    // Fall back to capitalizing the provider ID
    const providerId = this.providerInfo?.id || this.provider;
    const provider = providerId.toLowerCase();

    // Special cases with specific capitalization
    const specialCases: Record<string, string> = {
      github: 'GitHub',
      gitlab: 'GitLab',
      google: 'Google',
      microsoft: 'Microsoft',
      bitbucket: 'Bitbucket',
      apple: 'Apple',
      test: 'TMI Test',
    };

    // Return special case if exists, otherwise capitalize first letter
    if (specialCases[provider]) {
      return specialCases[provider];
    }

    // Default: capitalize first letter
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
