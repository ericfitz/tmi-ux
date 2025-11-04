# TM-Edit Page: Quick Reference Guide

## File Locations

| Component | Path |
|-----------|------|
| Main Component | `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/tm-edit/tm-edit.component.ts` |
| Template | `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/tm-edit/tm-edit.component.html` |
| Styles | `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/tm-edit/tm-edit.component.scss` |
| Auth Service | `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts` |

## Key Component Properties

```typescript
canEdit: boolean                    // Can user edit/modify content?
canManagePermissions: boolean       // Is user owner?
threatModel: ThreatModel            // Current threat model data
threatModelForm: FormGroup          // Reactive form for details card
```

## Authorization Service

### Observables
```typescript
authorization$: Observable<Authorization[] | null>
currentUserPermission$: Observable<'reader' | 'writer' | 'owner' | null>
canEdit$: Observable<boolean>                      // writer OR owner
canManagePermissions$: Observable<boolean>         // owner only
```

### Methods
```typescript
setAuthorization(threatModelId, authorization)    // Set for threat model
getCurrentUserPermission(): 'reader' | 'writer' | 'owner' | null
canEdit(): boolean
canManagePermissions(): boolean
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Create, read, update, delete, manage permissions |
| **Writer** | Create, read, update (except delete) |
| **Reader** | Read only |

## Main Methods Needing Permission Checks

### Add Methods (Line Numbers)
- `addThreat()` - 559 ❌
- `addAsset()` - 2762 ✓
- `addNote()` - 1429 ✓
- `addDiagram()` - 848 ✓
- `addDocument()` - 1067 ✓
- `addRepository()` - 1220 ❌

### Edit Methods
- `editAsset()` - 2807 ❌
- `editNote()` - 1529 ❌
- `editDocument()` - 1115 ❌
- `editRepository()` - 1266 ❌

### Delete Methods
- `deleteThreat()` - 810 ❌
- `deleteAsset()` - ❌ (method doesn't exist)
- `deleteNote()` - 1600 ✓
- `deleteDiagram()` - 1016 ✓
- `deleteDocument()` - 1168 ❌
- `deleteRepository()` - ❌ (method doesn't exist)

### Dialog Methods Needing isReadOnly
- `openMetadataDialog()` - 1804 ❌
- `openDiagramMetadataDialog()` - ❌
- `openAssetMetadataDialog()` - ❌
- `openThreatMetadataDialog()` - ❌
- `openDocumentMetadataDialog()` - 1678 ❌
- `openNoteMetadataDialog()` - 1632 ✓
- `openRepositoryMetadataDialog()` - ❌

## Permission Check Pattern

```typescript
// Copy this pattern to all methods that mutate data
if (!this.canEdit) {
  this.logger.warn('Cannot perform action - insufficient permissions');
  return;
}
```

## Template Button Pattern

```html
<!-- Recommended pattern for all action buttons -->
@if (canEdit) {
  <button (click)="action()">
    <!-- normal button -->
  </button>
}
@if (!canEdit) {
  <button disabled [matTooltip]="'common.readOnlyMode' | transloco">
    <!-- disabled button for visual consistency -->
  </button>
}
```

## Dialog Data Interfaces

```typescript
interface PermissionsDialogData {
  permissions: Authorization[];
  owner: string;
  isReadOnly?: boolean;
}

interface MetadataDialogData {
  metadata: Metadata[];
  isReadOnly: boolean;  // Must set based on canEdit
  objectType: string;
  objectName: string;
}

interface AssetEditorDialogData {
  asset?: Asset;
  mode: 'create' | 'edit';
}

