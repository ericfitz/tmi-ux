# Architecture TODO List

This document outlines the completed and remaining architectural improvements for the TMI-UX application.

## Summary of Major Achievements (2025-09-05)

### 🎯 Standalone Component Migration
- ✅ Migrated entire application to Angular standalone components
- ✅ Eliminated all NgModules (except third-party)
- ✅ Implemented reusable import constants for tree-shaking
- ✅ Achieved better bundle organization and optimization

### 🏗️ Architecture Improvements
- ✅ Fixed circular dependencies with abstraction layer
- ✅ Implemented clean architecture principles
- ✅ Created comprehensive architecture documentation
- ✅ Added automated architecture validation with ESLint

### 📚 Documentation Overhaul
- ✅ Created Architecture Decision Records (ADRs)
- ✅ Consolidated duplicate documentation
- ✅ Organized documentation with clear navigation
- ✅ Updated all docs to reflect current implementation

### 🔧 Code Quality
- ✅ Standardized file naming conventions
- ✅ Configured ESLint for unused imports
- ✅ Created barrel exports for better organization
- ✅ Updated test infrastructure for standalone components

## ✅ Completed Tasks

### Phase 1 & 2 (Completed 2025-09-05)
- [x] **Phase 1.1**: Remove duplicate service providers from DfdComponent
- [x] **Phase 1.2**: Document service provisioning standards
- [x] **Phase 2.1**: Create abstraction layer for collaboration notifications
- [x] **Phase 2.2**: Fix circular dependencies between core and feature services
- [x] **Phase 2.3**: Implement interface-based service abstraction

### Phase 3: Standalone Migration (Completed 2025-09-05)

- [x] **Phase 3.1**: Create Shared Import Constants
  - Created `src/app/shared/imports.ts` with reusable import constants
  - Added TypeScript path mapping (`@app/*`) to tsconfig.json
  - Created documentation in `src/app/shared/IMPORT_CONSTANTS.md`
  - Added barrel export in `src/app/shared/index.ts`
  
- [x] **Phase 3.2**: Migrate Components to Specific Imports
  - Migrated all standalone components from SharedModule/MaterialModule
  - Updated: About, Privacy, TOS, Footer, TM, Home, Navbar, UserPreferences, DFD
  - Updated all TM dialogs: Metadata, Threats, Permissions, TmEdit
  - Build and lint pass successfully

- [x] **Phase 3.3**: Convert Remaining Modules to Standalone
  - Removed HomeModule, AboutModule, PrivacyModule, TosModule (components already standalone)
  - Converted TmRoutingModule to TM_ROUTES configuration
  - Updated app.routes.ts to use route configurations instead of modules
  - Removed CoreModule (components already standalone)
  - Removed AuthModule (interceptors already provided in app.config.ts)

- [x] **Phase 3.4**: Remove Module Files
  - Deleted all empty `*.module.ts` files
  - Removed SharedModule completely
  - Removed MaterialModule and all sub-modules (core, form, data, feedback)
  - Removed all routing modules in favor of route configurations
  - All modules successfully eliminated from the codebase

### Implementation Notes
- **Import Constants Created**:
  - `COMMON_IMPORTS`: CommonModule, FormsModule, ReactiveFormsModule, RouterModule
  - `CORE_MATERIAL_IMPORTS`: Button, Icon, Toolbar, Menu, Tooltip, Divider
  - `FORM_MATERIAL_IMPORTS`: FormField, Input, Select, Checkbox, Radio, SlideToggle
  - `DATA_MATERIAL_IMPORTS`: Table, Paginator, Sort, Card, List, GridList, Badge
  - `FEEDBACK_MATERIAL_IMPORTS`: ProgressSpinner, SnackBar, Dialog
  - Pre-configured combinations: `COMMON_STANDALONE_IMPORTS`, `DATA_DISPLAY_IMPORTS`, `DIALOG_IMPORTS`

- **Path Mapping**: Added `@app/*` alias pointing to `src/app/*` for cleaner imports

- **Bundle Size**: Initial total remains at ~1.13 MB (267.70 kB transfer size)
  - Tree-shaking benefits will be more apparent in production builds
  - Individual lazy chunks show better optimization

### Phase 4: Architecture Documentation (Completed 2025-09-05)

- [x] **Phase 4.1**: Create Architecture Decision Records (ADRs)
  - Created ADR-001: Adopt Angular Standalone Components
  - Created ADR-002: Service Provisioning Patterns
  - Created ADR-003: Abstraction Layer for Cross-Cutting Concerns
  - Created ADR-004: WebSocket Communication Patterns
  - Created ADR index with navigation

- [x] **Phase 4.2**: Create Developer Guidelines
  - Created comprehensive `docs/ARCHITECTURE.md` with all sections
  - Updated `CLAUDE.md` to reference architecture documentation
  - Documented layer boundaries, dependency rules, and patterns

- [x] **Phase 4.3**: Implement Architecture Validation
  - Added ESLint rules for architecture boundaries
  - Created `docs/ARCHITECTURE_VALIDATION.md` guide
  - Configured import restrictions for core and domain layers

- [x] **Phase 4.4**: Centralize and Organize Documentation
  - Created comprehensive documentation index in `docs/README.md`
  - Updated main `README.md` with documentation section
  - Organized documentation by audience and topic

- [x] **Phase 4.5**: Remove Duplicate Content
  - Consolidated WebSocket documentation into `WEBSOCKET_COLLABORATION.md`
  - Merged X6 documentation into `X6_COMPLETE_GUIDE.md`
  - Archived old duplicate files
  - Updated CLAUDE.md to reference consolidated docs

