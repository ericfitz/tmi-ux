/**
 * Utility functions for dynamically loading Angular Material components
 * This helps reduce the initial bundle size by loading components only when needed
 */

import { ComponentType } from '@angular/cdk/portal';
import { Injector } from '@angular/core';
import { MatDialogConfig, MatDialogRef } from '@angular/material/dialog';

// Store injector reference for dynamic component creation
let globalInjector: Injector;

export function setInjector(injector: Injector): void {
  globalInjector = injector;
}

/**
 * Dynamically loads and opens a Material dialog
 * @param componentType The component to load in the dialog
 * @param config Optional dialog configuration
 * @returns Promise that resolves when the dialog is opened
 */
export async function openDynamicDialog<T>(
  componentType: ComponentType<T>,
  config?: MatDialogConfig<T>,
): Promise<MatDialogRef<T>> {
  if (!globalInjector) {
    throw new Error('Injector not set. Call setInjector first.');
  }

  // Dynamically import the dialog module with a named chunk
  const dialogModule = await import(
    /* webpackChunkName: "material-dialog" */ '@angular/material/dialog'
  );

  // Get dialog service from injector
  const dialog = globalInjector.get(dialogModule.MatDialog);

  // Open the dialog
  return dialog.open(componentType, config);
}

/**
 * Dynamically loads and opens a Material snackbar
 * @param message The message to display
 * @param action Optional action text
 * @param duration Optional duration in milliseconds
 * @returns Promise that resolves when the snackbar is opened
 */
export async function openDynamicSnackbar(
  message: string,
  action: string = 'Close',
  duration: number = 3000,
): Promise<void> {
  if (!globalInjector) {
    throw new Error('Injector not set. Call setInjector first.');
  }

  // Dynamically import the snackbar module with a named chunk
  const snackbarModule = await import(
    /* webpackChunkName: "material-snackbar" */ '@angular/material/snack-bar'
  );

  // Get snackbar service from injector
  const snackBar = globalInjector.get(snackbarModule.MatSnackBar);

  // Open the snackbar
  snackBar.open(message, action, { duration });
}
