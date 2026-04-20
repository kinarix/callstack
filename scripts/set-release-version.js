#!/usr/bin/env node
'use strict';

const { createInterface } = require('readline');
const { execFileSync, execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CARGO_FILE = path.join(REPO_ROOT, 'src-tauri', 'Cargo.toml');
const CONF_FILE = path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json');

const B = '\x1b[0;34m';
const G = '\x1b[0;32m';
const Y = '\x1b[1;33m';
const R = '\x1b[0;31m';
const N = '\x1b[0m';

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function currentVersion() {
  return readFileSync(CARGO_FILE, 'utf8').match(/^version = "([^"]+)"/m)?.[1] || '';
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const allChanged = [
    git('diff', '--name-only', 'HEAD'),
    git('diff', '--name-only'),
    git('ls-files', '--others', '--exclude-standard'),
  ].join('\n').split('\n').filter(Boolean);

  const nonDocs = allChanged.filter(f => !f.startsWith('docs/'));

  if (nonDocs.length === 0 && allChanged.length > 0) {
    const ver = currentVersion();
    console.log(`${Y}Only docs/ files changed — skipping version bump (staying at v${ver}).${N}\n`);

    const msg = (await prompt(rl, `${B}Commit message${N}: `)) || 'Update website';
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    git('add', 'docs/');
    execFileSync('git', ['commit', '-m', msg], { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log(`${G}✓${N} Committed: ${msg}`);
    execFileSync('git', ['push', 'origin', branch], { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log(`${G}✓${N} Pushed to origin/${branch} (no release triggered)`);
    rl.close();
    return;
  }

  const oldVer = currentVersion();
  console.log(`${B}Current version: ${Y}${oldVer}${N}\n`);

  const newVer = (await prompt(rl, `${B}Enter new version (format: X.Y.Z)${N}: `)).trim();

  if (!/^\d+\.\d+\.\d+$/.test(newVer)) {
    console.error(`${R}Invalid version format. Use X.Y.Z (e.g., 0.4.0)${N}`);
    rl.close();
    process.exit(1);
  }

  if (newVer === oldVer) {
    console.log(`${Y}Version unchanged.${N}`);
    rl.close();
    return;
  }

  console.log(`\n${B}Updating files...${N}`);

  writeFileSync(CARGO_FILE,
    readFileSync(CARGO_FILE, 'utf8').replace(/^version = "[^"]+"/m, `version = "${newVer}"`));
  console.log(`${G}✓${N} Updated Cargo.toml`);

  writeFileSync(CONF_FILE,
    readFileSync(CONF_FILE, 'utf8').replace(`"version": "${oldVer}"`, `"version": "${newVer}"`));
  console.log(`${G}✓${N} Updated tauri.conf.json`);

  console.log(`\n${G}Version updated: ${Y}${oldVer}${N} → ${Y}${newVer}${N}\n`);

  console.log(`${B}Updating Cargo.lock...${N}`);
  execSync('cargo update', { cwd: path.join(REPO_ROOT, 'src-tauri'), stdio: 'inherit' });
  console.log(`${G}✓${N} Updated Cargo.lock\n`);

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const unpushedLog = git('log', `origin/${branch}..HEAD`, '--pretty=format:- %s');
  let defaultMsg = '';
  if (unpushedLog) {
    console.log(`${B}Unpushed commits:${N}\n${unpushedLog}\n`);
    defaultMsg = git('log', `origin/${branch}..HEAD`, '--pretty=format:%s')
      .split('\n').join('. ');
  }

  const input = await prompt(rl, `${B}Commit message [${defaultMsg}]${N}: `);
  const commitMsg = `${input.trim() || defaultMsg} (v${newVer})`;

  git('add', '-A');
  execFileSync('git', ['commit', '-m', commitMsg], { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log(`${G}✓${N} Committed: ${commitMsg}`);

  execFileSync('git', ['push', 'origin', branch], { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log(`${G}✓${N} Pushed to origin/${branch}`);

  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
