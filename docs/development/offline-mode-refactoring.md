# Offline Mode Refactoring Plan

## Overview

This document describes the refactoring needed to consolidate the duplicate offline/mock data handling in `threat-model.service.ts`. Currently, the service has two separate mechanisms for handling no-server scenarios that need to be unified into a single "offline mode" concept.

## Background

### Current Problem

The codebase has **duplicate logic** for handling offline/no-server scenarios:

1. **`_useMockData`**: A boolean flag controlled by localStorage, managed via `MockDataService.useMockData$` subscription
2. **`shouldSkipApiCalls`**: A getter that checks `authService.isUsingLocalProvider`

This results in **duplicate if-blocks** throughout the service:
- 39 methods have `if (this._useMockData)` blocks
- 23 methods have `if (this.shouldSkipApiCalls)` blocks
- Many methods have BOTH blocks doing essentially the same thing

### Desired Architecture

**Offline Mode** (standalone application, no server):
- Only local provider authentication available
- Uses mock data from `MockDataService` for demonstration/exploration
- No API calls
- No server connection monitoring
- No collaboration features/websockets
- Download-only persistence (threat models downloaded to desktop)

**Online Mode** (connected to server):
- Server-provided authentication providers (local provider explicitly NOT supported)
- All data loaded from and saved to server
- Collaboration features enabled
- Real-time persistence

### Solution

Consolidate to a single `isOfflineMode` getter that replaces both `_useMockData` and `shouldSkipApiCalls`.

## Implementation Steps

### Phase 1: Infrastructure Cleanup

**File:** `src/app/pages/tm/services/threat-model.service.ts`

#### Step 1.1: Rename the Mode Checker

**Location:** Lines ~135-140

**Change:**
```typescript
// OLD:
private get shouldSkipApiCalls(): boolean {
  return this.authService.isUsingLocalProvider;
}

// NEW:
/**
 * Check if we're in offline mode (standalone with no server)
 * In offline mode: local provider only, mock data, no API calls, no collaboration
 */
private get isOfflineMode(): boolean {
  return this.authService.isUsingLocalProvider;
}
```

#### Step 1.2: Global Rename

**Action:** Replace all occurrences of `shouldSkipApiCalls` with `isOfflineMode` throughout the file
- Use find/replace: `shouldSkipApiCalls` → `isOfflineMode`
- Expected: ~23 replacements

#### Step 1.3: Remove Mock Data Subscription

**Location:** Lines ~84-133 (constructor and fields)

**Remove these fields:**
```typescript
private _useMockData = false;
private _subscription: Subscription | null = null;
```

**Replace constructor:**
```typescript
// OLD:
constructor(
  private apiService: ApiService,
  private logger: LoggerService,
  private mockDataService: MockDataService,
  private authService: AuthService,
  private authorizationService: ThreatModelAuthorizationService,
) {
  // Subscribe to the mock data toggle
  this._subscription = this.mockDataService.useMockData$.subscribe(useMock => {
    this._useMockData = useMock;
    // ... lots of initialization code
  });
}

// NEW:
constructor(
  private apiService: ApiService,
  private logger: LoggerService,
  private mockDataService: MockDataService,
  private authService: AuthService,
  private authorizationService: ThreatModelAuthorizationService,
) {
  this.logger.debugComponent('ThreatModelService', 'ThreatModelService initialized');
}
```

#### Step 1.4: Update ngOnDestroy

**Location:** ~Line 2108

**Change:**
```typescript
// OLD:
ngOnDestroy(): void {
  if (this._subscription) {
    this._subscription.unsubscribe();
    this._subscription = null;
  }
  this._threatModelListSubject.complete();
  this._cachedThreatModels.clear();
}

// NEW:
ngOnDestroy(): void {
  this._threatModelListSubject.complete();
  this._cachedThreatModels.clear();
}
```

#### Step 1.5: Update Log Messages

**Action:** Replace all log messages that say "User logged in with local provider" with "Offline mode"
- Use find/replace: `User logged in with local provider` → `Offline mode`
- Expected: ~20 replacements

#### Step 1.6: Fix Debug Log References

**Find all:** `this._useMockData` in debug/log statements

**Replace with:** `this.isOfflineMode`

