// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Static by default; only the answers endpoint opts into server rendering
  // (`export const prerender = false`), so Vercel deploys one function and a
  // pile of static HTML.
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
});
