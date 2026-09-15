#!/usr/bin/env node
/**
 * Empties `dist/` before tsup runs.
 *
 * tsup's own `clean` belongs to a single config, and this package builds from
 * two (client and server need different banners and platforms). Letting either
 * one clean races the other's output: the server declarations were being
 * written and then deleted by the client config's clean, leaving JS with no
 * types. Cleaning once, up front, removes the race.
 */
import { rm } from 'node:fs/promises';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
