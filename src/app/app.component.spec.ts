// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { describe, it, expect } from 'vitest';

import { ActivatedRouteSnapshot } from '@angular/router';

import { AppComponent, isFullBleedRoute } from './app.component';

describe('AppComponent', () => {
  describe('change detection strategy', () => {
    // AppComponent hosts the <router-outlet>, so every routed page renders
    // inside its view. If this component is OnPush, a change-detection tick
    // starts here, finds it clean, and prunes the entire subtree — a routed
    // CheckAlways page that mutates state from an async callback (HTTP
    // subscribe, setTimeout, Promise.then) then updates its model but never
    // repaints.
    //
    // That is not hypothetical: making this OnPush in 67ba1fef hung the
    // "Loading authentication providers" spinner on the login page and left
    // every admin list page (groups, settings, users, ...) spinning forever
    // while their APIs returned 200. It read as intermittent only because the
    // navbar's async pipes transiently mark this component dirty, letting a
    // full traversal through.
    //
    // Do not convert this component to OnPush.
    it('is CheckAlways so routed pages are not pruned from change detection', () => {
      // ɵcmp is private Angular API with no compatibility promise. It has been
      // stable since Ivy, and the failure mode is a loud test break at upgrade
      // time rather than a silent pass. If this breaks during an Angular
      // upgrade, update the probe — do not "fix" it by changing the strategy.
      const def = (AppComponent as unknown as { ɵcmp: { onPush: boolean } }).ɵcmp;

      expect(def.onPush).toBe(false);
    });
  });
});

describe('isFullBleedRoute', () => {
  /** Build a minimal snapshot chain: each entry is one level's route data. */
  function chain(...levels: Record<string, unknown>[]): ActivatedRouteSnapshot {
    let child: ActivatedRouteSnapshot | null = null;
    for (const data of [...levels].reverse()) {
      child = { data, firstChild: child } as unknown as ActivatedRouteSnapshot;
    }
    return child as ActivatedRouteSnapshot;
  }

  it('is true when the deepest route declares fullBleed', () => {
    expect(isFullBleedRoute(chain({}, {}, { fullBleed: true }))).toBe(true);
  });

  it('is true when an ancestor route declares fullBleed', () => {
    expect(isFullBleedRoute(chain({}, { fullBleed: true }, {}))).toBe(true);
  });

  it('is false when no route declares fullBleed', () => {
    expect(isFullBleedRoute(chain({}, { threatModel: {} }, {}))).toBe(false);
  });

  it('rejects truthy non-boolean values', () => {
    expect(isFullBleedRoute(chain({ fullBleed: 'yes' }, { fullBleed: 1 }))).toBe(false);
  });
});

describe('full-bleed route configuration', () => {
  it('marks only the DFD editor route as full-bleed', async () => {
    const { TM_ROUTES } = await import('./pages/tm/tm.routes');
    const children = TM_ROUTES.flatMap(r => r.children ?? [r]);
    const fullBleedPaths = children.filter(r => r.data?.['fullBleed'] === true).map(r => r.path);
    expect(fullBleedPaths).toEqual([':id/dfd/:dfdId']);
  });
});
