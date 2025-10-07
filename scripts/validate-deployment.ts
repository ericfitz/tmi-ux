#!/usr/bin/env tsx

import { execSync } from 'child_process';

interface ValidationResult {
  totalCommits: number;
  conventionalCommits: number;
  coverage: number;
  warnings: string[];
  suggestions: string[];
}

/**
 * Get the latest version tag
 */
function getLatestVersionTag(): string | null {
  try {
    const tags = execSync('git tag -l "v*" --sort=-version:refname', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    return tags[0] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get commits since the last version tag
 */
function getCommitsSinceLastVersion(): string[] {
  const latestTag = getLatestVersionTag();
  if (!latestTag) {
    console.warn('⚠️  No version tags found. Analyzing all commits.');
    try {
      return execSync('git log --pretty=format:"%s"', { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  try {
    const commits = execSync(`git log ${latestTag}..HEAD --pretty=format:"%s"`, {
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    return commits;
  } catch (error) {
    return [];
  }
}

/**
 * Parse conventional commit format
 */
function isConventionalCommit(message: string): boolean {
  const pattern = /^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/;
  return pattern.test(message);
}

/**
 * Extract commit type from conventional commit
 */
function getCommitType(message: string): string | null {
  const pattern = /^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/;
  const match = message.match(pattern);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Validate deployment readiness
 */
function validateDeployment(): ValidationResult {
  const commits = getCommitsSinceLastVersion();
  const result: ValidationResult = {
    totalCommits: commits.length,
    conventionalCommits: 0,
    coverage: 0,
    warnings: [],
    suggestions: [],
  };

  if (commits.length === 0) {
    result.warnings.push('No commits found since last version tag');
    return result;
  }

  const commitTypes: { [key: string]: number } = {};

  for (const commit of commits) {
    if (isConventionalCommit(commit)) {
      result.conventionalCommits++;
      const type = getCommitType(commit);
      if (type) {
        commitTypes[type] = (commitTypes[type] || 0) + 1;
      }
    }
  }

  result.coverage = (result.conventionalCommits / result.totalCommits) * 100;

  // Generate warnings
  if (result.conventionalCommits === 0) {
    result.warnings.push(
      'No conventional commits found - version will not be bumped automatically',
    );
  } else if (result.coverage < 100) {
    result.warnings.push(
      `Only ${result.coverage.toFixed(0)}% of commits follow conventional format`,
    );
  }

  // Generate suggestions
  if (result.conventionalCommits === 0) {
    result.suggestions.push('Use conventional commit format: <type>: <description>');
    result.suggestions.push('Common types: feat, fix, chore, docs, refactor, test, ci');
    result.suggestions.push('Example: "feat: add user authentication"');
    result.suggestions.push('Example: "fix: correct login validation bug"');
  }

  const hasMinorTrigger = commitTypes.feat || commitTypes.refactor;
  const hasPatchTrigger = commitTypes.fix || commitTypes.chore || commitTypes.docs ||
                          commitTypes.perf || commitTypes.test || commitTypes.ci || commitTypes.build;

  if (hasMinorTrigger && hasPatchTrigger) {
    result.suggestions.push(
      'Both minor (feat/refactor) and patch commits found - will trigger MINOR version bump',
    );
  } else if (hasMinorTrigger) {
    result.suggestions.push('feat/refactor commits found - will trigger MINOR version bump');
  } else if (hasPatchTrigger) {
    result.suggestions.push('fix/chore/docs commits found - will trigger PATCH version bump');
  }

  return result;
}

/**
 * Display validation results
 */
function displayResults(result: ValidationResult): void {
  console.log('\n📋 Deployment Validation Report\n');
  console.log('═'.repeat(50));

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total commits: ${result.totalCommits}`);
  console.log(`   Conventional commits: ${result.conventionalCommits}`);
  console.log(`   Coverage: ${result.coverage.toFixed(1)}%`);

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach((warning) => {
      console.log(`   • ${warning}`);
    });
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    console.log('\n💡 Suggestions:');
    result.suggestions.forEach((suggestion) => {
      console.log(`   • ${suggestion}`);
    });
  }

  // Overall status
  console.log('\n' + '═'.repeat(50));
  if (result.conventionalCommits > 0) {
    console.log('✅ Deployment validation passed - automatic versioning will work');
  } else {
    console.log('⚠️  No conventional commits found');
    console.log('   Version will not be bumped on next commit');
    console.log('   Use conventional commit format to enable automatic versioning');
  }
  console.log('');
}

/**
 * Main execution
 */
function main(): void {
  const latestTag = getLatestVersionTag();
  if (latestTag) {
    console.log(`\n🏷️  Latest version tag: ${latestTag}`);
  } else {
    console.log('\n🏷️  No version tags found');
  }

  const result = validateDeployment();
  displayResults(result);
}

main();