- [x] **Phase 4.6**: Update Documentation Currency
  - Updated ARCHITECTURE_TODO.md with completion status
  - Verified all documentation reflects current implementation
  - Added cross-references between related documents

## 📋 Remaining Tasks

### Phase 5: Additional Architectural Improvements (Low Priority)

#### 5.1 Improve Error Handling
- [ ] Create centralized error handling service
- [ ] Implement consistent error boundaries
- [ ] Standardize error notification patterns

#### 5.2 State Management Review
- [ ] Evaluate if RxJS subjects are sufficient or if NgRx is needed
- [ ] Document state management patterns
- [ ] Create guidelines for when to use component vs service state

#### 5.3 Performance Optimizations
- [ ] Implement lazy loading for all feature modules
- [ ] Add preload strategies for critical routes
- [ ] Optimize change detection strategies
- [ ] Review and optimize RxJS subscription patterns

## ✅ Post-Migration Improvements (Completed 2025-09-05)

### Steps 1-5: Code Quality and Organization
- [x] **Step 1**: Remove unused imports and configure ESLint
  - Configured ESLint with eslint-plugin-unused-imports
  - Added rules to automatically catch and remove unused imports
  
- [x] **Step 2**: Standardize file naming conventions
  - Renamed service files to follow .service.ts convention
  - Created comprehensive NAMING_CONVENTIONS.md documentation
  - Updated imports across the codebase
  
- [x] **Step 3**: Verify bundle size improvements
  - Created BUNDLE_SIZE_ANALYSIS.md with detailed metrics
  - Initial bundle: 1.13 MB (267.70 kB compressed)
  - Tree-shaking now enabled for all components
  
- [x] **Step 4**: Update component tests for new imports
  - Updated test harness to support standalone components
  - All 823 tests passing successfully
  
- [x] **Step 5**: Code organization (interfaces, services, barrel exports)
  - Created barrel exports for core services
  - Created barrel exports for auth services and guards
  - Created barrel exports for DFD domain value objects

## 🎯 Quick Wins (Can be done immediately)

1. **Additional code organization**
   - [ ] Create barrel exports for remaining feature modules
   - [ ] Move shared interfaces to core/interfaces
   - [ ] Group related utilities in sub-folders

## 🚨 Technical Debt to Address

1. **Architecture Violations** (High Priority)
   - Core services importing from feature modules
   - See `docs/ARCHITECTURE_VIOLATIONS.md` for detailed list and resolution plan
   - ApiService → AuthService dependency
   - DfdCollaborationService → AuthService & ThreatModelService dependencies

2. **WebSocket Service Organization**
   - The WebSocket-related services are split between core and DFD
   - Consider creating a dedicated WebSocket module or consolidating in core

3. **Notification Service Duplication**
   - Two notification services exist (shared and DFD-specific)
   - Consider consolidating or clearly separating responsibilities

4. **Test Coverage**
   - Add integration tests for the new abstraction layer
   - Add tests for service provisioning patterns
   - Ensure standalone component migration doesn't break tests

5. **Authorization Service Placement**
   - ThreatModelAuthorizationService might belong in core if used across features
   - Review and relocate if necessary

## 📊 Success Metrics

- [ ] Zero circular dependencies (validate with `madge` or similar tool)
- [ ] All components use standalone API
- [ ] No NgModules except for third-party libraries
- [ ] Clean dependency graph with no upward dependencies
- [ ] All architectural rules pass in CI/CD

## 🔧 Tooling Recommendations

1. **Install architecture validation tools**
   ```bash
   npm install --save-dev madge
   npm install --save-dev dependency-cruiser
   ```

2. **Add scripts to package.json**
   ```json
   {
     "scripts": {
       "architecture:check": "madge --circular src/",
       "architecture:graph": "madge --image graph.svg src/"
     }
   }
   ```

3. **Configure pre-commit hooks**
   - Use husky to run architecture checks
   - Prevent commits that violate architecture rules

## 📅 Suggested Timeline

- **Week 1**: Complete Phase 3 (Standalone Migration)
- **Week 2**: Complete Phase 4 (Documentation)
- **Week 3**: Address quick wins and technical debt
- **Ongoing**: Phase 5 improvements as time permits

## 📝 Notes

- Always run `pnpm test` after architectural changes
- Update documentation as you make changes
- Consider the impact on other developers and CI/CD pipelines
- Prioritize changes that provide immediate value to the development team

## ⚠️ Important Considerations

### Migration Notes
- **Component Testing**: When migrating components to use new import constants, ensure all component tests are updated accordingly
- **Tree Shaking**: The new import pattern enables better tree shaking - monitor bundle sizes after migration
- **IDE Support**: Some IDEs may not auto-import from `@app/shared/imports` - developers might need to manually add imports initially
- **Circular Dependencies**: Be careful not to create circular dependencies when using barrel exports

### Next Steps After Phase 3.2
- **Verify Bundle Size**: Check if the migration has reduced bundle sizes due to better tree shaking
- **Update Developer Onboarding**: Ensure new developers understand the import constant pattern
- **Consider NgModules**: Some third-party libraries still require NgModules - plan for these exceptions
- **Test Coverage**: Ensure migrated components maintain their test coverage

## 🤝 Getting Help

If you need assistance with any of these tasks:
- Review the existing documentation in `/docs`
- Check the service provisioning standards
- Run architecture validation tools to identify issues
- Use the AI assistant to help with complex refactoring