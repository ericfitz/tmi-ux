/**
 * Component test harness for Angular testing with Vitest
 * This file provides utilities for testing Angular components
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

/**
 * Creates a component fixture with the provided configuration
 * Supports both standalone and non-standalone components
 * @param component The component type to create
 * @param providers Optional providers for the test module
 * @param declarations Optional declarations for the test module (for non-standalone components)
 * @param imports Optional imports for the test module
 * @returns A ComponentFixture for the component
 */
export function createComponentFixture<T>(
  component: Type<T>,
  {
    providers = [],
    declarations = [],
    imports = [],
  }: {
    providers?: unknown[];
    declarations?: Type<unknown>[];
    imports?: unknown[];
  } = {},
): ComponentFixture<T> {
  const componentMetadata =
    (component as any)['ɵcmp'] || (component as any)['__annotations__']?.[0];
  const isStandalone = componentMetadata?.standalone === true;

  if (isStandalone) {
    // For standalone components, import the component itself
    void TestBed.configureTestingModule({
      imports: [component, ...imports],
      providers,
    }).compileComponents();
  } else {
    // For non-standalone components, use declarations
    void TestBed.configureTestingModule({
      imports,
      declarations: [component, ...declarations],
      providers,
    }).compileComponents();
  }

  return TestBed.createComponent(component);
}