Common locations:
- Line ~116: `useMockData: this._useMockData` → `isOfflineMode: this.isOfflineMode`
- Line ~2127: `useMockData: this._useMockData` → `isOfflineMode: this.isOfflineMode`

---

### Phase 2: Consolidate Duplicate Blocks by Entity Type

For each entity type below, the pattern is the same:
1. Find methods with duplicate `if (this._useMockData)` and `if (this.isOfflineMode)` blocks
2. Remove the FIRST block (`if (this._useMockData)`)
3. Keep the SECOND block (`if (this.isOfflineMode)`)
4. **If the second block doesn't use MockDataService**, update it to use MockDataService methods

---

### Phase 2.1: Threat Model List Operations

#### Method: `getThreatModelList()`

**Location:** ~Line 111

**Current state:** Has duplicate blocks

**Action:**
1. Remove the `if (this._useMockData)` block
2. Update the `if (this.isOfflineMode)` block to load mock data:

```typescript
// Keep only this block:
if (this.isOfflineMode) {
  this.logger.info('Offline mode - returning mock threat model list');
  // Load mock threat models from MockDataService
  const mockModels = this.mockDataService.getMockThreatModels();
  this._threatModelList = mockModels.map(tm => this.convertToListItem(tm));
  this._threatModelListSubject.next(this._threatModelList);
  return this._threatModelListSubject.asObservable();
}
```

#### Method: `refreshThreatModelList()`

**Location:** ~Line 147

**Current state:** Has reference to `this._useMockData`

**Action:**
```typescript
// OLD:
refreshThreatModelList(): void {
  if (!this._useMockData && !this.isOfflineMode) {
    this.logger.debugComponent('ThreatModelService', 'Force refreshing threat model list');
    this.fetchThreatModelListFromAPI();
  } else if (this.isOfflineMode) {
    this.logger.info('Offline mode - skipping threat model list refresh');
  }
}

// NEW:
refreshThreatModelList(): void {
  if (this.isOfflineMode) {
    this.logger.info('Offline mode - skipping threat model list refresh');
  } else {
    this.logger.debugComponent('ThreatModelService', 'Force refreshing threat model list');
    this.fetchThreatModelListFromAPI();
  }
}
```

---

### Phase 2.2: Threat Model CRUD Operations

#### Method: `getThreatModelById()`

**Location:** ~Line 222

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block (lines ~222-264)
2. Keep `if (this.isOfflineMode)` block that follows
3. Verify the kept block uses `mockDataService.getMockThreatModelById()` or accesses `_cachedThreatModels`

#### Method: `createThreatModel()`

**Location:** ~Line 498

**Pattern:** Duplicate blocks - both create threat models differently

**Action:**
1. Remove `if (this._useMockData)` block (lines ~498-531)
2. Keep `if (this.isOfflineMode)` block (lines ~534-576)
3. **IMPORTANT:** Update the kept block to use MockDataService:

```typescript
if (this.isOfflineMode) {
  this.logger.info('Offline mode - creating threat model with mock data');

  const now = new Date().toISOString();
  const currentUser = this.authService.userEmail || 'anonymous@example.com';

  // Use MockDataService to create threat model with proper mock data structure
  const newThreatModel = this.mockDataService.createThreatModel({
    id: uuidv4(),
    name,
    description,
    created_at: now,
    modified_at: now,
    owner: currentUser,
    created_by: currentUser,
    threat_model_framework: validFramework,
    issue_url: issueUrl,
    authorization: [
      {
        subject: currentUser,
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: [],
    threats: [],
  });

  // Add to both the list and cache
  const listItem = this.convertToListItem(newThreatModel);
  this._threatModelList.push(listItem);
  this._threatModelListSubject.next([...this._threatModelList]);
  this._cachedThreatModels.set(newThreatModel.id, newThreatModel);

  this.logger.debugComponent('ThreatModelService', 'Created in-memory threat model', {
    id: newThreatModel.id,
    name: newThreatModel.name,
    totalInList: this._threatModelList.length,
  });

  return of(newThreatModel);
}
```

#### Method: `updateThreatModel()`

**Location:** ~Line 663

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `patchThreatModel()`

**Location:** ~Line 830

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `deleteThreatModel()`

**Location:** ~Line 946

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

### Phase 2.3: Threat Operations (Sub-entity)

#### Method: `createThreat()`

