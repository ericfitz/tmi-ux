/**
 * Shared Module
 *
 * This module provides commonly used Angular modules and components that are shared
 * across multiple feature modules in the application.
 *
 * Key functionality:
 * - Exports commonly used Angular modules (CommonModule, FormsModule, ReactiveFormsModule)
 * - Provides router functionality for navigation across shared components
 * - Includes Material Design components via MaterialModule
 * - Reduces duplication by centralizing common module imports
 * - Provides consistent UI framework access across all feature modules
 * - Simplifies module imports for feature modules
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from './material/material.module';

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MaterialModule],
  exports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MaterialModule],
})
export class SharedModule {}
