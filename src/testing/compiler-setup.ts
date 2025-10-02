/**
 * Compiler setup for Angular JIT compilation in tests
 * This file MUST be loaded before any Angular modules
 */

// Import and initialize the Angular compiler globally
import * as compiler from '@angular/compiler';
import { ɵsetCompilerFacade } from '@angular/core';

// Register the compiler facade globally before any Angular modules load
ɵsetCompilerFacade(compiler as any);