**Location:** ~Line 1033

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block
3. Verify the kept block uses `mockDataService.createThreat()` or similar

#### Method: `updateThreat()`

**Location:** ~Line 1105

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `deleteThreat()`

**Location:** ~Line 1165

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

### Phase 2.4: Document Operations (Sub-entity)

#### Method: `getDocumentsForThreatModel()`

**Location:** ~Line 412

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `createDocument()`

**Location:** ~Line 1213

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateDocument()`

**Location:** ~Line 1280

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `deleteDocument()`

**Location:** ~Line 1330

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

### Phase 2.5: Source Code Operations (Sub-entity)

#### Method: `getSourceCodeForThreatModel()`

**Location:** ~Line 451

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `createSource()`

**Location:** ~Line 1378

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateSource()`

**Location:** ~Line 1445

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `deleteSource()`

**Location:** ~Line 1495

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

### Phase 2.6: Diagram Operations (Sub-entity)

#### Method: `getDiagramsForThreatModel()`

**Location:** ~Line 348

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `getDiagramById()`

**Location:** ~Line 385

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `createDiagram()`

**Location:** ~Line 1543

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block (uses `mockDataService.createDiagram()`)
2. Keep `if (this.isOfflineMode)` block
3. **VERIFY:** The kept block properly adds full Diagram objects (not just IDs) to the `threatModel.diagrams` array

#### Method: `patchDiagramCells()`

**Location:** ~Line 1615

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `patchDiagramWithImage()`

**Location:** ~Line 1693

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `deleteDiagram()`

**Location:** ~Line 1754

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block
3. **VERIFY:** The kept block properly filters by `d.id` when working with Diagram objects (not strings)

---

### Phase 2.7: Metadata Operations

#### Method: `getThreatModelMetadata()`

**Location:** ~Line 1804

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateThreatModelMetadata()`

**Location:** ~Line 1821

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `getThreatMetadata()`

**Location:** ~Line 1857

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateThreatMetadata()`

**Location:** ~Line 1881

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `getDiagramMetadata()`

**Location:** ~Line 1920

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateDiagramMetadata()`

**Location:** ~Line 1944

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `getDocumentMetadata()`

**Location:** ~Line 1983

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateDocumentMetadata()`

**Location:** ~Line 2007

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `getSourceMetadata()`

**Location:** ~Line 2046

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `updateSourceMetadata()`

**Location:** ~Line 2070

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

### Phase 2.8: Collaboration Operations

#### Method: `getCollaborationSession()`

**Location:** ~Line 2169

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block
3. **NOTE:** In offline mode, collaboration should be disabled (returns mock/empty session)

#### Method: `createCollaborationSession()`

**Location:** ~Line 2249

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block
3. **NOTE:** In offline mode, collaboration should be disabled (returns mock session)

#### Method: `endCollaborationSession()`

**Location:** ~Line 2279

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

#### Method: `startDiagramCollaboration()`

**Location:** ~Line 2323

**Pattern:** Duplicate blocks

**Action:**
1. Remove `if (this._useMockData)` block
2. Keep `if (this.isOfflineMode)` block

---

## Testing After Each Phase

After completing each phase, run the following:

### 1. Format and Lint
```bash
pnpm run format
pnpm run lint:all
```

### 2. TypeScript Compilation
```bash
npx tsc --noEmit -p tsconfig.json
```
Should have 0 errors.

### 3. Build
```bash
pnpm run build
```
Should complete successfully.

### 4. Unit Tests
```bash
pnpm test -- src/app/pages/tm/services/threat-model.service.spec.ts
```
All tests should pass.

### 5. Manual Testing

**Offline Mode (Local Provider):**
1. Login with local provider
2. Should see mock threat models on dashboard
3. Create a new threat model → should work without API calls
4. Edit threat model → should work without API calls
5. Create diagram → should work without API calls
6. Delete threat model → should work without API calls

**Online Mode (OAuth):**
1. Login with OAuth provider (not local)
2. Should fetch threat models from API
3. All CRUD operations should make API calls
4. Collaboration features should work

---

## Verification Checklist

After completing all phases:

