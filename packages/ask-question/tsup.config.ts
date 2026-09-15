import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'] as const,
  // `scripts/clean.mjs` empties dist before tsup starts. Neither config may
  // clean: they run concurrently, and one would delete the other's output.
  clean: false,
  dts: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
};

/**
 * Two configs, because the client and server halves need different builds.
 *
 * The client entries must carry `"use client"` or Next's App Router treats every
 * component as a Server Component and crashes on `useState`. esbuild strips
 * top-of-file directives, so the only way to get one into the output is the
 * banner — and its placement is verified after every build by `scripts/check-build.mjs`,
 * since a directive that lands after the imports is inert and fails silently.
 *
 * The server entry must NOT carry it: it reads `process.env`.
 */
export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts', 'src/dashboard.ts'],
    banner: { js: '"use client";' },
    async onSuccess() {
      // `cp` would break on Windows.
      await copyFile('src/styles.css', 'dist/styles.css');
    },
  },
  {
    ...shared,
    entry: ['src/server.ts'],
    platform: 'node',
  },
]);
