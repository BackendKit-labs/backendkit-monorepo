#!/usr/bin/env node
/**
 * Usage:  node scripts/changelog.mjs <package-name>
 * Example: node scripts/changelog.mjs circuit-breaker
 *
 * Reads git log since the previous tag for the package, groups commits by
 * conventional commit type, and prepends an entry to packages/<name>/CHANGELOG.md.
 * Version is read from the package's package.json — bump it before running this.
 */

import { execSync }                                from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join }                                    from 'node:path';

const SECTION_ORDER = [
  '⚠ Breaking Changes',
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Documentation',
  'Tests',
  'CI',
  'Chores',
  'Other',
];

const TYPE_TO_SECTION = {
  feat:     'Features',
  fix:      'Bug Fixes',
  perf:     'Performance',
  refactor: 'Refactoring',
  docs:     'Documentation',
  test:     'Tests',
  tests:    'Tests',
  ci:       'CI',
  chore:    'Chores',
  build:    'Chores',
};

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

const pkgName = process.argv[2];
if (!pkgName) {
  console.error('Usage: node scripts/changelog.mjs <package-name>');
  process.exit(1);
}

const pkgDir      = join('packages', pkgName);
const pkgJsonPath = join(pkgDir, 'package.json');

if (!existsSync(pkgJsonPath)) {
  console.error(`Package not found: ${pkgDir}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

// Find the previous tag for this package
const prevTag = run(`git describe --tags --match "${pkgName}@*" --abbrev=0 HEAD^`);
const range   = prevTag ? `${prevTag}..HEAD` : 'HEAD';

console.log(`Generating CHANGELOG for ${pkgName}@${version} (since: ${prevTag || 'beginning of history'})`);

// Commits that touch this package path
const logOutput = run(`git log ${range} --pretty=format:"%H\t%s" -- "${pkgDir}/"`);

if (!logOutput) {
  console.log('No commits found — nothing to generate.');
  process.exit(0);
}

// Parse conventional commits
const grouped = {};

for (const line of logOutput.split('\n')) {
  if (!line.trim()) continue;
  const tab     = line.indexOf('\t');
  const hash    = line.slice(0, tab);
  const subject = line.slice(tab + 1);

  const match = subject.match(/^(\w+)(?:\([^)]+\))?(!?):\s*(.+)$/);
  if (!match) {
    if (!grouped['Other']) grouped['Other'] = [];
    grouped['Other'].push(`- ${subject} (\`${hash.slice(0, 7)}\`)`);
    continue;
  }

  const [, type, breaking, description] = match;

  if (breaking === '!') {
    if (!grouped['⚠ Breaking Changes']) grouped['⚠ Breaking Changes'] = [];
    grouped['⚠ Breaking Changes'].push(`- ${description} (\`${hash.slice(0, 7)}\`)`);
  }

  const section = TYPE_TO_SECTION[type] ?? 'Other';
  if (!grouped[section]) grouped[section] = [];
  grouped[section].push(`- ${description} (\`${hash.slice(0, 7)}\`)`);
}

// Build markdown entry
const date  = new Date().toISOString().slice(0, 10);
let   entry = `## [${version}] — ${date}\n\n`;

for (const section of SECTION_ORDER) {
  if (!grouped[section]?.length) continue;
  entry += `### ${section}\n\n${grouped[section].join('\n')}\n\n`;
}

// Prepend to CHANGELOG.md
const changelogPath = join(pkgDir, 'CHANGELOG.md');
const HEADER        = '# Changelog\n\n';
const existing      = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : '';
const body          = existing.startsWith(HEADER) ? existing.slice(HEADER.length) : existing;

writeFileSync(changelogPath, HEADER + entry + body);
console.log(`✓ ${changelogPath} updated`);
