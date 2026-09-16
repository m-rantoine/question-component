import { runtime, type GroupScope, type Transport } from './runtime';
import type { AnswerRow } from './types';

/**
 * Writes go straight to PostgREST with the anon key (insert-only under RLS);
 * reads go through a server route holding the service-role key, so the anon
 * key never needs select permission. Plain `fetch` on both sides keeps the
 * package dependency-free.
 */
export function createSupabaseTransport(options: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  readEndpoint: string;
}): Transport {
  const base = options.supabaseUrl.replace(/\/+$/, '');

  return {
    async submit(row) {
      const response = await fetch(`${base}/rest/v1/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: options.supabaseAnonKey,
          Authorization: `Bearer ${options.supabaseAnonKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });

      // The row id is minted client-side, so a duplicate means a retry of a
      // request that actually landed. That is success, not an error.
      if (response.status === 409) return;
      if (!response.ok) {
        throw new Error(`Submit failed (${response.status}): ${await safeText(response)}`);
      }
    },

    async fetchAnswers(scope, since) {
      // An absolute readEndpoint works anywhere; a relative one needs an origin,
      // which only exists in a browser. Guarded so a server render fails with a
      // useful message instead of "window is not defined".
      const origin = typeof window === 'undefined' ? undefined : window.location.origin;
      if (origin === undefined && !/^https?:\/\//i.test(options.readEndpoint)) {
        throw new Error(
          `[askq] readEndpoint "${options.readEndpoint}" is relative and there is no browser ` +
            `origin to resolve it against. Pass an absolute URL when reading answers outside a browser.`,
        );
      }
      const url = new URL(options.readEndpoint, origin);
      url.searchParams.set('groupId', scope.groupId);
      if (scope.sessionId !== undefined) url.searchParams.set('sessionId', scope.sessionId);
      if (since) url.searchParams.set('since', since);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Read failed (${response.status}): ${await safeText(response)}`);
      }
      const payload = (await response.json()) as { rows?: AnswerRow[] };
      return payload.rows ?? [];
    },
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return '<no body>';
  }
}

/**
 * Keeps answers in memory for the current page. Used by tests and as the
 * fallback when Supabase is not configured, so `pnpm dev` works with no setup.
 */
export function createMemoryTransport(seed: AnswerRow[] = []): Transport {
  const rows: AnswerRow[] = [...seed];
  return {
    async submit(row) {
      if (rows.some((existing) => existing.id === row.id)) return;
      rows.push({ ...row, created_at: new Date().toISOString() });
    },
    async fetchAnswers(scope, since) {
      return rows
        .filter((row) => row.group_id === scope.groupId)
        .filter((row) => scope.sessionId === undefined || row.session_id === scope.sessionId)
        .filter((row) => !since || row.created_at >= since)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
  };
}

export function getTransport(): Transport {
  const { transport, supabaseUrl, supabaseAnonKey, readEndpoint } = runtime.config;
  if (transport) return transport;
  if (supabaseUrl && supabaseAnonKey) {
    if (!readEndpoint) {
      throw new Error(
        '[askq] configure({ readEndpoint }) is required once Supabase is configured. ' +
          'Point it at the route where you mounted createAnswersHandler, e.g. ' +
          "'/api/answers' — the package has no default, because it cannot know your routes.",
      );
    }
    return createSupabaseTransport({ supabaseUrl, supabaseAnonKey, readEndpoint });
  }
  if (!runtime.warnedAboutMemory) {
    runtime.warnedAboutMemory = true;
    console.warn(
      '[askq] No Supabase credentials configured — answers are being kept in memory ' +
        'and will be lost on reload. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!runtime.memoryTransport) runtime.memoryTransport = createMemoryTransport();
  return runtime.memoryTransport;
}
