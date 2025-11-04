# TMI-UX TM-Edit Page: Read-Only Mode Implementation Guide

## 1. Component Location and Structure

### Main Component
- **Location**: `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/tm-edit/`
- **Files**:
  - `tm-edit.component.ts` - Main component (2,800+ lines)
  - `tm-edit.component.html` - Template (767 lines)
  - `tm-edit.component.scss` - Styles

### Component Class Overview
```typescript
@Component({
  selector: 'app-tm-edit',
  standalone: true,
  imports: [...],
  templateUrl: './tm-edit.component.html',
  styleUrls: ['./tm-edit.component.scss'],
})
export class TmEditComponent implements OnInit, OnDestroy {
  // Key permission properties (lines 133-135)
  canEdit = false;
  canManagePermissions = false;
  
  // Threat model data
  threatModel: ThreatModel | undefined;
  threatModelForm: FormGroup;
  isNewThreatModel = false;
  
  // Other data collections
  _diagrams: Diagram[] = [];
  frameworks: FrameworkModel[] = [];
  // ... more properties
}
```

---

## 2. Authorization & Role-Based Access Control

### Authorization Service
**File**: `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts`

#### Key Features:
- **Reactive Observables**:
  ```typescript
  get currentUserPermission$(): Observable<'reader' | 'writer' | 'owner' | null>
  get canEdit$(): Observable<boolean>                    // writer OR owner
  get canManagePermissions$(): Observable<boolean>       // owner only
  ```

- **Synchronous Methods**:
  ```typescript
  getCurrentUserPermission(): 'reader' | 'writer' | 'owner' | null
  canEdit(): boolean
  canManagePermissions(): boolean
  ```

- **Authorization Data Structure** (`Authorization` interface):
  ```typescript
  export interface Authorization {
    subject: string;              // user email or group ID
    subject_type: 'user' | 'group';
    idp?: string;                 // identity provider
    role: 'reader' | 'writer' | 'owner';
  }
  ```

### User Roles (from `auth.models.ts`)
```typescript
export enum UserRole {
  Owner = 'owner',      // Full control
  Writer = 'writer',    // Can modify but not delete
  Reader = 'reader',    // Read-only access
}
```

### How Roles are Determined in TM-Edit
1. **Initialization** (lines 365-376 in tm-edit.component.ts):
   ```typescript
   // Subscribe to authorization changes
   this._subscriptions.add(
     this.authorizationService.canEdit$.subscribe(canEdit => {
       this.canEdit = canEdit;
       this.updateFormEditability();
     }),
   );
   
   this._subscriptions.add(
     this.authorizationService.canManagePermissions$.subscribe(canManage => {
       this.canManagePermissions = canManage;
     }),
   );
   ```

2. **Authorization Service Calculation** (lines 133-148):
   ```typescript
   private calculateUserPermission(
     authorizations: Authorization[] | null,
   ): 'reader' | 'writer' | 'owner' | null {
     if (!authorizations || authorizations.length === 0) {
       return null;
     }
     
     const currentUserEmail = this.authService.userEmail;
     const userAuth = authorizations.find(auth => auth.subject === currentUserEmail);
     return userAuth?.role || null;
   }
   ```

---

## 3. Input Fields, Buttons, and Dialogs in TM-Edit

### Form Fields (in Threat Model Details Card)

**Main Form** (`threatModelForm`):
1. **Name** (line 136-154)
   - Type: Text input
   - Validation: Required, max 100 characters
   - Form control: `formControlName="name"`

2. **Description** (line 156-171)
   - Type: Textarea
   - Validation: Max 500 characters
   - Form control: `formControlName="description"`

3. **Threat Model Framework** (line 175-200)
   - Type: Mat-select dropdown
   - Options: Loaded from frameworks service
   - Form control: `formControlName="threat_model_framework"`
   - Hint shown when threats exist (disabled hint)

