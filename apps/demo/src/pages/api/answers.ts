import type { APIRoute } from 'astro';

// Rendered on demand: this is the one server function in the deployment.
export const prerender = false;

const COLUMNS = 'id,student_id,student_name,group_id,question_id,answer,created_at';
const MAX_ROWS = 5000;

/**
 * Reads results for one group with the service-role key.
 *
 * The anon key that the browser holds has INSERT and nothing else, so answers
 * cannot be read from the client. Every dashboard read comes through here.
 */
function env(name: string): string | undefined {
  // `process.env` is the runtime value on Vercel; `import.meta.env` is what
  // `astro dev` loads from .env locally.
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromProcess ?? (import.meta.env as Record<string, string | undefined>)[name];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const groupId = url.searchParams.get('groupId');
  const since = url.searchParams.get('since');

  if (!groupId) return json({ error: 'groupId is required' }, 400);
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(groupId)) return json({ error: 'invalid groupId' }, 400);
  if (since && Number.isNaN(Date.parse(since))) return json({ error: 'invalid since' }, 400);

  const supabaseUrl = env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return json(
      {
        error:
          'Server is not configured. Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        rows: [],
      },
      503,
    );
  }

  const query = new URL(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/answers`);
  query.searchParams.set('select', COLUMNS);
  query.searchParams.set('group_id', `eq.${groupId}`);
  if (since) query.searchParams.set('created_at', `gte.${since}`);
  query.searchParams.set('order', 'created_at.asc');
  query.searchParams.set('limit', String(MAX_ROWS));

  const response = await fetch(query, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    // Never echo the upstream body: it can carry configuration detail.
    console.error('[api/answers] Supabase read failed', response.status);
    return json({ error: 'Could not read answers', rows: [] }, 502);
  }

  const rows = await response.json();
  return json({ rows });
};
