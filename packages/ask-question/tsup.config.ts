import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'] as const,
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
    clean: true,
    banner: { js: '"use client";' },
    async onSuccess() {
      // `cp` would break on Windows.
      await copyFile('src/styles.css', 'dist/styles.css');
    },
  },
  {
    ...shared,
    entry: ['src/server.ts'],
    clean: false,
    platform: 'node',
  },
]);
