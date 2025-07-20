/**
 * Component test harness for Angular testing with Vitest
 * This file provides utilities for testing Angular components
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

/**
 * Creates a component fixture with the provided configuration
 * @param component The component type to create
 * @param providers Optional providers for the test module
 * @param declarations Optional declarations for the test module
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
  // Use void to explicitly mark the promise as ignored
  void TestBed.configureTestingModule({
    imports,
    declarations: [component, ...declarations],
    providers,
  }).compileComponents();

  return TestBed.createComponent(component);
}
