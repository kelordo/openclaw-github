#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function usage() {
  // Keep usage minimal so it can be pasted into CI logs.
  console.error('Usage: npm run search -- <pattern> [path]');
}

const [, , pattern, searchPath = '.'] = process.argv;

if (!pattern) {
  usage();
  process.exit(2);
}

function canRun(cmd, args = []) {
  const r = spawnSync(cmd, args, { stdio: 'ignore' });
  return r.status === 0;
}

// Prefer rg if installed; fall back to grep.
// Always pass "--" before the pattern so patterns like "-n" aren't treated as flags.
if (canRun('rg', ['--version'])) {
  // Match the grep fallback exclusions for consistency.
  const rgArgs = [
    '--glob', '!node_modules/**',
    '--glob', '!dist/**',
    '--glob', '!.git/**',
    '--',
    pattern,
    searchPath,
  ];
  const r = spawnSync('rg', rgArgs, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const grepArgs = [
  '-RIn',
  '--exclude-dir=node_modules',
  '--exclude-dir=dist',
  '--exclude-dir=.git',
  '--',
  pattern,
  searchPath,
];

const r = spawnSync('grep', grepArgs, { stdio: 'inherit' });
process.exit(r.status ?? 1);