- [ ] No references to `_useMockData` remain in the file
- [ ] No references to `shouldSkipApiCalls` remain in the file
- [ ] All methods use `isOfflineMode` consistently
- [ ] All log messages use "Offline mode" terminology (not "local provider" or "mock data")
- [ ] No duplicate `if (this.isOfflineMode)` blocks exist
- [ ] Offline mode methods use `MockDataService` where appropriate (especially for creating entities)
- [ ] TypeScript compilation has 0 errors
- [ ] All unit tests pass
- [ ] Manual testing confirms both offline and online modes work correctly

---

## Common Patterns

### Pattern 1: Simple Cache-Only Operation

```typescript
// Offline mode: skip API, use cache
if (this.isOfflineMode) {
  this.logger.info('Offline mode - <operation description>');
  const cachedModel = this._cachedThreatModels.get(threatModelId);
  // ... perform operation on cache ...
  return of(result);
}

// Online mode: API call
return this.apiService.<method>(...);
```

### Pattern 2: Create with MockDataService

```typescript
// Offline mode: create with mock data
if (this.isOfflineMode) {
  this.logger.info('Offline mode - creating <entity> with mock data');

  const newEntity = this.mockDataService.create<Entity>({
    id: uuidv4(),
    // ... other properties ...
  });

  // Update cache
  this._cachedThreatModels.set(threatModelId, updatedModel);

  return of(newEntity);
}

// Online mode: API call
return this.apiService.post(...);
```

### Pattern 3: Update Cache-Only

```typescript
// Offline mode: update in cache only
if (this.isOfflineMode) {
  this.logger.info('Offline mode - updating <entity> in cache only');

  const cachedModel = this._cachedThreatModels.get(threatModelId);
  if (cachedModel) {
    // Perform update
    const updated = { ...cachedModel, ...updates };
    this._cachedThreatModels.set(threatModelId, updated);
    return of(updated);
  }
  return of(undefined);
}

// Online mode: API call
return this.apiService.put(...);
```

### Pattern 4: Delete from Cache

```typescript
// Offline mode: delete from cache only
if (this.isOfflineMode) {
  this.logger.info('Offline mode - deleting <entity> from cache only');

  const cachedModel = this._cachedThreatModels.get(threatModelId);
  if (cachedModel && cachedModel.<entities>) {
    const initialLength = cachedModel.<entities>.length;
    cachedModel.<entities> = cachedModel.<entities>.filter(e => e.id !== entityId);
    const wasDeleted = cachedModel.<entities>.length < initialLength;
    if (wasDeleted) {
      cachedModel.modified_at = new Date().toISOString();
      this._cachedThreatModels.set(threatModelId, { ...cachedModel });
    }
    return of(wasDeleted);
  }
  return of(false);
}

// Online mode: API call
return this.apiService.delete(...);
```

---

## Automation Option: Python Script

### Overview

A Python script can automate the removal of duplicate `if (this._useMockData)` blocks, significantly reducing manual work and the risk of human error. The script would process the file methodically, identifying and removing only the first occurrence of duplicate if-blocks while preserving the second occurrence.

### What the Script Would Do

1. **Parse the TypeScript file** into a token/line-based structure
2. **Identify duplicate block patterns** where:
   - An `if (this._useMockData)` block is followed by
   - An `if (this.isOfflineMode)` block (or `if (this.shouldSkipApiCalls)` before renaming)
   - Within the same method scope
3. **Extract the complete first block** including:
   - The if statement
   - The entire block body (respecting brace matching)
   - The closing brace
4. **Remove the first block** while preserving the second
5. **Generate a report** of all changes made for review

### Error Prevention Strategies

The script would include multiple safeguards:

#### 1. Brace Matching Validation
```python
def extract_block(lines, start_line):
    """
    Extract a complete if-block by tracking brace depth.
    Returns (end_line, block_text) or raises error if braces don't match.
    """
    brace_depth = 0
    in_block = False
    block_lines = []

    for i, line in enumerate(lines[start_line:], start=start_line):
        block_lines.append(line)

        # Count braces (ignoring strings and comments)
        for char in line:
            if char == '{':
                brace_depth += 1
                in_block = True
            elif char == '}':
                brace_depth -= 1

        # Block complete when we return to depth 0
        if in_block and brace_depth == 0:
            return i, block_lines

    raise ValueError(f"Unmatched braces starting at line {start_line}")
```

