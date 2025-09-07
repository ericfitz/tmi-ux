# Import Constants Usage Guide

This guide explains how to use the import constants for standalone components in the TMI-UX application.

## Overview

Use the specific import constants defined in `src/app/shared/imports.ts` for all standalone components. SharedModule and MaterialModule have been removed in favor of explicit imports.

## Available Import Constants

### Basic Imports

- **COMMON_IMPORTS**: CommonModule, FormsModule, ReactiveFormsModule, RouterModule
- **CORE_MATERIAL_IMPORTS**: Button, Icon, Toolbar, Menu, Tooltip, Divider

### Feature-Specific Imports

- **FORM_MATERIAL_IMPORTS**: FormField, Input, Select, Checkbox, Radio, SlideToggle
- **DATA_MATERIAL_IMPORTS**: Table, Paginator, Sort, Card, List, GridList, Badge
- **FEEDBACK_MATERIAL_IMPORTS**: ProgressSpinner, SnackBar, Dialog

### Pre-configured Combinations

- **COMMON_STANDALONE_IMPORTS**: Common + Core Material + Forms
- **DATA_DISPLAY_IMPORTS**: Common + Core Material + Data Display
- **DIALOG_IMPORTS**: Common + Core Material + Forms + Dialog

## Usage Examples

### Basic Component

```typescript
import { Component } from '@angular/core';
import { COMMON_STANDALONE_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [...COMMON_STANDALONE_IMPORTS],
  template: `...`,
})
export class ExampleComponent {}
```

### Data Table Component

```typescript
import { Component } from '@angular/core';
import { DATA_DISPLAY_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [...DATA_DISPLAY_IMPORTS],
  template: `...`,
})
export class DataTableComponent {}
```

### Dialog Component

```typescript
import { Component } from '@angular/core';
import { DIALOG_IMPORTS } from '@app/shared/imports';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS],
  template: `...`,
})
export class DialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}
}
```

### Custom Combination

```typescript
import { Component } from '@angular/core';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-custom',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, MatListModule],
  template: `...`,
})
export class CustomComponent {}
```

## Migration Complete

The migration to standalone components is now complete:

- ✅ SharedModule and MaterialModule have been removed
- ✅ All components use explicit imports via constants
- ✅ All NgModules have been converted to standalone components

## Best Practices

1. **Use specific imports**: Only import what you need to reduce bundle size
2. **Prefer pre-configured combinations**: Use the pre-configured combinations when they match your needs
3. **Add missing imports individually**: If you need an additional Material module, import it directly
4. **Avoid ALL_MATERIAL_IMPORTS**: Only use this for prototyping or when you truly need all modules

## Benefits

- **Tree-shaking**: Only the modules you use are included in the bundle
- **Explicit dependencies**: Clear visibility of what each component depends on
- **Consistency**: Standardized import patterns across the codebase
- **Maintainability**: Easy to update common dependencies in one place
