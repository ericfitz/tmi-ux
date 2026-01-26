# TM-Edit Page: Quick Reference Guide

<!-- NEEDS-REVIEW: This document was created on 2025-11-03 and contains outdated line number references. Line numbers shift as code evolves; use method names for searches instead. -->

## File Locations

| Component | Path |
|-----------|------|
| Main Component | `src/app/pages/tm/tm-edit.component.ts` |
| Template | `src/app/pages/tm/tm-edit.component.html` |
| Styles | `src/app/pages/tm/tm-edit.component.scss` |
| Auth Service | `src/app/pages/tm/services/threat-model-authorization.service.ts` |

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
setAuthorization(threatModelId, authorization, owner)  // Set for threat model
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

## Main Methods with Permission Checks

<!-- Note: Line numbers are approximate and shift as code evolves. Use grep to find current locations. -->

### Add Methods
| Method | Has Permission Check |
|--------|---------------------|
| `addThreat()` | Yes |
| `addAsset()` | Yes |
| `addNote()` | Yes |
| `addDiagram()` | Yes |
| `addDocument()` | Yes |
| `addRepository()` | Yes |

### Edit Methods
| Method | Has Permission Check |
|--------|---------------------|
| `editAsset()` | Yes (via isReadOnly in dialog) |
| `editNote()` | Yes (via isReadOnly in dialog) |
| `editDocument()` | Yes (via isReadOnly in dialog) |
| `editRepository()` | Yes (via isReadOnly in dialog) |

### Delete Methods
| Method | Has Permission Check |
|--------|---------------------|
| `deleteThreat()` | Yes |
| `deleteAsset()` | Yes |
| `deleteNote()` | Yes |
| `deleteDiagram()` | Yes |
| `deleteDocument()` | Yes |
| `deleteRepository()` | Yes |

### Dialog Methods with isReadOnly
| Method | Has isReadOnly |
|--------|----------------|
| `openMetadataDialog()` | Yes |
| `openDiagramMetadataDialog()` | Yes |
| `openAssetMetadataDialog()` | Yes |
| `openThreatMetadataDialog()` | Yes |
| `openDocumentMetadataDialog()` | Yes |
| `openNoteMetadataDialog()` | Yes |
| `openRepositoryMetadataDialog()` | Yes |

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
  owner: User;
  isReadOnly?: boolean;
  onOwnerChange?: (newOwner: User) => void;
}

interface MetadataDialogData {
  metadata: Metadata[];
  isReadOnly?: boolean;
  objectType?: string;
  objectName?: string;
}

interface AssetEditorDialogData {
  asset?: Asset;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
}

interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';
  isReadOnly?: boolean;
  diagramId?: string;
  cellId?: string;
  diagrams?: DiagramOption[];
  cells?: CellOption[];
  assets?: AssetOption[];
  framework?: FrameworkModel;
  shapeType?: string;
}
```

## Related Services

| Service | Purpose |
|---------|---------|
| `ThreatModelAuthorizationService` | Permission calculation and tracking |
| `ThreatModelService` | API calls for threat model data |
| `AuthService` | User authentication and profile |
| `TranslocoService` | i18n translation |
| `LoggerService` | Application logging |

## Collection Cards

| Card | Add Button | Item Count | Actions |
|------|-----------|-----------|---------|
| Assets | addAsset() | assets.length | Metadata, Edit, Delete |
| Threats | openThreatEditor() | threats.length | Metadata, Delete |
| Diagrams | addDiagram() | diagrams.length | Metadata, Download, Delete |
| Notes | addNote() | notes.length | Download, Metadata, Delete |
| Documents | addDocument() | documents.length | Metadata, Delete |
| Repositories | addRepository() | repositories.length | Metadata, Delete |

## Form Fields

| Field | Type | Validation | FormControl |
|-------|------|-----------|-------------|
| Name | Text | Required, max 100 | `name` |
| Description | Textarea | Max 500 | `description` |
| Framework | Select | Required | `threat_model_framework` |
| Issue URI | URL Input | URL format | `issue_uri` |
| Status | Select | - | `status` |

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
3. Subscribe to authorizationService.canEdit$
4. Subscribe to authorizationService.canManagePermissions$
5. Load threat model data from resolved data
6. updateFormEditability() enables/disables form
7. Form reflects user's permission level
```

