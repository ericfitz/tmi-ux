import { JSDOM } from 'jsdom';
import type { Environment } from 'vitest';

/**
 * Custom Vitest environment for Angular applications.
 * This environment provides a JSDOM environment for tests.
 * Zone.js and TestBed initialization are handled by `src/test-setup.ts`.
 */
export default {
  name: 'angular-jsdom',
  transformMode: 'web', // Ensure transforms are applied for web environment

  setup() {
    // Initialize JSDOM environment
    const { window } = new JSDOM('<!DOCTYPE html>', {
      url: 'http://localhost',
    });

    // Expose window and document to global scope for Angular
    global.window = window as unknown as Window & typeof globalThis;
    global.document = window.document;
    global.Node = window.Node;
    global.HTMLElement = window.HTMLElement;
    global.HTMLAnchorElement = window.HTMLAnchorElement;
    global.HTMLButtonElement = window.HTMLButtonElement;
    global.HTMLDivElement = window.HTMLDivElement;
    global.Event = window.Event;
    global.KeyboardEvent = window.KeyboardEvent;
    global.MouseEvent = window.MouseEvent;
    global.CustomEvent = window.CustomEvent;
    global.CSSStyleDeclaration = window.CSSStyleDeclaration;
    global.XMLHttpRequest = window.XMLHttpRequest;
    global.Text = window.Text;
    global.navigator = window.navigator;
    global.localStorage = window.localStorage;
    global.sessionStorage = window.sessionStorage;
    global.getComputedStyle = window.getComputedStyle;
    global.btoa = window.btoa;
    global.atob = window.atob;
    global.crypto = window.crypto; // Ensure crypto is available for OAuth tests

    return {
      teardown() {
        // Cleanup if necessary
      },
    };
  },
} satisfies Environment;
