/**
 * Module state that must be shared no matter how the bundler splits the code.
 *
 * Two situations duplicate a module in practice, and both happen to this package:
 *
 * - Astro renders each `client:*` island as its own React root, and depending on
 *   how Vite chunks the build those roots can end up with separate copies.
 * - This package ships several entry points (`.`, `./dashboard`). ESM output
 *   shares chunks, but CJS output cannot, so a consumer importing both entries
 *   in CJS gets two copies of everything they have in common.
 *
 * Anything holding cross-cutting state — the active locale, the signed-in
 * student, the question registry, the answer cache — therefore lives on
 * `globalThis` rather than in module scope. Duplicated code is then harmless:
 * every copy reads and writes the same object.
 */
export function globalState<T>(key: string, create: () => T): T {
  const host = globalThis as typeof globalThis & Record<string, unknown>;
  if (!host[key]) host[key] = create();
  return host[key] as T;
}