## Quick Implementation Checklist

- [x] Add `if (!this.canEdit) return;` to all add* methods
- [x] Add `if (!this.canEdit) return;` to all edit* methods
- [x] Add `if (!this.canEdit) return;` to all delete* methods
- [x] Add `@if (canEdit)` conditionals to all action buttons
- [x] Add `isReadOnly: !this.canEdit` to all dialog data calls
- [x] Update dialog templates to respect isReadOnly
- [x] Add tooltips explaining read-only status
- [ ] Test with reader/writer/owner roles
- [ ] Run linter and format checks
- [ ] Run unit tests
- [ ] Verify no console errors

## Useful Grep Commands

```bash
# Find all methods with permission checks
grep -n "!this.canEdit" src/app/pages/tm/tm-edit.component.ts

# Find all dialog opens
grep -n "this.dialog.open" src/app/pages/tm/tm-edit.component.ts

# Find all button elements
grep -n "mat-icon-button\|mat-button" src/app/pages/tm/tm-edit.component.html

# Find all form controls
grep -n "formControlName=" src/app/pages/tm/tm-edit.component.html
```

---

**Last Updated**: 2025-11-03
**Files**:
- TM_EDIT_READONLY_ANALYSIS.md (detailed analysis)
- TM_EDIT_IMPLEMENTATION_EXAMPLES.md (code examples)
- TM_EDIT_QUICK_REFERENCE.md (this file)

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- File paths: Corrected from absolute paths with subdirectory to relative paths without subdirectory
  - Main component is at src/app/pages/tm/tm-edit.component.ts (not in tm-edit/ subdirectory)
  - Template is at src/app/pages/tm/tm-edit.component.html
  - Styles is at src/app/pages/tm/tm-edit.component.scss
  - Auth service path verified at src/app/pages/tm/services/threat-model-authorization.service.ts
- Authorization service observables: Verified all four observables exist (authorization$, currentUserPermission$, canEdit$, canManagePermissions$)
- Authorization service methods: Verified setAuthorization (note: takes 3 params including owner), getCurrentUserPermission, canEdit, canManagePermissions
- Component properties: Verified canEdit (line 147), canManagePermissions (line 148), threatModel (line 136), threatModelForm (line 137)
- Add methods: All exist - addThreat (770), addAsset (2966), addNote (1531), addDiagram (1030), addDocument (1144), addRepository (1307)
- Edit methods: All exist - editAsset (3054), editNote (1631), editDocument (1195), editRepository (1361)
- Delete methods: All exist - deleteThreat (988), deleteAsset (3097), deleteNote (1650), deleteDiagram (1098), deleteDocument (1249), deleteRepository (1419)
- Dialog methods: All exist with isReadOnly support
- Related files: TM_EDIT_READONLY_ANALYSIS.md and TM_EDIT_IMPLEMENTATION_EXAMPLES.md both exist in docs/analysis/
- Interface definitions: Verified and updated to match current source code

Corrections made:
- Removed absolute paths from file locations table (used relative paths)
- Removed line number references (they become stale as code evolves)
- Updated setAuthorization method signature to show 3 parameters
- Updated PermissionsDialogData to include onOwnerChange callback
- Updated ThreatEditorDialogData to include all current properties
- Changed "deleteAsset - method doesn't exist" to show it now exists
- Changed "deleteRepository - method doesn't exist" to show it now exists
- Updated Collection Cards table to show correct method names (openThreatEditor vs addThreat)
- Updated Collection Cards actions to match current implementation
- Marked implementation checklist items as complete where verified in code
- Updated grep commands to use relative paths
- Changed Status field type from Chips to Select (current implementation)

Items needing review:
- Translation keys: Not verified if these specific keys exist in i18n files
- Testing checklist: Cannot verify without running actual tests
-->
