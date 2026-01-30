#!/usr/bin/env node

/**
 * Script to check for unused localization keys in TMI project
 * 
 * Usage: node scripts/check-unused-i18n-keys.js <path-to-localization-file>
 * Example: node scripts/check-unused-i18n-keys.js src/assets/i18n/en-US.json
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const SOURCE_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.html'
];

const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/*.spec.ts',
  '**/*.test.ts'
];

/**
 * Recursively extracts all keys from a nested localization object
 * @param {Object} obj - The localization object
 * @param {string} prefix - Current key prefix
 * @returns {string[]} Array of dot-notation keys
 */
function extractKeysFromObject(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    // Skip .comment keys (translator comments)
    if (key === 'comment' || key.endsWith('.comment')) {
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      keys.push(...extractKeysFromObject(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Searches for key usage in source files
 * @param {string} key - The localization key to search for
 * @param {string[]} sourceFiles - Array of source file paths
 * @returns {boolean} True if key is found in any source file
 */
function isKeyUsedInSources(key, sourceFiles) {
  // Different patterns to match how keys are used in the codebase:
  // 1. Template pipe: {{ 'key' | transloco }}
  // 2. Template directive: [transloco]="'key'"
  // 3. TypeScript translate: .translate('key')
  // 4. Template interpolation with parameters: {{ 'key' | transloco: params }}
  
  const patterns = [
    // Template pipe usage: 'key' | transloco
    new RegExp(`['"\`]${escapeRegExp(key)}['"\`]\\s*\\|\\s*transloco`),
    // Template directive: [transloco]="'key'" or [transloco]='"key"'
    new RegExp(`\\[transloco\\]\\s*=\\s*"'${escapeRegExp(key)}'"\\s*`),
    new RegExp(`\\[transloco\\]\\s*=\\s*'"${escapeRegExp(key)}"'\\s*`),
    new RegExp(`\\[transloco\\]\\s*=\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    // TypeScript translate method: .translate('key')
    new RegExp(`\\.translate\\s*\\(\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    // SelectTranslate method: .selectTranslate('key')
    new RegExp(`\\.selectTranslate\\s*\\(\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    // Variable assignment patterns: variable = 'key' (then used in template as {{ variable | transloco }})
    new RegExp(`=\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    // Return statements: return 'key' (then used in template via method call)
    new RegExp(`return\\s+['"\`]${escapeRegExp(key)}['"\`]`),
    // String concatenation in templates: 'prefix.' + something | transloco
    new RegExp(`['"\`]${escapeRegExp(key)}['"\`]\\s*\\+`),
    // Template string literals with key parts
    new RegExp(`['"\`][^'"\`]*${escapeRegExp(key.split('.').pop())}[^'"\`]*['"\`]\\s*\\|\\s*transloco`),
    // Dynamic key construction: 'prefix.part.' + variable | transloco
    new RegExp(`['"\`]${escapeRegExp(key.substring(0, key.lastIndexOf('.') + 1))}['"\`]\\s*\\+[^|]*\\|\\s*transloco`),
    // Object property assignments: property: 'key' (then used indirectly)
    new RegExp(`:\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    // Ternary expressions: condition ? value : 'key'
    new RegExp(`\\?[^:]*:\\s*['"\`]${escapeRegExp(key)}['"\`]`),
    new RegExp(`\\?\\s*['"\`]${escapeRegExp(key)}['"\`]\\s*:`),
  ];
  
  for (const filePath of sourceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if any pattern matches
      if (patterns.some(pattern => pattern.test(content))) {
        return true;
      }
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    }
  }
  
  return false;
}

/**
 * Escapes special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Gets all source files matching the patterns
 * @returns {string[]} Array of source file paths
 */
function getSourceFiles() {
  const files = [];
  
  for (const pattern of SOURCE_PATTERNS) {
    const matches = glob.sync(pattern, {
      ignore: EXCLUDE_PATTERNS,
      absolute: true
    });
    files.push(...matches);
  }
  
  // Remove duplicates and return
  return [...new Set(files)];
}

/**
 * Main function
 */
function main() {
  // Check command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node check-unused-i18n-keys.js <path-to-localization-file>');
    console.error('Example: node check-unused-i18n-keys.js src/assets/i18n/en-US.json');
    process.exit(1);
  }
  
  const localizationFilePath = args[0];
  
  // Check if localization file exists
  if (!fs.existsSync(localizationFilePath)) {
    console.error(`Error: Localization file not found: ${localizationFilePath}`);
    process.exit(1);
  }
  
  console.log(`Checking unused keys in: ${localizationFilePath}`);
  console.log('Scanning source files...');
  
  try {
    // Load and parse localization file
    const localizationContent = fs.readFileSync(localizationFilePath, 'utf8');
    const localizationData = JSON.parse(localizationContent);
    
    // Extract all keys
    const allKeys = extractKeysFromObject(localizationData);
    console.log(`Found ${allKeys.length} localization keys`);
    
    // Get all source files
    const sourceFiles = getSourceFiles();
    console.log(`Scanning ${sourceFiles.length} source files...`);
    
    // Check each key for usage
    const unusedKeys = [];
    let checkedCount = 0;
    
    for (const key of allKeys) {
      if (!isKeyUsedInSources(key, sourceFiles)) {
        unusedKeys.push(key);
      }
      checkedCount++;
      
      // Show progress for large key sets
      if (checkedCount % 50 === 0) {
        console.log(`Checked ${checkedCount}/${allKeys.length} keys...`);
      }
    }
    
    // Report results
    console.log('\n' + '='.repeat(50));
    console.log('UNUSED LOCALIZATION KEYS REPORT');
    console.log('='.repeat(50));
    
    if (unusedKeys.length === 0) {
      console.log('✅ No unused keys found! All localization keys are being used.');
    } else {
      console.log(`❌ Found ${unusedKeys.length} unused localization keys:\n`);
      
      // Sort keys for better readability
      unusedKeys.sort().forEach(key => {
        console.log(`  ${key}`);
      });
      
      console.log(`\nSummary: ${unusedKeys.length}/${allKeys.length} keys are unused (${((unusedKeys.length / allKeys.length) * 100).toFixed(1)}%)`);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Check if glob is available
try {
  require.resolve('glob');
} catch (error) {
  console.error('Error: This script requires the "glob" package.');
  console.error('Please install it by running: npm install glob');
  process.exit(1);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  extractKeysFromObject,
  isKeyUsedInSources,
  getSourceFiles
};