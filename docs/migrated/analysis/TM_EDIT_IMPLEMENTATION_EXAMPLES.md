# TM-Edit Read-Only Mode: Implementation Examples

This document provides code examples for implementing read-only mode for reader users.

## 1. Template Examples

### Example 1: Add Button with Permission Check

**Current (No Check)**:
```html
<button
  mat-icon-button
  color="primary"
  (click)="addAsset()"
  [matTooltip]="'threatModels.tooltips.addAsset' | transloco"
  [attr.aria-label]="'threatModels.tooltips.addAsset' | transloco"
>
  <mat-icon>add</mat-icon>
</button>
```

**Updated (With Permission Check)**:
```html
@if (canEdit) {
  <button
    mat-icon-button
    color="primary"
    (click)="addAsset()"
    [matTooltip]="'threatModels.tooltips.addAsset' | transloco"
    [attr.aria-label]="'threatModels.tooltips.addAsset' | transloco"
  >
    <mat-icon>add</mat-icon>
  </button>
}
@if (!canEdit) {
  <button
    mat-icon-button
    disabled
    [matTooltip]="'common.readOnlyMode' | transloco"
    [attr.aria-label]="'common.readOnlyMode' | transloco"
  >
    <mat-icon>add</mat-icon>
  </button>
}
```

### Example 2: Form Field with Conditional Disabling

**Current (Form disabled via updateFormEditability())**:
```html
<mat-form-field appearance="outline" class="full-width">
  <mat-label [transloco]="'threatModels.name'">Name</mat-label>
  <input
    matInput
    formControlName="name"
    tabindex="1"
    (blur)="onFieldBlur('name', $event)"
  />
</mat-form-field>
```

**Updated (Explicit Conditional)**:
```html
<mat-form-field appearance="outline" class="full-width">
  <mat-label [transloco]="'threatModels.name'">Name</mat-label>
  <input
    matInput
    formControlName="name"
    tabindex="1"
    [disabled]="!canEdit"
    (blur)="onFieldBlur('name', $event)"
  />
</mat-form-field>
```

### Example 3: Delete Button with Permission Check

**Current (No Check)**:
```html
<button
  mat-icon-button
  color="warn"
  (click)="deleteAsset(asset, $event)"
  [matTooltip]="'common.delete' | transloco"
  [attr.aria-label]="'common.delete' | transloco"
>
  <mat-icon>delete</mat-icon>
</button>
```

**Updated (With Permission Check)**:
```html
@if (canEdit) {
  <button
    mat-icon-button
    color="warn"
    (click)="deleteAsset(asset, $event)"
    [matTooltip]="'common.delete' | transloco"
    [attr.aria-label]="'common.delete' | transloco"
  >
    <mat-icon>delete</mat-icon>
  </button>
}
@if (!canEdit) {
  <button
    mat-icon-button
    disabled
    [matTooltip]="'common.readOnlyMode' | transloco"
  >
    <mat-icon>delete</mat-icon>
  </button>
}
```

### Example 4: List Item Click Behavior

**Current (Always clickable)**:
```html
<mat-list-item
  *ngFor="let asset of threatModel.assets"
  class="asset-item clickable"
  (click)="editAsset(asset, $event)"
>
  <!-- content -->
</mat-list-item>
```

**Updated (Conditional)**:
```html
<mat-list-item
  *ngFor="let asset of threatModel.assets"
  class="asset-item"
  [class.clickable]="canEdit"
  (click)="canEdit && editAsset(asset, $event)"
>
  <!-- content -->
</mat-list-item>
```

### Example 5: Chip Input with Permission Control

**Current (Always enabled)**:
```html
<div class="status-chips-container">
  <mat-chip-grid #statusChipGrid>
    @for (status of threatModelForm.get('status')?.value; track status) {
      <mat-chip-row (removed)="removeStatus(status)">
        {{ status }}
        <button matChipRemove [attr.aria-label]="'Remove ' + status">
          <mat-icon>cancel</mat-icon>
        </button>
      </mat-chip-row>
    }
  </mat-chip-grid>
  <input
    placeholder="{{ 'threatModels.statusChipPlaceholder' | transloco }}"
    [matChipInputFor]="statusChipGrid"
    [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
    (matChipInputTokenEnd)="addStatus($event)"
  />
</div>
```

