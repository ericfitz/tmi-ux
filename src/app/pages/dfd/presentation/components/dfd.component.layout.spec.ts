// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DfdComponent } from './dfd.component';

/**
 * Layout behavior of the DFD editor: the collapsible diagram details header and
 * the graph's container-size tracking. DfdComponent has a large dependency
 * graph, so these tests exercise the methods on a prototype instance with only
 * the collaborators they touch.
 */
describe('DfdComponent layout', () => {
  type LayoutInternals = {
    isHeaderExpanded: boolean;
    showDeveloperTools: boolean;
    userPreferencesService: {
      updatePreferences: ReturnType<typeof vi.fn>;
      preferences$: BehaviorSubject<Record<string, unknown>>;
    };
    appDfdOrchestrator: {
      onWindowResize: ReturnType<typeof vi.fn>;
      getState: () => { hasUnsavedChanges: boolean };
    };
    logger: { warn: ReturnType<typeof vi.fn> };
    cdr: { markForCheck: ReturnType<typeof vi.fn> };
    graphContainer: { nativeElement: HTMLElement };
    isReadOnlyMode: boolean;
    _destroy$: Subject<void>;
    _subscriptions: Subscription;
    toggleHeaderExpanded(): void;
    ngOnDestroy(): void;
    loadUserPreferences(): void;
    _observeGraphContainerSize(): void;
    _graphResizeObserver: ResizeObserver | null;
    _graphResizeFrame: number;
  };

  function makeComponent(): LayoutInternals {
    const comp = Object.create(DfdComponent.prototype) as LayoutInternals;
    comp.isHeaderExpanded = false;
    comp.showDeveloperTools = false;
    comp.userPreferencesService = {
      updatePreferences: vi.fn(),
      preferences$: new BehaviorSubject<Record<string, unknown>>({}),
    };
    comp.appDfdOrchestrator = {
      onWindowResize: vi.fn(),
      getState: () => ({ hasUnsavedChanges: false }),
    };
    comp.logger = { warn: vi.fn() };
    comp.cdr = { markForCheck: vi.fn() };
    comp.graphContainer = { nativeElement: document.createElement('div') };
    comp.isReadOnlyMode = false;
    comp._destroy$ = new Subject<void>();
    comp._subscriptions = new Subscription();
    comp._graphResizeObserver = null;
    comp._graphResizeFrame = 0;
    return comp;
  }

  /** Stub ResizeObserver and requestAnimationFrame; returns handles to drive them. */
  function stubObserverAndFrames(): {
    fireResize: () => void;
    runFrames: () => void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    cancelAnimationFrame: ReturnType<typeof vi.fn>;
  } {
    let callback: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      const id = nextFrame++;
      frames.set(id, cb);
      return id;
    });
    const cancel = vi.fn((id: number) => frames.delete(id));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    return {
      fireResize: () => callback?.(),
      runFrames: () => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(cb => cb());
      },
      observe,
      disconnect,
      cancelAnimationFrame: cancel,
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('toggleHeaderExpanded', () => {
    it('persists the expanded state when collapsed', () => {
      const comp = makeComponent();

      comp.toggleHeaderExpanded();

      expect(comp.userPreferencesService.updatePreferences).toHaveBeenCalledWith({
        dfdHeaderExpanded: true,
      });
    });

    it('persists the collapsed state when expanded', () => {
      const comp = makeComponent();
      comp.isHeaderExpanded = true;

      comp.toggleHeaderExpanded();

      expect(comp.userPreferencesService.updatePreferences).toHaveBeenCalledWith({
        dfdHeaderExpanded: false,
      });
    });
  });

  describe('graph container resize tracking', () => {
    it('observes the outer graph container and resizes the graph once per frame', () => {
      const stubs = stubObserverAndFrames();
      const comp = makeComponent();
      const outer = document.createElement('div');
      outer.appendChild(comp.graphContainer.nativeElement);

      comp._observeGraphContainerSize();

      expect(stubs.observe).toHaveBeenCalledWith(outer);

      // Several size reports within one frame (e.g. a window drag) coalesce.
      stubs.fireResize();
      stubs.fireResize();
      stubs.fireResize();
      expect(comp.appDfdOrchestrator.onWindowResize).not.toHaveBeenCalled();

      stubs.runFrames();
      expect(comp.appDfdOrchestrator.onWindowResize).toHaveBeenCalledTimes(1);

      // A later size change schedules a new frame.
      stubs.fireResize();
      stubs.runFrames();
      expect(comp.appDfdOrchestrator.onWindowResize).toHaveBeenCalledTimes(2);
    });

    it('disconnects the observer and cancels a pending resize on destroy', () => {
      const stubs = stubObserverAndFrames();
      const comp = makeComponent();
      comp._observeGraphContainerSize();
      stubs.fireResize();

      comp.ngOnDestroy();

      expect(stubs.disconnect).toHaveBeenCalled();
      expect(stubs.cancelAnimationFrame).toHaveBeenCalled();
      stubs.runFrames();
      expect(comp.appDfdOrchestrator.onWindowResize).not.toHaveBeenCalled();
    });

    it('warns and does not throw when ResizeObserver is unavailable', () => {
      vi.stubGlobal('ResizeObserver', undefined);
      const comp = makeComponent();

      expect(() => comp._observeGraphContainerSize()).not.toThrow();
      expect(comp.logger.warn).toHaveBeenCalled();
      expect(comp._graphResizeObserver).toBeNull();
    });
  });

  describe('header expansion preference', () => {
    it('follows the stored preference', () => {
      const comp = makeComponent();
      comp.loadUserPreferences();

      comp.userPreferencesService.preferences$.next({ dfdHeaderExpanded: true });
      expect(comp.isHeaderExpanded).toBe(true);

      comp.userPreferencesService.preferences$.next({ dfdHeaderExpanded: false });
      expect(comp.isHeaderExpanded).toBe(false);
    });

    it('stays collapsed when stored preferences lack the key or hold a non-boolean', () => {
      const comp = makeComponent();
      comp.loadUserPreferences();

      comp.userPreferencesService.preferences$.next({ showDeveloperTools: true });
      expect(comp.isHeaderExpanded).toBe(false);

      comp.userPreferencesService.preferences$.next({ dfdHeaderExpanded: 'yes' });
      expect(comp.isHeaderExpanded).toBe(false);
    });
  });
});
