// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { UserDisplayComponent, UserDisplayInput } from './user-display.component';
import { BrandingConfigService } from '@app/core/services/branding-config.service';
import { AuthService } from '@app/auth/services/auth.service';

describe('UserDisplayComponent', () => {
  let component: UserDisplayComponent;
  let mockBrandingConfig: {
    userHyperlinkTemplate: string | null;
    userHyperlinkProvider: string | null;
  };
  let mockAuthService: {
    userProfile: { provider: string } | null;
    userEmail: string;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrandingConfig = {
      userHyperlinkTemplate: null,
      userHyperlinkProvider: null,
    };

    mockAuthService = {
      userProfile: null,
      userEmail: '',
    };

    component = new UserDisplayComponent(
      mockBrandingConfig as unknown as BrandingConfigService,
      mockAuthService as unknown as AuthService,
    );
  });

  describe('Display Text', () => {
    it('should display display_name when available', () => {
      component.user = { display_name: 'John Doe', email: 'john@example.com' };
      component.ngOnChanges();
      expect(component.displayText).toBe('John Doe');
    });

    it('should fall back to name when display_name is missing', () => {
      component.user = { name: 'Jane Smith', email: 'jane@example.com' };
      component.ngOnChanges();
      expect(component.displayText).toBe('Jane Smith');
    });

    it('should fall back to email when both names are missing', () => {
      component.user = { email: 'user@example.com' };
      component.ngOnChanges();
      expect(component.displayText).toBe('user@example.com');
    });

    it('should use fallback when user is null', () => {
      component.user = null;
      component.fallback = 'N/A';
      component.ngOnChanges();
      expect(component.displayText).toBe('N/A');
    });

    it('should use fallback when user has no name or email', () => {
      component.user = { provider: 'github' };
      component.fallback = '---';
      component.ngOnChanges();
      expect(component.displayText).toBe('---');
    });

    it('should use empty string fallback by default', () => {
      component.user = null;
      component.ngOnChanges();
      expect(component.displayText).toBe('');
    });

    it('should prioritize display_name over name', () => {
      component.user = { display_name: 'Display', name: 'Name' };
      component.ngOnChanges();
      expect(component.displayText).toBe('Display');
    });
  });

  describe('Tooltip', () => {
    it('should show email in tooltip by default', () => {
      component.user = { display_name: 'John', email: 'john@example.com' };
      component.ngOnChanges();
      expect(component.tooltipText).toBe('john@example.com');
    });

    it('should hide email tooltip when showEmailTooltip is false', () => {
      component.user = { display_name: 'John', email: 'john@example.com' };
      component.showEmailTooltip = false;
      component.ngOnChanges();
      expect(component.tooltipText).toBe('');
    });

    it('should return empty tooltip when user has no email', () => {
      component.user = { display_name: 'John' };
      component.ngOnChanges();
      expect(component.tooltipText).toBe('');
    });

    it('should return empty tooltip when user is null', () => {
      component.user = null;
      component.ngOnChanges();
      expect(component.tooltipText).toBe('');
    });
  });

  describe('Hyperlink Generation', () => {
    const configuredProvider = 'azure-ad';
    const template = 'https://directory.example.com/?email={{user.email}}';

    beforeEach(() => {
      mockBrandingConfig.userHyperlinkTemplate = template;
      mockBrandingConfig.userHyperlinkProvider = configuredProvider;
      mockAuthService.userProfile = { provider: configuredProvider };
    });

    it('should generate hyperlink when all conditions are met', () => {
      component.user = {
        display_name: 'John',
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBe(
        'https://directory.example.com/?email=john%40example.com',
      );
    });

    it('should replace user.name placeholder in template', () => {
      mockBrandingConfig.userHyperlinkTemplate =
        'https://directory.example.com/?name={{user.name}}&email={{user.email}}';
      component.user = {
        display_name: 'John Doe',
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBe(
        'https://directory.example.com/?name=John%20Doe&email=john%40example.com',
      );
    });

    it('should not generate hyperlink when template is not configured', () => {
      mockBrandingConfig.userHyperlinkTemplate = null;
      component.user = {
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when provider is not configured', () => {
      mockBrandingConfig.userHyperlinkProvider = null;
      component.user = {
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when signed-in user provider does not match', () => {
      mockAuthService.userProfile = { provider: 'github' };
      component.user = {
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when target user provider does not match', () => {
      component.user = {
        email: 'john@example.com',
        provider: 'github',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when target user has no email', () => {
      component.user = {
        display_name: 'John',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when target user has no provider', () => {
      component.user = {
        email: 'john@example.com',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when signed-in user profile is null', () => {
      mockAuthService.userProfile = null;
      component.user = {
        email: 'john@example.com',
        provider: configuredProvider,
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should not generate hyperlink when user is null', () => {
      component.user = null;
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });
  });

  describe('URL Security', () => {
    beforeEach(() => {
      mockBrandingConfig.userHyperlinkProvider = 'azure-ad';
      mockAuthService.userProfile = { provider: 'azure-ad' };
    });

    it('should reject javascript: URLs', () => {
      mockBrandingConfig.userHyperlinkTemplate = 'javascript:alert({{user.email}})';
      component.user = {
        email: 'test@example.com',
        provider: 'azure-ad',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should reject data: URLs', () => {
      mockBrandingConfig.userHyperlinkTemplate = 'data:text/html,{{user.email}}';
      component.user = {
        email: 'test@example.com',
        provider: 'azure-ad',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toBeNull();
    });

    it('should allow https: URLs', () => {
      mockBrandingConfig.userHyperlinkTemplate = 'https://example.com/?u={{user.email}}';
      component.user = {
        email: 'test@example.com',
        provider: 'azure-ad',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toMatch(/^https:\/\//);
    });

    it('should allow http: URLs', () => {
      mockBrandingConfig.userHyperlinkTemplate = 'http://example.com/?u={{user.email}}';
      component.user = {
        email: 'test@example.com',
        provider: 'azure-ad',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toMatch(/^http:\/\//);
    });

    it('should URL-encode email in template', () => {
      mockBrandingConfig.userHyperlinkTemplate = 'https://example.com/?u={{user.email}}';
      component.user = {
        email: 'user+tag@example.com',
        provider: 'azure-ad',
      };
      component.ngOnChanges();
      expect(component.hyperlinkUrl).toContain('user%2Btag%40example.com');
    });
  });

  describe('AdminUser Support', () => {
    it('should use name field from AdminUser-shaped objects', () => {
      const adminUser: UserDisplayInput = {
        name: 'Admin User',
        email: 'admin@example.com',
        provider: 'azure-ad',
      };
      component.user = adminUser;
      component.ngOnChanges();
      expect(component.displayText).toBe('Admin User');
    });

    it('should prefer display_name over name for mixed objects', () => {
      const user: UserDisplayInput = {
        display_name: 'Preferred Name',
        name: 'Fallback Name',
        email: 'user@example.com',
      };
      component.user = user;
      component.ngOnChanges();
      expect(component.displayText).toBe('Preferred Name');
    });
  });
});