**Updated (With read-only mode)**:
```html
<div class="status-chips-container">
  <mat-chip-grid #statusChipGrid [disabled]="!canEdit">
    @for (status of threatModelForm.get('status')?.value; track status) {
      <mat-chip-row [disabled]="!canEdit">
        {{ status }}
        @if (canEdit) {
          <button matChipRemove [attr.aria-label]="'Remove ' + status">
            <mat-icon>cancel</mat-icon>
          </button>
        }
      </mat-chip-row>
    }
  </mat-chip-grid>
  @if (canEdit) {
    <input
      placeholder="{{ 'threatModels.statusChipPlaceholder' | transloco }}"
      [matChipInputFor]="statusChipGrid"
      [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
      (matChipInputTokenEnd)="addStatus($event)"
    />
  }
</div>
```

---

## 2. Component Method Examples

### Example 1: Add Method with Permission Check

**Current (Some methods missing check)**:
```typescript
addRepository(): void {
  const dialogData: RepositoryEditorDialogData = {
    mode: 'create',
  };
  // ... opens dialog
}
```

**Updated (With permission check)**:
```typescript
addRepository(): void {
  if (!this.canEdit) {
    this.logger.warn('Cannot add repository - insufficient permissions');
    return;
  }

  const dialogData: RepositoryEditorDialogData = {
    mode: 'create',
  };
  
  const dialogRef = this.dialog.open(RepositoryEditorDialogComponent, {
    width: '700px',
    data: dialogData,
  });
  
  // ... rest of method
}
```

### Example 2: Edit Method with Permission Check

**Current (No check)**:
```typescript
editAsset(asset: Asset, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  const dialogData: AssetEditorDialogData = {
    mode: 'edit',
    asset: { ...asset },
  };
  
  const dialogRef = this.dialog.open(AssetEditorDialogComponent, {
    width: '600px',
    maxHeight: '90vh',
    data: dialogData,
  });
  
  // ... rest of method
}
```

**Updated (With permission check)**:
```typescript
editAsset(asset: Asset, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  if (!this.canEdit) {
    this.logger.warn('Cannot edit asset - insufficient permissions');
    return;
  }

  const dialogData: AssetEditorDialogData = {
    mode: 'edit',
    asset: { ...asset },
  };
  
  const dialogRef = this.dialog.open(AssetEditorDialogComponent, {
    width: '600px',
    maxHeight: '90vh',
    data: dialogData,
  });
  
  // ... rest of method
}
```

### Example 3: Delete Method with Permission Check

**Current (No check)**:
```typescript
deleteDocument(document: Document, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  if (!this.threatModel || !this.threatModel.documents) {
    return;
  }

  const confirmMessage = this.transloco.translate('common.confirmDelete', {
    item: this.transloco.translate('common.objectTypes.documents').toLowerCase(),
    name: document.name,
  });
  const confirmDelete = window.confirm(confirmMessage);

  if (confirmDelete) {
    // ... API call
  }
}
```

**Updated (With permission check)**:
```typescript
deleteDocument(document: Document, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  if (!this.threatModel || !this.threatModel.documents || !this.canEdit) {
    if (!this.canEdit) {
      this.logger.warn('Cannot delete document - insufficient permissions');
    }
    return;
  }

  const confirmMessage = this.transloco.translate('common.confirmDelete', {
    item: this.transloco.translate('common.objectTypes.documents').toLowerCase(),
    name: document.name,
  });
  const confirmDelete = window.confirm(confirmMessage);

  if (confirmDelete) {
    // ... API call
  }
}
```

### Example 4: Metadata Dialog with Read-Only Mode

