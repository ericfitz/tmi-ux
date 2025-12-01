import { Injectable } from '@angular/core';
import { PrincipalType } from '../../models/threat-model.model';

/**
 * Provider-specific rule configuration
 */
export interface ProviderRule {
  /**
   * Whether this provider supports user-type principals
   */
  supportsUser: boolean;

  /**
   * Whether this provider supports group-type principals
   */
  supportsGroup: boolean;

  /**
   * Optional function to get default subject value for this provider
   * @param principalType - The type of principal (user or group)
   * @returns Default subject value or null if no default
   */
  defaultSubject?: (principalType: PrincipalType) => string | null;

  /**
   * Optional API provider ID to use when sending to API
   * If not specified, the provider ID is used as-is
   */
  apiProvider?: string;

  /**
   * Display name for this provider in the UI
   */
  displayName: string;
}

/**
 * Service that encapsulates provider-specific business rules and transformations.
 * This centralizes knowledge about which providers support which principal types,
 * how to transform provider IDs for API submission, and provider-specific defaults.
 */
@Injectable({
  providedIn: 'root',
})
export class ProviderAdapterService {
  /**
   * Provider-specific rules configuration
   * Built-in providers (like 'tmi') are defined here
   * OAuth/SAML providers have default rules applied
   */
  private readonly providerRules: Record<string, ProviderRule> = {
    tmi: {
      supportsUser: false,
      supportsGroup: true,
      defaultSubject: () => 'everyone',
      apiProvider: '*',
      displayName: 'TMI',
    },
    // Note: OAuth/SAML providers are not listed here
    // They get default rules: support both users and groups
  };

  /**
   * Default rules for providers not explicitly configured
   * OAuth/SAML providers support both users and groups by default
   */
  private readonly defaultRule: ProviderRule = {
    supportsUser: true,
    supportsGroup: true,
    displayName: '', // Will use provider ID capitalized
  };

  /**
   * Get the provider rule for a given provider ID
   * @param provider - The provider identifier
   * @returns Provider rule configuration
   */
  private getProviderRule(provider: string): ProviderRule {
    return this.providerRules[provider] || this.defaultRule;
  }

  /**
   * Check if a provider is valid for a given principal type
   * @param provider - The provider identifier
   * @param principalType - The principal type ('user' or 'group')
   * @returns True if the provider supports this principal type
   */
  isValidForPrincipalType(provider: string, principalType: PrincipalType): boolean {
    const rule = this.getProviderRule(provider);
    return principalType === 'user' ? rule.supportsUser : rule.supportsGroup;
  }

  /**
   * Get the default subject value for a provider and principal type combination
   * @param provider - The provider identifier
   * @param principalType - The principal type ('user' or 'group')
   * @returns Default subject value or null if no default
   */
  getDefaultSubject(provider: string, principalType: PrincipalType): string | null {
    const rule = this.getProviderRule(provider);
    return rule.defaultSubject ? rule.defaultSubject(principalType) : null;
  }

  /**
   * Transform a provider ID for API submission
   * Maps UI provider IDs to their API equivalents
   * Example: 'tmi' → '*'
   * @param provider - The provider identifier from the UI
   * @returns The provider identifier to send to the API
   */
  transformProviderForApi(provider: string): string {
    const rule = this.getProviderRule(provider);
    return rule.apiProvider || provider;
  }

  /**
   * Transform a provider ID from API for display in the UI
   * Maps API provider IDs back to their UI equivalents
   * Example: '*' → 'tmi'
   * @param provider - The provider identifier from the API
   * @returns The provider identifier to display in the UI
   */
  transformProviderForDisplay(provider: string): string {
    // Reverse lookup: find provider whose apiProvider matches the input
    for (const [uiProvider, rule] of Object.entries(this.providerRules)) {
      if (rule.apiProvider === provider) {
        return uiProvider;
      }
    }
    // If no match found, return as-is
    return provider;
  }

  /**
   * Get the display name for a provider
   * @param provider - The provider identifier
   * @returns The display name for this provider
   */
  getProviderDisplayName(provider: string): string {
    const rule = this.getProviderRule(provider);
    if (rule.displayName) {
      return rule.displayName;
    }
    // Fallback: capitalize first letter of provider ID
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
