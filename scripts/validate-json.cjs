#!/usr/bin/env node

/**
 * JSON Validation Script
 * 
 * This script validates JSON files for both syntactic and structural validity.
 * It can validate individual files or entire directories, with support for
 * custom schema validation and detailed error reporting.
 * 
 * Features:
 * - Syntactic validation (valid JSON format)
 * - Structural validation (schema-based validation)
 * - Batch validation of multiple files
 * - Directory traversal with glob patterns
 * - Custom validation rules
 * - Detailed error reporting with line numbers
 * - Summary statistics
 * 
 * Usage:
 *   node scripts/validate-json.cjs <file-or-pattern>
 *   node scripts/validate-json.cjs "src/assets/i18n/*.json"
 *   node scripts/validate-json.cjs package.json --schema=package-schema.json  
 *   node scripts/validate-json.cjs "src/**\/*.json" --strict
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * ANSI color codes for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Validation result structure
 */
class ValidationResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
    this.fileSize = 0;
    this.parseTime = 0;
  }

  addError(message, line = null, column = null) {
    this.isValid = false;
    this.errors.push({
      message,
      line,
      column,
      type: 'error'
    });
  }

  addWarning(message, line = null, column = null) {
    this.warnings.push({
      message,
      line,
      column,
      type: 'warning'
    });
  }
}

/**
 * JSON Validator class with comprehensive validation capabilities
 */
class JSONValidator {
  constructor(options = {}) {
    this.options = {
      strict: options.strict || false,
      maxDepth: options.maxDepth || 100,
      maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB
      jsonc: options.jsonc || false,
      schema: options.schema || null,
      customValidators: options.customValidators || [],
      ...options
    };
  }

  /**
   * Validate a single JSON file
   */
  async validateFile(filePath) {
    const result = new ValidationResult(filePath);
    const startTime = Date.now();

    try {
      // Read file content directly to avoid TOCTOU race condition
      // If file doesn't exist or can't be read, readFileSync will throw
      // lgtm[js/file-system-race] - single atomic read operation, no separate existence check
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          result.addError(`File not found: ${filePath}`);
        } else if (readError.code === 'EACCES') {
          result.addError(`Permission denied: ${filePath}`);
        } else {
          result.addError(`Error reading file: ${readError.message}`);
        }
        return result;
      }

      // Get file size from content length (avoids separate stat call)
      result.fileSize = Buffer.byteLength(content, 'utf8');

      // Check file size
      if (result.fileSize > this.options.maxSize) {
        result.addError(`File too large: ${this.formatFileSize(result.fileSize)} (max: ${this.formatFileSize(this.options.maxSize)})`);
        return result;
      }

      // Pre-process content if needed
      const processedContent = this.preprocessContent(content, result);

      // Syntactic validation
      let parsedData;
      try {
        parsedData = JSON.parse(processedContent);
      } catch (parseError) {
        this.handleParseError(parseError, content, result);
        return result;
      }

      // Structural validation
      this.validateStructure(parsedData, result);

      // Schema validation
      if (this.options.schema) {
        this.validateSchema(parsedData, this.options.schema, result);
      }

      // Custom validation rules
      this.runCustomValidators(parsedData, result);

