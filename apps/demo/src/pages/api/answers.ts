import type { APIRoute } from 'astro';
import { createAnswersHandler } from '@askq/react/server';

// Rendered on demand: this is the one server function in the deployment.
export const prerender = false;

/**
 * Reads results for one group with the service-role key.
 *
 * The anon key that the browser holds has INSERT and nothing else, so answers
 * cannot be read from the client. Every dashboard read comes through here.
 *
 * The handler itself lives in the package, so a project installing `@askq/react`
 * gets the same endpoint with one line. Credentials are passed in explicitly
 * because `astro dev` puts `.env` on `import.meta.env` rather than `process.env`.
 */
function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromProcess ?? (import.meta.env as Record<string, string | undefined>)[name];
}

let handler: ReturnType<typeof createAnswersHandler> | null = null;

function getHandler() {
  if (!handler) {
    handler = createAnswersHandler({
      supabaseUrl: env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL'),
      serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    });
  }
  return handler;
}

export const GET: APIRoute = ({ request }) => getHandler()(request);