interface ThreatEditorDialogData {
  threat?: Threat;
  mode: 'create' | 'edit' | 'view';  // 'view' = read-only
}
```

## Related Services

| Service | Purpose |
|---------|---------|
| `ThreatModelAuthorizationService` | Permission calculation & tracking |
| `ThreatModelService` | API calls for threat model data |
| `AuthService` | User authentication & profile |
| `TranslocoService` | i18n translation |
| `LoggerService` | Application logging |

## Collection Cards

| Card | Add Button | Item Count | Actions |
|------|-----------|-----------|---------|
| Assets | addAsset() | assets.length | Metadata, Edit, Delete |
| Threats | addThreat() | threats.length | Metadata, Delete |
| Diagrams | addDiagram() | diagrams.length | Metadata, Rename, Delete |
| Notes | addNote() | notes.length | Metadata, Edit, Delete |
| Documents | addDocument() | documents.length | Metadata, Delete |
| Repositories | addRepository() | repositories.length | Metadata, Delete |

## Form Fields

| Field | Type | Validation | FormControl |
|-------|------|-----------|-------------|
| Name | Text | Required, max 100 | `name` |
| Description | Textarea | Max 500 | `description` |
| Framework | Select | Required | `threat_model_framework` |
| Issue URI | URL Input | URL format | `issue_uri` |
| Status | Chips | - | `status` |

## Template Sections to Update

### High Priority
1. Lines 13-41: Header buttons (Download, Report, Close) - Check if mutation
2. Lines 50-68: Details card header buttons (Metadata, Permissions)
3. Lines 251-259: Assets add button
4. Lines 352-359: Threats add button
5. Lines 443-450: Diagrams add button
6. Lines 539-547: Notes add button
7. Lines 612-619: Documents add button
8. Lines 688-695: Repositories add button
9. Lines 306-333: Asset action buttons (Metadata, Edit, Delete)
10. Lines 407-424: Threat action buttons (Metadata, Delete)

### Medium Priority
11. Lines 496-520: Diagram action buttons (Metadata, Rename, Delete)
12. Lines 567-593: Note action buttons (Metadata, Edit, Delete)
13. Lines 652-669: Document action buttons (Metadata, Delete)
14. Lines 728-745: Repository action buttons (Metadata, Delete)

## Logger Usage

```typescript
// Log permission denials
this.logger.warn('Cannot perform action - insufficient permissions', {
  userId: this.authService.userId,
  threatModelId: this.threatModel?.id,
  userRole: this.authorizationService.getCurrentUserPermission(),
  action: 'method_name'
});

// Log successful permission-gated operations
this.logger.info('User performed permitted action', {
  userId: this.authService.userId,
  action: 'edit_asset',
  resourceId: asset.id
});
```

## Testing Checklist

For each permission-gated method:
- [ ] Test with reader role (should be blocked)
- [ ] Test with writer role (should succeed)
- [ ] Test with owner role (should succeed)
- [ ] Verify logger warning logged for readers
- [ ] Verify form controls disabled for readers
- [ ] Verify buttons hidden/disabled for readers

## Translation Keys to Add

```json
{
  "common": {
    "readOnlyMode": "This action is not available in read-only mode",
    "insufficientPermissions": "You do not have permission to perform this action",
    "readerAccessOnly": "You have reader access to this threat model"
  },
  "threatModels": {
    "editAccessRequired": "Edit access is required to perform this action"
  }
}
```

## Component Initialization Flow

```
1. Route resolver loads ThreatModel with authorization array
2. Component ngOnInit() runs
3. Subscribe to authorizationService.canEdit$ (line 366)
4. Subscribe to authorizationService.canManagePermissions$ (line 372)
5. Load threat model data from resolved data (line 351)
6. updateFormEditability() enables/disables form (line 425-431)
7. Form reflects user's permission level
```

## Quick Implementation Checklist

- [ ] Add `if (!this.canEdit) return;` to all add* methods
- [ ] Add `if (!this.canEdit) return;` to all edit* methods
- [ ] Add `if (!this.canEdit) return;` to all delete* methods
- [ ] Add `@if (canEdit)` conditionals to all action buttons
- [ ] Add `isReadOnly: !this.canEdit` to all dialog data calls
- [ ] Update dialog templates to respect isReadOnly
- [ ] Add tooltips explaining read-only status
- [ ] Test with reader/writer/owner roles
- [ ] Run linter and format checks
- [ ] Run unit tests
- [ ] Verify no console errors

## Useful Grep Commands

```bash
# Find all methods with permission checks
grep -n "!this.canEdit" tm-edit.component.ts

# Find all dialog opens
grep -n "this.dialog.open" tm-edit.component.ts

# Find all button elements
grep -n "mat-icon-button\|mat-button" tm-edit.component.html

# Find all form controls
grep -n "formControlName=" tm-edit.component.html
```

---

**Last Updated**: 2025-11-03
**Files**: 
- TM_EDIT_READONLY_ANALYSIS.md (detailed analysis)
- TM_EDIT_IMPLEMENTATION_EXAMPLES.md (code examples)
- TM_EDIT_QUICK_REFERENCE.md (this file)