      // Additional checks in strict mode
      if (this.options.strict) {
        this.runStrictValidation(parsedData, content, result);
      }

    } catch (error) {
      result.addError(`Validation failed: ${error.message}`);
    }

    result.parseTime = Date.now() - startTime;
    return result;
  }

  /**
   * Preprocess content to handle JSONC format if enabled
   */
  preprocessContent(content, result) {
    if (!this.options.jsonc) {
      return content;
    }

    let processed = content;

    // Remove multi-line comments (/* */ style) - must be done first
    processed = processed.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove single-line comments (// style) more reliably
    // Split by lines and process each line
    const lines = processed.split('\n');
    const processedLines = lines.map(line => {
      // Find // outside of quoted strings
      let inString = false;
      let escaped = false;
      for (let i = 0; i < line.length - 1; i++) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (line[i] === '\\') {
          escaped = true;
          continue;
        }
        if (line[i] === '"') {
          inString = !inString;
          continue;
        }
        if (!inString && line[i] === '/' && line[i + 1] === '/') {
          return line.substring(0, i).trimEnd();
        }
      }
      return line;
    });
    processed = processedLines.join('\n');
    
    // Remove trailing commas before closing brackets/braces
    processed = processed.replace(/,(\s*[}\]])/g, '$1');
    
    // Clean up whitespace issues from comment removal
    processed = processed.replace(/^\s*[\r\n]/gm, ''); // Remove lines that are now empty
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n'); // Collapse excessive newlines
    
    result.addWarning('JSONC format: Comments and trailing commas were processed');

    return processed;
  }

  /**
   * Handle JSON parse errors with detailed reporting
   */
  handleParseError(parseError, content, result) {
    const message = parseError.message;
    
    // Try to extract line and column information
    const match = message.match(/at position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const { line, column } = this.getLineAndColumn(content, position);
      result.addError(`JSON Parse Error: ${message}`, line, column);
      
      // Add context around the error
      const context = this.getErrorContext(content, position);
      if (context) {
        result.addError(`Context: ${context}`);
      }
    } else {
      result.addError(`JSON Parse Error: ${message}`);
    }
  }

  /**
   * Get line and column number from character position
   */
  getLineAndColumn(content, position) {
    const lines = content.substring(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  /**
   * Get context around an error position
   */
  getErrorContext(content, position) {
    const start = Math.max(0, position - 20);
    const end = Math.min(content.length, position + 20);
    const context = content.substring(start, end);
    const marker = ' '.repeat(position - start) + '^';
    return `\n${context}\n${marker}`;
  }

  /**
   * Validate JSON structure (depth, circular references, etc.)
   */
  validateStructure(data, result, depth = 0, visited = new WeakSet()) {
    // Check maximum depth
    if (depth > this.options.maxDepth) {
      result.addError(`Maximum nesting depth exceeded: ${depth} (max: ${this.options.maxDepth})`);
      return;
    }

    // Check for circular references in objects
    if (data && typeof data === 'object' && data !== null) {
      if (visited.has(data)) {
        result.addError('Circular reference detected');
        return;
      }
      visited.add(data);

      // Recursively validate nested structures
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          this.validateStructure(item, result, depth + 1, visited);
        });
      } else {
        Object.values(data).forEach(value => {
          this.validateStructure(value, result, depth + 1, visited);
        });
      }

      visited.delete(data);
    }
  }

  /**
   * Validate against a JSON schema (basic implementation)
   */
  validateSchema(data, schema, result) {
    try {
      // This is a simplified schema validation
      // In a real implementation, you'd use a library like ajv
      if (schema.type && typeof data !== schema.type) {
        result.addError(`Schema validation failed: expected type '${schema.type}', got '${typeof data}'`);
      }

      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(field => {
          if (!(field in data)) {
            result.addError(`Schema validation failed: required field '${field}' is missing`);
          }
        });
      }

      if (schema.properties && typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (schema.properties[key]) {
            this.validateSchema(data[key], schema.properties[key], result);
          }
        });
      }
    } catch (error) {
      result.addError(`Schema validation error: ${error.message}`);
    }
  }

  /**
   * Run custom validation functions
   */
  runCustomValidators(data, result) {
    this.options.customValidators.forEach((validator, index) => {
      try {
        const validationResult = validator(data);
        if (validationResult && !validationResult.valid) {
          result.addError(`Custom validator ${index + 1}: ${validationResult.message}`);
        }
      } catch (error) {
        result.addError(`Custom validator ${index + 1} failed: ${error.message}`);
      }
    });
  }

  /**
   * Run additional strict mode validations
   */
  runStrictValidation(data, content, result) {
    // Check for consistent indentation
    const lines = content.split('\n');
    let expectedIndent = null;
    let indentChar = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;

      const leadingWhitespace = line.match(/^(\s*)/)[1];
      if (leadingWhitespace.length > 0) {
        const currentIndentChar = leadingWhitespace[0];
        
        if (indentChar === null) {
          indentChar = currentIndentChar;
        } else if (indentChar !== currentIndentChar) {
          result.addWarning(`Inconsistent indentation character at line ${index + 1} (mixing tabs and spaces)`);
        }
      }
    });

    // Check for duplicate keys (basic check)
    const contentStr = JSON.stringify(data);
    const duplicateKeyRegex = /"([^"]+)"\s*:/g;
    const keys = [];
    let match;
    
    while ((match = duplicateKeyRegex.exec(contentStr)) !== null) {
      keys.push(match[1]);
    }
    
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      result.addWarning('Potential duplicate keys detected');
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Validate multiple files using glob patterns
   */
  async validatePattern(pattern) {
    const files = await glob(pattern, { nodir: true });
    const results = [];

    if (files.length === 0) {
      console.log(`${colors.yellow}Warning: No files found matching pattern: ${pattern}${colors.reset}`);
      return results;
    }

    console.log(`${colors.blue}Validating ${files.length} files...${colors.reset}\n`);

    for (const file of files) {
      const result = await this.validateFile(file);
      results.push(result);
    }

    return results;
  }
}

/**
 * Print validation results with color coding
 */
