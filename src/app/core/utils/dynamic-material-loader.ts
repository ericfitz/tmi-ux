/**
 * Utility functions for dynamically loading Angular Material components
 * This helps reduce the initial bundle size by loading components only when needed
 */

import { Injector } from '@angular/core';

// Store injector reference for dynamic component creation
let globalInjector: Injector;

export function setInjector(injector: Injector): void {
  globalInjector = injector;
}
