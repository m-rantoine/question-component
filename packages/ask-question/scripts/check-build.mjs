#!/usr/bin/env node
/**
 * Guards the two build invariants that fail silently.
 *
 * 1. `"use client"` must be the FIRST statement of every client bundle. esbuild
 *    strips source directives, so it is re-added by a banner — and a banner that
 *    lands after the imports is inert. That builds cleanly and only breaks once
 *    someone imports the package into a Next App Router project.
 * 2. The server bundle must NOT carry the directive, or Next will refuse to use
 *    `process.env` in it.
 *
 * Run as part of `build`, so a broken artifact cannot be published or committed.
 */
import { readFile } from 'node:fs/promises';

const CLIENT = ['index.js', 'index.cjs', 'dashboard.js', 'dashboard.cjs'];
const SERVER = ['server.js', 'server.cjs'];
const DIRECTIVE = /^["']use client["'];?/;

const problems = [];

async function read(file) {
  try {
    return await readFile(new URL(`../dist/${file}`, import.meta.url), 'utf8');
  } catch {
    problems.push(`dist/${file} is missing`);
    return null;
  }
}

for (const file of CLIENT) {
  const source = await read(file);
  if (source === null) continue;
  const firstLine = source.split('\n', 1)[0].trim();
  if (!DIRECTIVE.test(firstLine)) {
    problems.push(
      `dist/${file} must start with "use client" — found: ${JSON.stringify(firstLine.slice(0, 60))}`,
    );
  }
}

for (const file of SERVER) {
  const source = await read(file);
  if (source === null) continue;
  if (DIRECTIVE.test(source.split('\n', 1)[0].trim())) {
    problems.push(`dist/${file} must NOT start with "use client" — it runs on the server`);
  }
}

const styles = await read('styles.css');
if (styles !== null && !styles.includes('--askq-')) {
  problems.push('dist/styles.css does not look like the stylesheet');
}

if (problems.length > 0) {
  console.error('\nBuild check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`Build check passed (${CLIENT.length} client + ${SERVER.length} server bundles).`);