4. **Issue URI** (line 204-237)
   - Type: URL input with icon button to open in new tab
   - Validation: URL format validation
   - Form control: `formControlName="issue_uri"`

5. **Status Chips** (line 101-116)
   - Type: Material chips with input
   - Form control: `formControlName="status"`
   - Can add/remove status values

### Metadata Fields (Display Only)
- Last Modified (date)
- Created By (user)
- Created (date)
- Status Last Updated (date)

### Cards and Collections

#### Assets Card (lines 243-342)
- **Add Button**: (line 251-259) Opens AssetEditorDialogComponent
- **List Items**: Clickable assets showing:
  - Asset name
  - Type icon with tooltip
  - Classification and sensitivity chips
  - Action buttons: Metadata, Edit, Delete

#### Threats Card (lines 344-433)
- **Add Button**: (line 352-359) Opens ThreatEditorDialogComponent
- **List Items**: Clickable threats showing:
  - Severity badge (color-coded)
  - Threat name with tooltip
  - External issue link (if available)
  - Action buttons: Metadata, Delete

#### Diagrams Card (lines 435-529)
- **Add Button**: (line 443-450) Opens CreateDiagramDialogComponent
- **List Items**: Navigable diagrams showing:
  - Diagram name
  - Thumbnail preview (on hover)
  - Action buttons: Metadata, Rename, Delete

#### Notes Card (lines 531-602)
- **Add Button**: (line 539-547) Opens NoteEditorDialogComponent
- **List Items**: Clickable notes showing:
  - Note name
  - Action buttons: Metadata, Edit, Delete

#### Documents Card (lines 604-678)
- **Add Button**: (line 612-619) Opens DocumentEditorDialogComponent
- **List Items**: Clickable documents showing:
  - Document name
  - External link (if available)
  - Action buttons: Metadata, Delete

#### Repositories Card (lines 680-754)
- **Add Button**: (line 688-695) Opens RepositoryEditorDialogComponent
- **List Items**: Clickable repositories showing:
  - Repository name
  - External link
  - Action buttons: Metadata, Delete

### Header Actions
- **Download Button** (line 13-22)
- **Report Button** (line 23-37)
- **Close Button** (line 38-41)

### Card Header Actions
- **Details Card** (line 50-68):
  - Manage Metadata button
  - Permissions button (icon-button with lock)

---

## 4. Existing Read-Only and Permission Checking Patterns

### In TM-Edit Component

#### Permission Checks on Methods
1. **addThreat()** → calls `openThreatEditor()`
   - No explicit canEdit check (relies on dialog)

2. **addNote()** (line 1429-1433)
   ```typescript
   addNote(): void {
     if (!this.canEdit) {
       this.logger.warn('User does not have permission to create notes');
       return;
     }
     // ... open dialog
   }
   ```

3. **addAsset()** (line 2762-2767)
   ```typescript
   addAsset(): void {
     if (!this.canEdit) {
       this.logger.warn('User does not have permission to create assets');
       return;
       }
     // ... open dialog
   }
   ```

4. **addDiagram()** (line 848-852)
   ```typescript
   addDiagram(): void {
     if (!this.canEdit) {
       this.logger.warn('Cannot add diagram - insufficient permissions');
       return;
     }
     // ... open dialog
   }
   ```

5. **addDocument()** (line 1067-1071)
   ```typescript
   addDocument(): void {
     if (!this.canEdit) {
       this.logger.warn('Cannot add document - insufficient permissions');
       return;
     }
     // ... open dialog
   }
   ```

6. **deleteDiagram()** (line 1022-1027)
   ```typescript
   if (!this.threatModel || !this.threatModel.diagrams || !this.canEdit) {
     if (!this.canEdit) {
       this.logger.warn('Cannot delete diagram - insufficient permissions');
     }
     return;
   }
   ```

7. **deleteNote()** (line 1604-1607)
   ```typescript
   if (!this.threatModel || !this.threatModel.notes || !this.canEdit) {
     this.logger.warn('User does not have permission to delete notes');
     return;
   }
   ```

