#!/usr/bin/env node
/**
 * Builds on install so a git dependency works without committing `dist/`.
 *
 * `pnpm add "github:owner/repo#path:/packages/ask-question"` fetches only this
 * folder, installs its devDependencies and runs `prepare` — which is the one
 * chance we get to produce the artifact.
 *
 * Skipped when `dist/` is already present, so a normal workspace `pnpm install`
 * does not pay for a full rebuild every time. Use `pnpm build` to rebuild.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const built = new URL('../dist/index.js', import.meta.url);

if (existsSync(built)) {
  process.exit(0);
}

const result = spawnSync('tsup', [], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: new URL('..', import.meta.url),
});

if (result.status !== 0) {
  console.error('[askq] prepare: build failed');
  process.exit(result.status ?? 1);
}

spawnSync(process.execPath, ['scripts/check-build.mjs'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
