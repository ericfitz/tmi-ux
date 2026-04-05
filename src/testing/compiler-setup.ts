/**
 * Compiler setup for Angular JIT compilation in tests
 * This file MUST be loaded before any Angular modules
 *
 * Importing @angular/compiler as a side-effect registers the JIT compiler
 * facade globally, which is required for partially-compiled Angular libraries
 * (e.g., PlatformLocation in @angular/common).
 *
 * Note: Individual test files that reference Angular modules must also include
 * `import '@angular/compiler';` as their first import, because Vite's forks
 * pool may resolve module static initializers before this setup file's
 * side-effects fully propagate.
 */
import '@angular/compiler';