#### Permission-Based Form Control
**updateFormEditability()** (line 425-431)
```typescript
private updateFormEditability(): void {
  if (this.canEdit) {
    this.threatModelForm.enable();
  } else {
    this.threatModelForm.disable();
  }
}
```

### In Dialogs

#### Permissions Dialog (PermissionsDialogComponent)
- **File**: `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts`
- **Interface**: `PermissionsDialogData`
  ```typescript
  export interface PermissionsDialogData {
    permissions: Authorization[];
    owner: string;
    isReadOnly?: boolean;
    onOwnerChange?: (newOwner: string) => void;
  }
  ```
- **Read-Only Pattern** (lines 74-92):
  ```typescript
  @if (!data.isReadOnly) {
    <mat-form-field class="table-field">
      <mat-select [value]="auth.subject_type" ...>
        <!-- editable options -->
      </mat-select>
    </mat-form-field>
  }
  @if (data.isReadOnly) {
    <span>{{ 'common.subjectTypes.' + auth.subject_type | transloco }}</span>
  }
  ```

#### Metadata Dialog (MetadataDialogComponent)
- Uses `isReadOnly: boolean` parameter to show/hide edit controls
- Example from openNoteMetadataDialog (line 1638):
  ```typescript
  const dialogData: MetadataDialogData = {
    metadata: note.metadata || [],
    isReadOnly: !this.canEdit,  // Key pattern
    objectType: 'Note',
    objectName: `...`,
  };
  ```

#### Threat Editor Dialog
- **Mode property**: 'create' | 'edit' | 'view'
- **isViewOnly property** (line 106)
- Determines which controls are displayed based on mode

---

## 5. Full Authorization Model

### Data Flow
```
User Authentication (AuthService)
    ↓
User Email (from JWT)
    ↓
ThreatModel.authorization[] (list of Authorization objects)
    ↓
ThreatModelAuthorizationService (calculates permissions)
    ↓
TmEditComponent (subscribes to canEdit$ and canManagePermissions$)
    ↓
Template (uses canEdit and canManagePermissions for conditional rendering)
```

### Authorization Check Locations in Template
Currently, the template has **NO conditional rendering** based on `canEdit`:
- All buttons are always visible
- Form validation relies on form control disabled state

### Authorization Setup in tm-edit
1. **Resolver provides threat model** with authorization data
2. **ngOnInit subscribes** to authorization service observables
3. **Service calculates** current user's role from email match
4. **Component updates** canEdit property
5. **updateFormEditability()** disables/enables form controls

### Key Authorization Service Methods
```typescript
// Reactive observables
authorization$: Observable<Authorization[] | null>
currentUserPermission$: Observable<'reader' | 'writer' | 'owner' | null>
canEdit$: Observable<boolean>
canManagePermissions$: Observable<boolean>

// Synchronous methods
setAuthorization(threatModelId: string, authorization: Authorization[]): void
updateAuthorization(authorization: Authorization[]): void
clearAuthorization(): void
getCurrentUserPermission(): 'reader' | 'writer' | 'owner' | null
canEdit(): boolean
canManagePermissions(): boolean
```

---

## 6. Implementation Checklist for Read-Only Mode

### Phase 1: Template Changes
- [ ] Add `[disabled]="!canEdit"` to add buttons
- [ ] Conditionally hide add buttons with `@if (canEdit)`
- [ ] Conditionally hide edit/delete buttons with `@if (canEdit)`
- [ ] Conditionally hide delete buttons on all list items

### Phase 2: Component Logic
- [ ] Add permission checks to all add* methods
- [ ] Add permission checks to all delete* methods
- [ ] Add permission checks to edit* methods
- [ ] Add permission checks to open*Dialog methods for mutations

### Phase 3: Dialog Integration
- [ ] Pass `isReadOnly: !this.canEdit` to all dialog data interfaces
- [ ] Update dialog templates to respect read-only mode
- [ ] Disable form submissions in read-only mode

