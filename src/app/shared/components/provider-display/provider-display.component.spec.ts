// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderDisplayComponent } from './provider-display.component';

describe('ProviderDisplayComponent', () => {
  let component: ProviderDisplayComponent;
  let fixture: ComponentFixture<ProviderDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderDisplayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getProviderLogoPath', () => {
    it('should return correct path for google', () => {
      expect(component.getProviderLogoPath('google')).toBe(
        'assets/signin-logos/google-signin-logo.svg',
      );
    });

    it('should return correct path for github', () => {
      expect(component.getProviderLogoPath('github')).toBe(
        'assets/signin-logos/github-signin-logo.svg',
      );
    });

    it('should return correct path for microsoft', () => {
      expect(component.getProviderLogoPath('microsoft')).toBe(
        'assets/signin-logos/microsoft-signin-logo.svg',
      );
    });

    it('should return correct path for gitlab', () => {
      expect(component.getProviderLogoPath('gitlab')).toBe(
        'assets/signin-logos/gitlab-signin-logo.svg',
      );
    });

    it('should return correct path for bitbucket', () => {
      expect(component.getProviderLogoPath('bitbucket')).toBe(
        'assets/signin-logos/bitbucket-signin-logo.svg',
      );
    });

    it('should return correct path for apple', () => {
      expect(component.getProviderLogoPath('apple')).toBe(
        'assets/signin-logos/apple-signin-logo.svg',
      );
    });

    it('should return correct path for test', () => {
      expect(component.getProviderLogoPath('test')).toBe(
        'assets/signin-logos/test-signin-logo.svg',
      );
    });

    it('should return null for unknown provider', () => {
      expect(component.getProviderLogoPath('unknown')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(component.getProviderLogoPath('GOOGLE')).toBe(
        'assets/signin-logos/google-signin-logo.svg',
      );
    });
  });

  describe('getProviderName', () => {
    it('should return "GitHub" with capital H', () => {
      expect(component.getProviderName('github')).toBe('GitHub');
    });

    it('should return "GitLab" with capital L', () => {
      expect(component.getProviderName('gitlab')).toBe('GitLab');
    });

    it('should return "Google" capitalized', () => {
      expect(component.getProviderName('google')).toBe('Google');
    });

    it('should return "Microsoft" capitalized', () => {
      expect(component.getProviderName('microsoft')).toBe('Microsoft');
    });

    it('should return "Bitbucket" with only first letter capitalized', () => {
      expect(component.getProviderName('bitbucket')).toBe('Bitbucket');
    });

    it('should return "Apple" capitalized', () => {
      expect(component.getProviderName('apple')).toBe('Apple');
    });

    it('should return "Test" capitalized', () => {
      expect(component.getProviderName('test')).toBe('Test');
    });

    it('should capitalize first letter for unknown providers', () => {
      expect(component.getProviderName('unknown')).toBe('Unknown');
    });

    it('should be case-insensitive for known providers', () => {
      expect(component.getProviderName('GITHUB')).toBe('GitHub');
      expect(component.getProviderName('GiTlAb')).toBe('GitLab');
    });
  });

  describe('template rendering', () => {
    it('should display logo and name for known provider', () => {
      component.provider = 'google';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img');
      const span = compiled.querySelector('.provider-name');

      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('assets/signin-logos/google-signin-logo.svg');
      expect(img?.getAttribute('alt')).toBe('Google logo');
      expect(span?.textContent).toBe('Google');
    });

    it('should display only name for unknown provider', () => {
      component.provider = 'unknown';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img');
      const span = compiled.querySelector('.provider-name');

      expect(img).toBeFalsy();
      expect(span?.textContent).toBe('Unknown');
    });

    it('should display GitHub with capital H', () => {
      component.provider = 'github';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const span = compiled.querySelector('.provider-name');

      expect(span?.textContent).toBe('GitHub');
    });

    it('should display GitLab with capital L', () => {
      component.provider = 'gitlab';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const span = compiled.querySelector('.provider-name');

      expect(span?.textContent).toBe('GitLab');
    });
  });
});