function printResults(results) {
  let totalFiles = 0;
  let validFiles = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  results.forEach(result => {
    totalFiles++;
    if (result.isValid) {
      validFiles++;
    }
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    // Print file result
    const status = result.isValid 
      ? `${colors.green}✓ VALID${colors.reset}`
      : `${colors.red}✗ INVALID${colors.reset}`;
    
    const size = result.fileSize > 0 ? ` (${formatFileSize(result.fileSize)})` : '';
    const time = result.parseTime > 0 ? ` [${result.parseTime}ms]` : '';
    
    console.log(`${status} ${result.filePath}${size}${time}`);

    // Print errors
    result.errors.forEach(error => {
      const location = error.line ? ` at line ${error.line}${error.column ? `:${error.column}` : ''}` : '';
      console.log(`  ${colors.red}ERROR:${colors.reset} ${error.message}${location}`);
    });

    // Print warnings
    result.warnings.forEach(warning => {
      const location = warning.line ? ` at line ${warning.line}${warning.column ? `:${warning.column}` : ''}` : '';
      console.log(`  ${colors.yellow}WARNING:${colors.reset} ${warning.message}${location}`);
    });

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log();
    }
  });

  // Print summary
  console.log(`${colors.bright}=== VALIDATION SUMMARY ===${colors.reset}`);
  console.log(`Total files: ${totalFiles}`);
  console.log(`Valid files: ${colors.green}${validFiles}${colors.reset}`);
  console.log(`Invalid files: ${colors.red}${totalFiles - validFiles}${colors.reset}`);
  console.log(`Total errors: ${colors.red}${totalErrors}${colors.reset}`);
  console.log(`Total warnings: ${colors.yellow}${totalWarnings}${colors.reset}`);

  if (totalErrors === 0) {
    console.log(`\n${colors.green}✓ All files are syntactically and structurally valid!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}✗ Found ${totalErrors} error(s) in ${totalFiles - validFiles} file(s)${colors.reset}`);
  }
}

/**
 * Format file size helper function
 */
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    patterns: [],
    strict: false,
    schema: null,
    maxDepth: 100,
    maxSize: 10 * 1024 * 1024,
    jsonc: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg.startsWith('--schema=')) {
      options.schema = arg.substring('--schema='.length);
    } else if (arg.startsWith('--max-depth=')) {
      options.maxDepth = parseInt(arg.substring('--max-depth='.length));
    } else if (arg.startsWith('--max-size=')) {
      options.maxSize = parseInt(arg.substring('--max-size='.length));
    } else if (arg === '--jsonc') {
      options.jsonc = true;
    } else if (!arg.startsWith('--')) {
      options.patterns.push(arg);
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`${colors.bright}JSON Validation Script${colors.reset}

${colors.bright}USAGE:${colors.reset}
  node scripts/validate-json.cjs <file-or-pattern> [options]

${colors.bright}EXAMPLES:${colors.reset}
  node scripts/validate-json.cjs package.json
  node scripts/validate-json.cjs "src/assets/i18n/*.json"
  node scripts/validate-json.cjs "src/**\/*.json" --strict
  node scripts/validate-json.cjs "tsconfig*.json" --jsonc
  node scripts/validate-json.cjs config.json --schema=config-schema.json

${colors.bright}OPTIONS:${colors.reset}
  --strict                    Enable strict validation mode
  --schema=<file>            Validate against JSON schema file
  --max-depth=<number>       Maximum nesting depth (default: 100)
  --max-size=<bytes>         Maximum file size in bytes (default: 10MB)
  --jsonc                    Parse as JSONC (JSON with Comments) format
  --help, -h                 Show this help message

${colors.bright}FEATURES:${colors.reset}
  • Syntactic validation (valid JSON format)
  • Structural validation (depth, circular references)
  • Schema-based validation (when schema provided)
  • Batch validation with glob patterns
  • Detailed error reporting with line numbers
  • File size and performance metrics
  • Strict mode for additional checks
  • Support for JSONC (JSON with Comments) format
`);
}

/**
 * Load JSON schema from file
 */
function loadSchema(schemaPath) {
  try {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    const content = fs.readFileSync(schemaPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading schema: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.patterns.length === 0) {
    console.error(`${colors.red}Error: No files or patterns specified${colors.reset}`);
    console.log('Use --help for usage information');
    process.exit(1);
  }

  // Load schema if specified
  let schema = null;
  if (options.schema) {
    schema = loadSchema(options.schema);
    console.log(`${colors.cyan}Using schema: ${options.schema}${colors.reset}\n`);
  }

  // Create validator
  const validator = new JSONValidator({
    strict: options.strict,
    schema: schema,
    maxDepth: options.maxDepth,
    maxSize: options.maxSize,
    jsonc: options.jsonc
  });

  // Validate all patterns
  const allResults = [];
  for (const pattern of options.patterns) {
    const results = await validator.validatePattern(pattern);
    allResults.push(...results);
  }

  if (allResults.length === 0) {
    console.log(`${colors.yellow}No files found to validate${colors.reset}`);
    return;
  }

  // Print results
  printResults(allResults);

  // Exit with error code if any validation failed
  const hasErrors = allResults.some(result => !result.isValid);
  process.exit(hasErrors ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { JSONValidator, ValidationResult };