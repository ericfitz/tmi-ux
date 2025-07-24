# ThreatModel Validation System Usage Guide

## Overview

The ThreatModel validation system provides comprehensive validation for threat model objects, ensuring they conform to the OpenAPI specification and maintain internal consistency. The system is designed to be flexible and extensible, supporting different diagram types and validation requirements.

## Basic Usage

### 1. Service Injection

```typescript
import { ThreatModelValidatorService } from './validation';

@Component({...})
export class ThreatModelComponent {
  constructor(private validator: ThreatModelValidatorService) {}
}
```

### 2. Basic Validation

```typescript
// Validate a complete threat model
const result = this.validator.validate(threatModel);

if (result.valid) {
  console.log('Threat model is valid!');
} else {
  console.log('Validation errors:', result.errors);
  console.log('Warnings:', result.warnings);
}
```

### 3. Schema-Only Validation

```typescript
// Validate only against OpenAPI schema (faster)
const schemaResult = this.validator.validateSchema(threatModel);
```

### 4. Reference-Only Validation

```typescript
// Validate only internal references
const refResult = this.validator.validateReferences(threatModel);
```

## Advanced Configuration

### Custom Validation Rules

```typescript
import { ValidationConfig, FieldValidationRule } from './validation';

const customRules: FieldValidationRule[] = [
  {
    field: 'name',
    required: true,
    type: 'string',
    minLength: 5,
    maxLength: 100,
    pattern: /^[A-Za-z0-9\s-]+$/
  },
  {
    field: 'custom_field',
    required: false,
    customValidator: (value, context) => {
      if (value && !value.startsWith('PREFIX_')) {
        return ValidationUtils.createError(
          'INVALID_PREFIX',
          'Custom field must start with PREFIX_',
          context.currentPath + '.custom_field'
        );
      }
      return null;
    }
  }
];

const config: Partial<ValidationConfig> = {
  includeWarnings: true,
  failFast: false,
  maxErrors: 50,
  customRules
};

const result = this.validator.validate(threatModel, config);
```

### Custom Diagram Validators

```typescript
import { DiagramValidator, ValidationContext, ValidationError } from './validation';

class CustomDiagramValidator implements DiagramValidator {
  diagramType = 'CUSTOM-2.0.0';
  versionPattern = /^CUSTOM-2\.\d+\.\d+$/;

  validate(diagram: any, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Custom diagram validation logic
    if (!diagram.customProperty) {
      errors.push(ValidationUtils.createError(
        'MISSING_CUSTOM_PROPERTY',
        'Custom diagrams must have customProperty',
        ValidationUtils.buildPath(context.currentPath, 'customProperty')
      ));
    }
    
    return errors;
  }

  validateCells(cells: any[], context: ValidationContext): ValidationError[] {
    // Custom cell validation logic
    return [];
  }
}

// Register the custom validator
this.validator.registerDiagramValidator(new CustomDiagramValidator());
```

## Validation Results

### Success Response

```typescript
{
  valid: true,
  errors: [],
  warnings: [],
  metadata: {
    timestamp: '2025-01-01T12:00:00.000Z',
    validatorVersion: '1.0.0',
    duration: 45
  }
}
```

### Error Response

```typescript
{
  valid: false,
  errors: [
    {
      code: 'FIELD_REQUIRED',
      message: "Required field 'name' is missing",
      path: 'name',
      severity: 'error',
      context: {}
    },
    {
      code: 'INVALID_TYPE',
      message: "Field 'id' expected type 'uuid' but got 'string'",
      path: 'id',
      severity: 'error',
      context: {
        expectedType: 'uuid',
        actualType: 'string',
        value: 'invalid-uuid'
      }
    }
  ],
  warnings: [
    {
      code: 'ORPHANED_THREATS',
      message: 'Found 2 threats not associated with any diagram',
      path: 'threats',
      severity: 'info',
      context: {
        orphanedCount: 2,
        totalDiagrams: 3
      }
    }
  ],
  metadata: {
    timestamp: '2025-01-01T12:00:00.000Z',
    validatorVersion: '1.0.0',
    duration: 123
  }
}
```

