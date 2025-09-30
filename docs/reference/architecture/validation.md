# Architecture Validation Guide

This guide explains how to validate the TMI-UX architecture using automated tools and manual checks.

## Automated Validation

### ESLint Architecture Rules

The project uses ESLint rules to enforce architecture boundaries automatically during development and CI/CD.

#### Running Architecture Validation

```bash
# Run all linting including architecture rules
pnpm run lint:all

# Run only TypeScript/architecture linting
pnpm run lint

# Fix auto-fixable issues
pnpm run lint:all --fix
```

#### Architecture Rules Enforced

1. **Core Layer Isolation**
   - Core services (`src/app/core/**`) cannot import from feature modules
   - Violation example: `import { DfdService } from '../pages/dfd/...'`
   - Solution: Use interfaces in `core/interfaces/` instead

2. **Domain Layer Purity**
   - Domain objects cannot depend on Angular, RxJS, or any framework
   - No dependencies on infrastructure, application, or service layers
   - Violation examples: 
     - Domain service importing `@angular/core`
     - Domain object importing `rxjs` 
     - Domain layer importing from `../infrastructure/*`
   - Solution: Keep domain objects as pure TypeScript classes with business logic only

3. **Import Restrictions**
   - No imports from `*.module` files (use standalone components)
   - No importing entire `@angular/material` library
   - Prefer `@app/shared/imports` over direct `CommonModule` imports

4. **Service Provisioning**
   - Services must follow provisioning standards
   - Root services use `providedIn: 'root'`
   - Feature services provided in components

### Manual Architecture Checks

#### Dependency Flow Validation

1. **Check for Circular Dependencies**
   ```bash
   # Install madge if not already installed
   npm install -g madge

   # Check for circular dependencies
   madge --circular src/
   ```

2. **Generate Dependency Graph**
   ```bash
   # Generate visual dependency graph
   madge --image graph.svg src/
   ```

3. **Verify Layer Boundaries**
   - Core → Should not depend on features
   - Features → Can depend on core
   - Domain → Should have no external dependencies
   - Infrastructure → Can depend on domain and core

#### Service Provisioning Audit

1. **Find Duplicate Providers**
   ```bash
   # Search for services provided multiple times
   grep -r "providers.*Service" src/ | sort | uniq -c | sort -n
   ```

2. **Verify Singleton Services**
   ```bash
   # Check services marked as root providers
   grep -r "providedIn: 'root'" src/app/
   ```

### Pre-commit Validation

To ensure architecture rules are followed before committing:

1. **Install Husky** (if not already installed)
   ```bash
   pnpm add -D husky
   npx husky init
   ```

2. **Add Pre-commit Hook**
   ```bash
   echo "pnpm run lint:all" > .husky/pre-commit
   ```

3. **Add Architecture Check**
   ```bash
   echo "madge --circular src/" >> .husky/pre-commit
   ```

## Common Architecture Violations

### 1. Core Importing from Features
**Violation:**
```typescript
// In core/services/some.service.ts
import { DfdService } from '../../pages/dfd/services/dfd.service';
```

**Fix:**
```typescript
// In core/interfaces/dfd-handler.interface.ts
export interface DfdHandler {
  handleDfdEvent(event: any): void;
}

// In core/services/some.service.ts
import { DfdHandler } from '../interfaces/dfd-handler.interface';

constructor(@Optional() private dfdHandler?: DfdHandler) {}
```

### 2. Domain Depending on Framework
**Violations:**
```typescript
// In domain/services/domain-edge.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { X6GraphAdapter } from '../../infrastructure/adapters/x6-graph.adapter';

@Injectable()
export class DomainEdgeService {
  // Domain services should not use Angular or RxJS
}
```

**Fix:**
```typescript
// Move to application/services/app-edge.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class AppEdgeService {
  // Application services can use Angular and RxJS
}

// Keep domain/value-objects/edge-info.ts pure
export class EdgeInfo {
  // Pure TypeScript class with business logic only
  private constructor(
    public readonly id: string,
    public readonly sourceNodeId: string,
    public readonly targetNodeId: string
  ) {}

  static create(data: EdgeData): EdgeInfo {
    // Pure domain logic
    return new EdgeInfo(data.id, data.sourceNodeId, data.targetNodeId);
  }
}
```

### 3. Using NgModules
**Violation:**
```typescript
// In some.module.ts
@NgModule({
  imports: [CommonModule, MaterialModule],
  declarations: [SomeComponent]
})
export class SomeModule {}
```

**Fix:**
```typescript
// In some.component.ts
@Component({
  selector: 'app-some',
  standalone: true,
  imports: [...COMMON_IMPORTS, MatButtonModule],
  // ...
})
export class SomeComponent {}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Architecture Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run ESLint architecture rules
        run: pnpm run lint:all
        
      - name: Check circular dependencies
        run: npx madge --circular src/
        
      - name: Generate dependency report
        run: npx madge --json src/ > dependency-report.json
        
      - name: Upload dependency report
        uses: actions/upload-artifact@v3
        with:
          name: dependency-report
          path: dependency-report.json
```

## Architecture Metrics

### Track Architecture Health

1. **Circular Dependencies**: Should be 0
2. **Core → Feature imports**: Should be 0
3. **Domain → Framework imports**: Should be 0
4. **Domain → Application/Infrastructure imports**: Should be 0
5. **Domain services with Angular/RxJS dependencies**: Should be 0
6. **Module files**: Should be 0 (except third-party)
7. **Duplicate service providers**: Should be minimized

### Automated Checks
```bash
# Check for domain layer violations
pnpm run lint:all | grep -i "domain.*should.*pure"

# Verify domain directory only contains pure objects
find src/app/**/domain -name "*.service.ts" | wc -l  # Should be 0

# Check for framework imports in domain layer
grep -r "@angular\|rxjs\|@antv" src/app/**/domain/ | grep -v ".spec.ts" | wc -l  # Should be 0
```

### Regular Architecture Reviews

Schedule monthly architecture reviews to:
- Review dependency graphs
- Check for architecture drift
- Update architecture rules as needed
- Document new patterns in ADRs

## Troubleshooting

### ESLint Not Catching Violations

1. Ensure ESLint is configured correctly:
   ```bash
   pnpm run lint -- --debug
   ```

2. Check if file is excluded in `.eslintignore`

3. Verify rule configuration in `eslint.config.js`

### False Positives

If ESLint reports false architecture violations:
1. Review the import path patterns in rules
2. Consider adding exceptions for specific cases
3. Document exceptions in ADRs

### Performance Issues

If linting is slow:
1. Use `--cache` flag: `pnpm run lint -- --cache`
2. Limit scope: `pnpm run lint src/app/core`
3. Run in parallel with other checks

## References

- [ESLint Documentation](https://eslint.org/)
- [Madge - Module Dependency Checker](https://github.com/pahen/madge)
- [Angular Style Guide](https://angular.io/guide/styleguide)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)