**Current (Some dialogs missing isReadOnly)**:
```typescript
openDocumentMetadataDialog(document: Document, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  const dialogData: MetadataDialogData = {
    metadata: document.metadata || [],
    isReadOnly: false,  // Always editable - WRONG!
    objectType: 'Document',
    objectName: `${this.transloco.translate('common.objectTypes.document')}: ${document.name} (${document.id})`,
  };

  const dialogRef = this.dialog.open(MetadataDialogComponent, {
    width: '90vw',
    maxWidth: '800px',
    minWidth: '500px',
    maxHeight: '80vh',
    data: dialogData,
  });

  // ... rest of method
}
```

**Updated (With proper read-only mode)**:
```typescript
openDocumentMetadataDialog(document: Document, event: Event): void {
  event.stopPropagation();
  (event.target as HTMLElement)?.blur();

  const dialogData: MetadataDialogData = {
    metadata: document.metadata || [],
    isReadOnly: !this.canEdit,  // Respect user permissions
    objectType: 'Document',
    objectName: `${this.transloco.translate('common.objectTypes.document')}: ${document.name} (${document.id})`,
  };

  const dialogRef = this.dialog.open(MetadataDialogComponent, {
    width: '90vw',
    maxWidth: '800px',
    minWidth: '500px',
    maxHeight: '80vh',
    data: dialogData,
  });

  // ... rest of method
}
```

### Example 5: Dialog Method with Permission Check

**Current (No check)**:
```typescript
openMetadataDialog(): void {
  if (!this.threatModel) {
    return;
  }

  const dialogData: MetadataDialogData = {
    metadata: this.threatModel.metadata || [],
    isReadOnly: false,  // Should check canEdit
    objectType: 'ThreatModel',
    objectName: `${this.transloco.translate('common.objectTypes.threatModel')}: ${this.threatModel.name} (${this.threatModel.id})`,
  };

  const dialogRef = this.dialog.open(MetadataDialogComponent, {
    width: '90vw',
    maxWidth: '800px',
    minWidth: '500px',
    maxHeight: '80vh',
    data: dialogData,
  });

  // ... rest of method
}
```

**Updated (With permission check)**:
```typescript
openMetadataDialog(): void {
  if (!this.threatModel) {
    return;
  }

  if (!this.canEdit) {
    this.logger.warn('Cannot edit metadata - insufficient permissions');
    return;
  }

  const dialogData: MetadataDialogData = {
    metadata: this.threatModel.metadata || [],
    isReadOnly: !this.canEdit,
    objectType: 'ThreatModel',
    objectName: `${this.transloco.translate('common.objectTypes.threatModel')}: ${this.threatModel.name} (${this.threatModel.id})`,
  };

  const dialogRef = this.dialog.open(MetadataDialogComponent, {
    width: '90vw',
    maxWidth: '800px',
    minWidth: '500px',
    maxHeight: '80vh',
    data: dialogData,
  });

  // ... rest of method
}
```

---

## 3. Dialog Component Examples

### Example: Dialog in Read-Only Mode

**Current (PermissionsDialogComponent pattern)**:
```html
<!-- Subject Type Column -->
<ng-container matColumnDef="subject_type">
  <th mat-header-cell *matHeaderCellDef mat-sort-header>
    {{ 'threatModels.permissionsSubjectType' | transloco }}
  </th>
  <td mat-cell *matCellDef="let auth; let i = index">
    @if (!data.isReadOnly) {
      <mat-form-field class="table-field">
        <mat-select
          [value]="auth.subject_type"
          (selectionChange)="updatePermissionSubjectType(i, $event)"
          [attr.tabindex]="i * 6 + 1"
        >
          <mat-option value="user">
            {{ 'common.subjectTypes.user' | transloco }}
          </mat-option>
          <mat-option value="group">
            {{ 'common.subjectTypes.group' | transloco }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    }
    @if (data.isReadOnly) {
      <span>{{ 'common.subjectTypes.' + auth.subject_type | transloco }}</span>
    }
  </td>
</ng-container>
```

**Key Pattern to Apply**: 
- Check `data.isReadOnly` in template conditionals
- Show read-only text when `isReadOnly` is true
- Show editable controls when `isReadOnly` is false

### Example: Threat Editor Dialog Mode

