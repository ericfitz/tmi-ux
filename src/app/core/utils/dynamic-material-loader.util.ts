/**
 * Utility functions for dynamically loading Angular Material components
 * This helps reduce the initial bundle size by loading components only when needed
 */

import { Injector } from '@angular/core';

// Store injector reference for dynamic component creation
let _globalInjector: Injector;

// SEM@57394346339d21b4055bda04efd4d869626327c2: store the Angular injector reference for dynamic component creation (mutates shared state)
export function setInjector(injector: Injector): void {
  _globalInjector = injector;
}
