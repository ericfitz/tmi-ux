import '@angular/compiler';

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { AuditLogsPageComponent } from './audit-logs-page.component';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
});

// SEM@ad7267a2dd7fbf341955a732f42557d735bad83b: build a configured TestBed fixture for AuditLogsPageComponent (pure)
function buildFixture(): ComponentFixture<AuditLogsPageComponent> {
  const translocoTesting = TranslocoTestingModule.forRoot({
    langs: { en: {} },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });

  void TestBed.configureTestingModule({
    imports: [AuditLogsPageComponent, translocoTesting],
    providers: [provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuditLogsPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('AuditLogsPageComponent', () => {
  let fixture: ComponentFixture<AuditLogsPageComponent>;

  beforeEach(() => {
    fixture = buildFixture();
  });

  it('should create the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the system tab link', () => {
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('[data-testid="audit-tab-system"]');
    expect(link).toBeTruthy();
  });

  it('should render the threat-models tab link', () => {
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('[data-testid="audit-tab-tm"]');
    expect(link).toBeTruthy();
  });

  it('should have both audit tab links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll('[data-testid^="audit-tab"]');
    expect(links.length).toBe(2);
  });

  it('system tab link should have routerLink pointing to system', () => {
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="audit-tab-system"]');
    expect(link?.getAttribute('href')).toContain('system');
  });

  it('threat-models tab link should have routerLink pointing to threat-models', () => {
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="audit-tab-tm"]');
    expect(link?.getAttribute('href')).toContain('threat-models');
  });
});
