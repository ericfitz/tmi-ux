#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

interface VersionBumpResult {
  oldVersion: string;
  newVersion: string;
  bumpType: 'minor' | 'patch';
  reason: string;
}

const TEMP_FILE = '.version-bump-type';
const VERSION_TAG_PREFIX = 'v';

/**
 * Check if running in CI environment
 */
function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1';
}

/**
 * Read VERSION_BUMP from temp file if it exists
 */
function readVersionBumpFile(): 'minor' | 'patch' | null {
  const tempFilePath = join(process.cwd(), TEMP_FILE);
  if (existsSync(tempFilePath)) {
    const content = readFileSync(tempFilePath, 'utf-8').trim();
    unlinkSync(tempFilePath); // Delete after reading
    if (content === 'minor' || content === 'patch') {
      return content;
    }
  }
  return null;
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
    console.error('❌ Error getting commits:', error);
    return [];
  }
}

/**
 * Determine if a commit message follows conventional commit format
 * Lenient parsing: accepts variations like "feat:" or "feat: " (with/without space)
 */
function parseConventionalCommit(message: string): {
  type: string;
  scope?: string;
  description: string;
} | null {
  // Pattern: type(optional-scope): description
  // Lenient: allows optional space after colon
  const pattern = /^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/;
  const match = message.match(pattern);

  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase(),
    scope: match[2],
    description: match[3],
  };
}

/**
 * Analyze commits and determine bump type
 */
function analyzeCommits(commits: string[]): 'minor' | 'patch' | null {
  let hasFeature = false;
  let hasFix = false;

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit);
    if (!parsed) {
      continue;
    }

    if (parsed.type === 'feat') {
      hasFeature = true;
    } else if (
      ['fix', 'perf', 'refactor', 'docs', 'chore', 'style', 'test', 'ci', 'build'].includes(
        parsed.type,
      )
    ) {
      hasFix = true;
    }
  }

  if (hasFeature) {
    return 'minor';
  } else if (hasFix) {
    return 'patch';
  }

  return null;
}

/**
 * Prompt user for bump type (local builds only)
 */
async function promptForBumpType(): Promise<'minor' | 'patch' | 'abort'> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  No conventional commits found since last version.');
    console.log('Please specify version bump type:');
    console.log('  [1] Minor (new features) - 0.x.0');
    console.log('  [2] Patch (bug fixes) - 0.0.x');
    console.log('  [3] Abort build');

    rl.question('\nEnter choice (1-3): ', (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '1') {
        resolve('minor');
      } else if (choice === '2') {
        resolve('patch');
      } else if (choice === '3') {
        resolve('abort');
      } else {
        console.log('Invalid choice. Aborting.');
        resolve('abort');
      }
    });
  });
}

/**
 * Determine the bump type using the hybrid approach
 */
async function determineBumpType(): Promise<'minor' | 'patch' | null> {
  // Step 1: Check for VERSION_BUMP temp file
  const explicitBump = readVersionBumpFile();
  if (explicitBump) {
    console.log(`✅ Using explicit version bump: ${explicitBump}`);
    return explicitBump;
  }

  // Step 2: Analyze commits
  const commits = getCommitsSinceLastVersion();
  console.log(`📝 Analyzing ${commits.length} commit(s) since last version...`);

  const analyzedBump = analyzeCommits(commits);
  if (analyzedBump) {
    console.log(`✅ Auto-detected bump type from commits: ${analyzedBump}`);
    return analyzedBump;
  }

  // Step 3: No conventional commits found
  if (isCI()) {
    console.error('❌ CI build requires conventional commits or explicit VERSION_BUMP');
    console.error('   Use: pnpm run version:set-minor or pnpm run version:set-patch');
    console.error('   Or use conventional commit format: feat:, fix:, etc.');
    return null;
  }

  // Step 4: Interactive prompt (local only)
  const userChoice = await promptForBumpType();
  if (userChoice === 'abort') {
    return null;
  }

  return userChoice;
}

/**
 * Bump version in package.json
 */
function bumpVersion(bumpType: 'minor' | 'patch'): VersionBumpResult {
  const packageJsonPath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const oldVersion = packageJson.version;
  const [major, minor, patch] = oldVersion.split('.').map(Number);

  let newVersion: string;
  if (bumpType === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

  return {
    oldVersion,
    newVersion,
    bumpType,
    reason: 'Automatic version bump',
  };
}

/**
 * Create git commit and tag for version bump
 */
function commitAndTag(version: string): void {
  try {
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
    execSync(`git tag -a ${VERSION_TAG_PREFIX}${version} -m "Release version ${version}"`, {
      stdio: 'inherit',
    });
    console.log(`✅ Created commit and tag: ${VERSION_TAG_PREFIX}${version}`);
  } catch (error) {
    console.error('❌ Error creating commit/tag:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 Starting version bump process...\n');

  const bumpType = await determineBumpType();
  if (!bumpType) {
    console.error('❌ Version bump aborted.');
    process.exit(1);
  }

  const result = bumpVersion(bumpType);
  console.log(`\n✅ Version bumped: ${result.oldVersion} → ${result.newVersion} (${bumpType})`);

  commitAndTag(result.newVersion);

  console.log('\n✨ Version bump complete!\n');
}

main().catch((error) => {
  console.error('❌ Version bump failed:', error);
  process.exit(1);
});