### Phase 4: User Feedback
- [ ] Show tooltips on disabled buttons explaining why
- [ ] Add visual indication of read-only status
- [ ] Log permission denial attempts

---

## 7. Related Files and Services

### Core Services
- **ThreatModelAuthorizationService**: `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts`
- **ThreatModelService**: `/Users/efitz/Projects/tmi-ux/src/app/pages/tm/services/threat-model.service.ts`
- **AuthService**: `/Users/efitz/Projects/tmi-ux/src/app/auth/services/auth.service.ts`

### Dialog Components
- `AssetEditorDialogComponent`
- `ThreatEditorDialogComponent`
- `NoteEditorDialogComponent`
- `DocumentEditorDialogComponent`
- `RepositoryEditorDialogComponent`
- `PermissionsDialogComponent`
- `MetadataDialogComponent`
- `CreateDiagramDialogComponent`
- `RenameDiagramDialogComponent`

### Models
- **Authorization**: Defined in `threat-model.model.ts`
- **ThreatModel**: Includes authorization array
- **UserRole**: Defined in `auth.models.ts`

---

## 8. Key Methods That Need Permission Checks

### Add/Create Methods (HIGH PRIORITY)
- `addThreat()` - (559) No check yet
- `addAsset()` - (2762) Has check
- `addNote()` - (1429) Has check
- `addDiagram()` - (848) Has check
- `addDocument()` - (1067) Has check
- `addRepository()` - (1220) NO CHECK

### Edit Methods (HIGH PRIORITY)
- `editAsset()` - (2807) NO CHECK
- `editNote()` - (1529) NO CHECK
- `editDocument()` - (1115) NO CHECK
- `editRepository()` - (1266) NO CHECK

### Delete Methods (HIGH PRIORITY)
- `deleteAsset()` - NO METHOD YET
- `deleteThreat()` - (810) NO CHECK
- `deleteDiagram()` - (1016) Has check
- `deleteDocument()` - (1168) NO CHECK
- `deleteRepository()` - NO METHOD YET
- `deleteNote()` - (1600) Has check

### Dialog Methods (MEDIUM PRIORITY)
- `openPermissionsDialog()` - (1733) Requires owner role
- `openMetadataDialog()` - (1804) NO CHECK (should check canEdit)
- `openDiagramMetadataDialog()` - NO CHECK (should check canEdit)
- `openAssetMetadataDialog()` - NO CHECK
- `openThreatMetadataDialog()` - NO CHECK
- `openDocumentMetadataDialog()` - NO CHECK (currently isReadOnly: false)
- `openNoteMetadataDialog()` - (1632) Has check: `isReadOnly: !this.canEdit`
- `openRepositoryMetadataDialog()` - NO CHECK

---

## 9. Template Sections Needing Updates

### Form Fields
- Name field
- Description field
- Framework dropdown
- Issue URI field and button
- Status chips (add/remove)

### Card Add Buttons
- Assets card add button
- Threats card add button
- Diagrams card add button
- Notes card add button
- Documents card add button
- Repositories card add button

### List Item Action Buttons
- Asset edit/delete buttons
- Threat delete button
- Diagram rename/delete buttons
- Note edit/delete buttons
- Document delete button
- Repository delete button

### Header Buttons
- Permissions button (should check owner role)
- Metadata button (should check edit role)

---

## Summary

The TMI-UX tm-edit page has a **partial implementation** of read-only mode:
- Authorization service is fully set up and reactive
- Form controls are disabled/enabled based on `canEdit`
- Some add/delete methods have permission checks
- **GAPS**: Template buttons are not conditionally disabled, many methods lack checks

To implement full read-only mode for readers, focus on:
1. Disabling all mutating buttons in the template
2. Adding permission checks to all remaining methods
3. Passing `isReadOnly` to all dialogs
4. Providing user feedback on permission denials