#### 2. Scope Detection
```python
def find_method_boundaries(lines):
    """
    Identify method start/end lines to ensure we only process
    duplicates within the same method.
    Returns list of (method_name, start_line, end_line) tuples.
    """
    # Look for method signatures like:
    # methodName(...): ReturnType {
    # or
    # methodName(
    #   ...
    # ): ReturnType {
```

#### 3. Duplicate Detection Logic
```python
def find_duplicate_blocks(lines, method_boundaries):
    """
    Find all instances where:
    1. 'if (this._useMockData)' appears
    2. Followed by 'if (this.isOfflineMode)' or 'if (this.shouldSkipApiCalls)'
    3. Within the same method scope
    4. With no other code between them (except whitespace/comments)

    Returns list of (first_block_start, first_block_end, second_block_start)
    """
    duplicates = []

    for method_name, method_start, method_end in method_boundaries:
        i = method_start
        while i < method_end:
            line = lines[i].strip()

            # Found potential first block
            if line.startswith('if (this._useMockData)'):
                first_start = i
                first_end, _ = extract_block(lines, i)

                # Look for second block immediately after
                j = first_end + 1
                while j < method_end:
                    next_line = lines[j].strip()

                    # Skip whitespace and comments
                    if not next_line or next_line.startswith('//'):
                        j += 1
                        continue

                    # Check if next significant line is the second if-block
                    if (next_line.startswith('if (this.isOfflineMode)') or
                        next_line.startswith('if (this.shouldSkipApiCalls)')):
                        duplicates.append({
                            'method': method_name,
                            'first_block_start': first_start,
                            'first_block_end': first_end,
                            'second_block_start': j
                        })
                        i = j  # Skip past both blocks
                        break
                    else:
                        # Not a duplicate pattern
                        break

            i += 1

    return duplicates
```

#### 4. Dry-Run Mode
```python
def process_file(input_path, output_path=None, dry_run=True):
    """
    Process the file and optionally write changes.

    Args:
        input_path: Path to threat-model.service.ts
        output_path: Path to write modified file (None = overwrite input)
        dry_run: If True, only report what would be changed
    """
    with open(input_path, 'r') as f:
        lines = f.readlines()

    # Find all duplicates
    method_boundaries = find_method_boundaries(lines)
    duplicates = find_duplicate_blocks(lines, method_boundaries)

    if dry_run:
        print(f"Found {len(duplicates)} duplicate blocks:")
        for dup in duplicates:
            print(f"  - {dup['method']} (lines {dup['first_block_start']}-{dup['first_block_end']})")
        print("\nRun with dry_run=False to apply changes")
        return

    # Remove duplicate blocks (process in reverse to maintain line numbers)
    for dup in reversed(duplicates):
        del lines[dup['first_block_start']:dup['first_block_end'] + 1]

    # Write output
    output_path = output_path or input_path
    with open(output_path, 'w') as f:
        f.writelines(lines)
```

#### 5. Validation After Changes
```python
def validate_output(output_path):
    """
    Validate the modified file:
    1. Check TypeScript syntax (run tsc --noEmit)
    2. Verify no _useMockData references remain
    3. Count remaining isOfflineMode blocks
    4. Ensure brace matching is correct
    """
    import subprocess

    # Check TypeScript compilation
    result = subprocess.run(
        ['npx', 'tsc', '--noEmit', output_path],
        capture_output=True
    )

    if result.returncode != 0:
        print("ERROR: TypeScript compilation failed after changes")
        print(result.stderr.decode())
        return False

    # Check for remaining _useMockData
    with open(output_path, 'r') as f:
        content = f.read()

    if 'this._useMockData' in content:
        print("WARNING: Found remaining _useMockData references")
        return False

    return True
```

### Usage Workflow

```bash
# Step 1: Dry run to see what would be changed
python scripts/consolidate-offline-blocks.py \
  --file src/app/pages/tm/services/threat-model.service.ts \
  --dry-run

# Step 2: Review the output

# Step 3: Create backup
cp src/app/pages/tm/services/threat-model.service.ts \
   src/app/pages/tm/services/threat-model.service.ts.backup

# Step 4: Run for real
python scripts/consolidate-offline-blocks.py \
  --file src/app/pages/tm/services/threat-model.service.ts

# Step 5: Validate
python scripts/consolidate-offline-blocks.py \
  --file src/app/pages/tm/services/threat-model.service.ts \
  --validate

# Step 6: Review diff
git diff src/app/pages/tm/services/threat-model.service.ts

# Step 7: Run tests
pnpm test -- src/app/pages/tm/services/threat-model.service.spec.ts
```