## Common Validation Scenarios

### 1. Import Validation

```typescript
async importThreatModel(file: File) {
  try {
    const data = JSON.parse(await file.text());
    const result = this.validator.validate(data);
    
    if (!result.valid) {
      // Show validation errors to user
      this.showValidationErrors(result.errors);
      return;
    }
    
    // Proceed with import
    await this.threatModelService.importThreatModel(data);
  } catch (error) {
    console.error('Import failed:', error);
  }
}
```

### 2. Real-time Validation

```typescript
@Component({...})
export class ThreatModelEditComponent {
  private validationSubject = new Subject<any>();
  
  ngOnInit() {
    // Debounced validation
    this.validationSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(threatModel => 
        of(this.validator.validateSchema(threatModel))
      )
    ).subscribe(result => {
      this.validationErrors = result.errors;
      this.validationWarnings = result.warnings;
    });
  }
  
  onThreatModelChange(threatModel: any) {
    this.validationSubject.next(threatModel);
  }
}
```

### 3. Batch Validation

```typescript
async validateMultipleThreatModels(threatModels: any[]) {
  const results = await Promise.all(
    threatModels.map(async (tm, index) => ({
      index,
      name: tm.name,
      result: this.validator.validate(tm)
    }))
  );
  
  const invalid = results.filter(r => !r.result.valid);
  if (invalid.length > 0) {
    console.log(`${invalid.length} of ${threatModels.length} threat models failed validation`);
    invalid.forEach(({ index, name, result }) => {
      console.log(`${name} (${index}):`, result.errors);
    });
  }
  
  return results;
}
```

## Error Codes Reference

### Schema Validation Errors
- `FIELD_REQUIRED`: Required field is missing
- `INVALID_TYPE`: Field type doesn't match expected type
- `INVALID_ENUM_VALUE`: Value is not in allowed enum values
- `MIN_LENGTH_VIOLATION`: String/array is too short
- `MAX_LENGTH_VIOLATION`: String/array is too long
- `PATTERN_MISMATCH`: String doesn't match required pattern

### Reference Validation Errors
- `INVALID_DIAGRAM_REFERENCE`: Threat references non-existent diagram
- `INVALID_CELL_REFERENCE`: Threat references non-existent cell
- `INVALID_THREAT_MODEL_REFERENCE`: Threat has wrong threat_model_id
- `OWNER_NOT_IN_AUTHORIZATION`: Owner not present in authorization list

### Diagram Validation Errors
- `UNSUPPORTED_DIAGRAM_TYPE`: No validator found for diagram type
- `INVALID_CELL`: Cell object is malformed
- `MISSING_CELL_ID`: Cell is missing required ID
- `AMBIGUOUS_CELL_TYPE`: Cell is both vertex and edge
- `DUPLICATE_CELL_IDS`: Multiple cells have same ID
- `INVALID_EDGE_SOURCE`: Edge source references non-existent cell
- `INVALID_EDGE_TARGET`: Edge target references non-existent cell

### System Errors
- `VALIDATION_EXCEPTION`: Internal validation error
- `MAX_ERRORS_EXCEEDED`: Too many errors found

## Performance Considerations

1. **Use schema-only validation** for fast validation during editing
2. **Use full validation** before saving or importing
3. **Debounce validation** in real-time scenarios
4. **Configure maxErrors** to prevent excessive processing
5. **Use failFast** for quick feedback when appropriate

## Extending the System

### Adding New Diagram Types

1. Implement `DiagramValidator` interface
2. Define validation rules for the new type
3. Register the validator with the service
4. The system automatically handles version patterns

### Adding Custom Field Validation

1. Create `FieldValidationRule` objects
2. Include them in validation config
3. Use `customValidator` function for complex logic

### Handling Different OpenAPI Versions

The validation system is designed to be flexible for minor schema changes:
- Use version patterns in diagram validators
- Add conditional validation rules
- Extend base classes for major changes

This validation system provides a robust foundation for ensuring data quality and consistency in threat modeling applications.