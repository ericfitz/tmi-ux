// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';
import { SessionManagerService } from './auth/services/session-manager.service';

@Component({ selector: 'app-navbar', template: '' })
class StubNavbarComponent {}

@Component({ selector: 'app-footer', template: '' })
class StubFooterComponent {}

@Component({ template: 'page' })
class StubPageComponent {}

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
});

/**
 * Shell layout switching: the full-bleed class and footer follow the active
 * route's `data.fullBleed`, including when navigating away again.
 */
describe('AppComponent full-bleed layout', () => {
  async function setup(): Promise<{
    router: Router;
    render: () => { fullBleed: boolean; footer: boolean };
  }> {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: 'list', component: StubPageComponent },
          {
            path: 'tm/:id',
            children: [
              { path: 'dfd/:dfdId', component: StubPageComponent, data: { fullBleed: true } },
            ],
          },
        ]),
        { provide: SessionManagerService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(AppComponent, {
      set: { imports: [RouterOutlet, StubNavbarComponent, StubFooterComponent] },
    });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    const render = (): { fullBleed: boolean; footer: boolean } => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      return {
        fullBleed: !!el.querySelector('.app-container.full-bleed'),
        footer: !!el.querySelector('app-footer'),
      };
    };
    return { router, render };
  }

  it('uses the normal layout with a footer on ordinary routes', async () => {
    const { router, render } = await setup();

    await router.navigateByUrl('/list');

    expect(render()).toEqual({ fullBleed: false, footer: true });
  });

  it('switches to full-bleed without a footer on the DFD route', async () => {
    const { router, render } = await setup();

    await router.navigateByUrl('/tm/1/dfd/2');

    expect(render()).toEqual({ fullBleed: true, footer: false });
  });

  it('restores the normal layout after leaving the DFD route', async () => {
    const { router, render } = await setup();
    await router.navigateByUrl('/tm/1/dfd/2');
    expect(render().fullBleed).toBe(true);

    await router.navigateByUrl('/list');

    expect(render()).toEqual({ fullBleed: false, footer: true });
  });
});