### Script Limitations

The script would NOT handle:

1. **Phase 1 infrastructure changes** - These are unique and require manual editing:
   - Renaming `shouldSkipApiCalls` to `isOfflineMode`
   - Removing constructor subscription
   - Updating `ngOnDestroy`
   - These should be done manually first

2. **Complex nested blocks** - If there are nested if-statements within the mock data block that also check `_useMockData`, the script might get confused

3. **Non-standard formatting** - If braces are on unexpected lines or if there's unusual whitespace, the brace matching might fail

4. **Updating kept blocks** - The script only removes duplicates. If the remaining `isOfflineMode` block needs to be updated to use `MockDataService` methods (like in `createThreatModel`), that would need manual review

5. **Log message updates** - Changing "User logged in with local provider" to "Offline mode" should be done with a simple find/replace either before or after the script

### Recommended Approach with Script

**Option A: Script-First (Recommended)**
1. Manually complete Phase 1 (infrastructure cleanup)
2. Run script to remove all duplicate blocks
3. Manually review output and fix any issues
4. Run tests
5. Manually update any kept blocks that need to use `MockDataService`
6. Run tests again
7. Done

**Option B: Manual-First**
1. Manually complete Phase 1 and Phase 2.1-2.2 (first 2 entity types)
2. Run tests to verify the pattern works
3. Use script for remaining phases 2.3-2.8
4. Run tests
5. Done

**Option C: Fully Manual**
- Use the step-by-step guide in this document
- More time consuming but gives maximum control
- Best if you're uncomfortable with script automation

### Script File Structure

If you choose to create the script, it should be saved as:
```
scripts/consolidate-offline-blocks.py
```

With the following structure:
```python
#!/usr/bin/env python3
"""
Consolidate duplicate offline mode blocks in threat-model.service.ts

This script identifies and removes duplicate if-blocks where:
- if (this._useMockData) is immediately followed by
- if (this.isOfflineMode) or if (this.shouldSkipApiCalls)

Only the first block is removed, keeping the second block.
"""

import argparse
import re
import sys
from typing import List, Tuple, Dict

# ... include all the functions described above ...

def main():
    parser = argparse.ArgumentParser(
        description='Consolidate duplicate offline mode blocks'
    )
    parser.add_argument('--file', required=True, help='Path to threat-model.service.ts')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    parser.add_argument('--validate', action='store_true', help='Validate output file')

    args = parser.parse_args()

    if args.validate:
        if validate_output(args.file):
            print("✓ Validation passed")
            sys.exit(0)
        else:
            print("✗ Validation failed")
            sys.exit(1)
    else:
        process_file(args.file, dry_run=args.dry_run)

if __name__ == '__main__':
    main()
```

### Risk Mitigation

To minimize risk when using the script:

1. **Always commit your work first** - Have a clean git state before running
2. **Always run dry-run first** - Review what will be changed
3. **Always create a backup** - Even though git tracks changes, have an extra copy
4. **Validate incrementally** - After each entity type or section
5. **Review the diff** - Use `git diff` to see exactly what changed
6. **Run tests after each change** - Don't wait until the end
7. **Have the manual guide ready** - If the script fails, fall back to manual process

---

## Notes

1. **Line numbers are approximate** - they will shift as you make edits. Use method names and surrounding code context to locate the correct blocks.

2. **Duplicate blocks are always in sequence** - the `if (this._useMockData)` block is always immediately followed by the `if (this.isOfflineMode)` block.

3. **MockDataService methods** - Use these for creating entities in offline mode:
   - `mockDataService.createThreatModel()`
   - `mockDataService.createDiagram()`
   - `mockDataService.createThreat()`
   - `mockDataService.getMockThreatModels()`
   - `mockDataService.getMockThreatModelById()`

4. **Diagram objects vs IDs** - Be careful with the `diagrams` property on ThreatModel. It should contain full `Diagram[]` objects, not string IDs. This was recently fixed in commit `9e04863`.

5. **Test incrementally** - After each phase, run the tests to catch issues early.

6. **Collaboration** - In offline mode, collaboration features should be disabled/return mock sessions. Do not attempt WebSocket connections.
