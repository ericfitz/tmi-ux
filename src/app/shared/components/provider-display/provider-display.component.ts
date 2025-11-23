import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component to display an OAuth provider with its logo and capitalized name
 * Format: <logo> ProviderName
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
   */
  @Input() provider = '';

  /**
   * Get the logo path for the provider
   * Reuses the same logo mapping as the login component
   */
  getProviderLogoPath(providerId: string): string | null {
    const logoMap: Record<string, string> = {
      google: 'assets/signin-logos/google-signin-logo.svg',
      github: 'assets/signin-logos/github-signin-logo.svg',
      microsoft: 'assets/signin-logos/microsoft-signin-logo.svg',
      gitlab: 'assets/signin-logos/gitlab-signin-logo.svg',
      bitbucket: 'assets/signin-logos/bitbucket-signin-logo.svg',
      apple: 'assets/signin-logos/apple-signin-logo.svg',
      test: 'assets/signin-logos/test-signin-logo.svg',
    };
    return logoMap[providerId.toLowerCase()] || null;
  }

  /**
   * Get the properly capitalized provider name
   * Follows the rules:
   * - GitHub (capital H)
   * - GitLab (capital L)
   * - All others just have first letter capitalized
   */
  getProviderName(providerId: string): string {
    const provider = providerId.toLowerCase();

    // Special cases with specific capitalization
    const specialCases: Record<string, string> = {
      github: 'GitHub',
      gitlab: 'GitLab',
      google: 'Google',
      microsoft: 'Microsoft',
      bitbucket: 'Bitbucket',
      apple: 'Apple',
      test: 'Test',
    };

    // Return special case if exists, otherwise capitalize first letter
    if (specialCases[provider]) {
      return specialCases[provider];
    }

    // Default: capitalize first letter
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
