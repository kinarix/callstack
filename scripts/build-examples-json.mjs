#!/usr/bin/env node
// Reads web/src/data/scriptExamples.ts and web/src/data/scriptingApi.ts and
// emits docs/assets/data/{scriptExamples,scriptingApi}.json so the static
// website can render the same data shipped in the app.
//
// Usage: node scripts/build-examples-json.mjs
// (or: make examples-json)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'docs/assets/data');
mkdirSync(outDir, { recursive: true });

function evalDataFile(relPath, returnExpr) {
  const src = readFileSync(resolve(repoRoot, relPath), 'utf8');
  // Strip TS-only syntax: drop interfaces/types and turn `export const X: T` into `const X`.
  const stripped = src
    .replace(/export interface[\s\S]*?\n\}\s*\n/g, '')
    .replace(/export type[^\n]*\n/g, '')
    .replace(/export const ([A-Z_][A-Z0-9_]*)\s*:\s*[^=]+=/g, 'const $1 =')
    .replace(/^import[^\n]*\n/gm, '')
    + `\nreturn ${returnExpr};`;
  return new Function(stripped)();
}

// Examples
{
  const result = evalDataFile(
    'web/src/data/scriptExamples.ts',
    '{ examples: EXAMPLES, categories: CATEGORIES }'
  );
  const outPath = resolve(outDir, 'scriptExamples.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${result.examples.length} examples across ${result.categories.length} categories → ${outPath}`);
}

// Scripting API
{
  const result = evalDataFile(
    'web/src/data/scriptingApi.ts',
    `{
      memberGroups: MEMBER_MAP,
      signatures: SIGNATURES,
      topLevel: TOP_LEVEL_GLOBALS
    }`
  );
  const outPath = resolve(outDir, 'scriptingApi.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  const groupCount = Object.keys(result.memberGroups).length;
  console.log(`Wrote ${groupCount} member groups + ${result.topLevel.length} globals → ${outPath}`);
}