**Current (Already implements modes)**:
```typescript
export interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';  // View mode for read-only
  // ... other fields
}

export class ThreatEditorDialogComponent {
  isViewOnly: boolean = false;  // Set based on mode
  
  // In ngOnInit
  if (this.data.mode === 'view') {
    this.isViewOnly = true;
    this.threatForm.disable();  // Disable all form controls
  }
}
```

**This pattern should be extended to other dialogs**

---

## 4. CSS Classes for Read-Only Visual Indicators

### Example: Add Visual Indicators

```scss
// In tm-edit.component.scss

// Add this class to read-only form fields
.read-only-field {
  .mat-mdc-form-field {
    opacity: 0.7;
    background-color: rgba(0, 0, 0, 0.02);
  }
}

// Add this class to disabled buttons
.disabled-button {
  cursor: not-allowed;
  opacity: 0.5;
}

// Add read-only mode indicator
.read-only-indicator {
  display: inline-block;
  padding: 4px 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  margin-left: 8px;
  color: #666;
}

// List items that shouldn't be clickable
.asset-item:not(.clickable) {
  cursor: default;
  
  &:hover {
    background-color: inherit;
  }
}
```

---

## 5. Translation Keys to Add

```typescript
// Add these to i18n translation files

{
  "common": {
    "readOnlyMode": "Read-only mode",
    "insufficientPermissions": "You do not have permission to perform this action",
    "readerAccessOnly": "Reader access only",
    "editAccessRequired": "Edit access required to perform this action"
  }
}
```

---

## 6. Logger Examples

```typescript
// Permission denial logging patterns

// In components
if (!this.canEdit) {
  this.logger.warn('User does not have permission to create assets', {
    userId: this.authService.userId,
    threatModelId: this.threatModel?.id,
    userRole: this.authorizationService.getCurrentUserPermission(),
  });
  return;
}

// For audit trail
this.logger.info('User attempted to edit read-only resource', {
  userId: this.authService.userId,
  threatModelId: this.threatModel?.id,
  action: 'edit_asset',
  resourceId: asset.id,
  timestamp: new Date().toISOString(),
});
```

---

## 7. Testing Examples

### Example: Unit Test for Permission Checks

```typescript
describe('TmEditComponent - Permission Checks', () => {
  let component: TmEditComponent;
  let fixture: ComponentFixture<TmEditComponent>;
  let authService: ThreatModelAuthorizationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TmEditComponent],
      providers: [
        { provide: ThreatModelAuthorizationService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TmEditComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(ThreatModelAuthorizationService);
  });

  describe('Reader Role', () => {
    beforeEach(() => {
      component.canEdit = false;
      fixture.detectChanges();
    });

    it('should disable add asset button', () => {
      const addButton = fixture.debugElement.query(
        By.css('button[mat-icon-button]:has(mat-icon:contains("add"))')
      );
      expect(addButton.nativeElement.disabled).toBe(true);
    });

    it('should prevent addAsset method execution', () => {
      component.addAsset();
      expect(component.threatModel.assets.length).toBe(0);
    });

    it('should show read-only indicator on buttons', () => {
      const disabledButton = fixture.debugElement.query(
        By.css('button[disabled]')
      );
      expect(disabledButton).toBeTruthy();
    });
  });

  describe('Writer Role', () => {
    beforeEach(() => {
      component.canEdit = true;
      fixture.detectChanges();
    });

    it('should enable add asset button', () => {
      const addButton = fixture.debugElement.query(
        By.css('button[mat-icon-button]:has(mat-icon:contains("add"))')
      );
      expect(addButton.nativeElement.disabled).toBe(false);
    });

    it('should allow addAsset execution', () => {
      // ... test that asset can be added
    });
  });
});
```

---

## Summary

The implementation follows these key patterns:

1. **Template**: Use `@if (canEdit)` to show/hide action buttons
2. **Component**: Add `if (!this.canEdit) return;` guards at method entry
3. **Dialogs**: Pass `isReadOnly: !this.canEdit` to dialog data
4. **Forms**: Use `[disabled]="!canEdit"` on inputs
5. **User Feedback**: Show tooltips and visual indicators for read-only state

All changes should be preceded by permission checks to ensure readers cannot perform mutations, even if they somehow bypass the UI.
