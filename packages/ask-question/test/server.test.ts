import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnswersHandler } from '../src/server';

const CONFIG = { supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'service-key' };

function get(query: string): Request {
  return new Request(`https://school.example/api/answers${query}`);
}

/** Replaces global fetch and records the URL the handler asked for. */
function stubFetch(response: Response) {
  const calls: URL[] = [];
  // `noUncheckedIndexedAccess` is on, so reads go through `at()` below.
  vi.stubGlobal('fetch', async (input: URL | RequestInfo) => {
    calls.push(new URL(String(input)));
    return response.clone();
  });
  return {
    calls,
    /** The nth request's URL, asserted to exist so tests can read it directly. */
    at(index: number): URL {
      const url = calls[index];
      if (!url) throw new Error(`No fetch call at index ${index} (made ${calls.length})`);
      return url;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createAnswersHandler', () => {
  it('rejects a request with no groupId', async () => {
    const response = await createAnswersHandler(CONFIG)(get(''));
    expect(response.status).toBe(400);
  });

  it('rejects ids and timestamps that do not look like ids and timestamps', async () => {
    const handler = createAnswersHandler(CONFIG);
    expect((await handler(get('?groupId=lesson%201'))).status).toBe(400);
    expect((await handler(get('?groupId=lesson-1&sessionId=period%201'))).status).toBe(400);
    expect((await handler(get('?groupId=lesson-1&since=yesterday'))).status).toBe(400);
  });

  it('reports 503 when the server has no credentials', async () => {
    const response = await createAnswersHandler({
      supabaseUrl: undefined,
      serviceRoleKey: undefined,
    })(get('?groupId=lesson-1'));
    // No env vars are set in the test environment, so the defaults are empty too.
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ rows: [] });
  });

  it('returns the rows on success', async () => {
    const rows = [{ id: 'r1', group_id: 'lesson-1' }];
    stubFetch(new Response(JSON.stringify(rows), { status: 200 }));

    const response = await createAnswersHandler(CONFIG)(get('?groupId=lesson-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows });
  });

  it('filters by session only when one is asked for', async () => {
    const fetched = stubFetch(new Response('[]', { status: 200 }));
    const handler = createAnswersHandler(CONFIG);

    await handler(get('?groupId=lesson-1'));
    expect(fetched.at(0).searchParams.get('group_id')).toBe('eq.lesson-1');
    expect(fetched.at(0).searchParams.get('session_id')).toBeNull();

    await handler(get('?groupId=lesson-1&sessionId=period-1'));
    expect(fetched.at(1).searchParams.get('session_id')).toBe('eq.period-1');
  });

  it('passes `since` through as a lower bound', async () => {
    const fetched = stubFetch(new Response('[]', { status: 200 }));
    await createAnswersHandler(CONFIG)(get('?groupId=lesson-1&since=2026-01-01T00:00:00.000Z'));
    expect(fetched.at(0).searchParams.get('created_at')).toBe('gte.2026-01-01T00:00:00.000Z');
  });

  it('reports 502 without echoing the upstream body', async () => {
    stubFetch(new Response('permission denied for relation answers', { status: 403 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await createAnswersHandler(CONFIG)(get('?groupId=lesson-1'));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toContain('permission denied');
  });

  it('lets an authorize hook refuse before anything is read', async () => {
    const fetched = stubFetch(new Response('[]', { status: 200 }));
    const handler = createAnswersHandler({
      ...CONFIG,
      authorize: () => new Response(null, { status: 401 }),
    });

    expect((await handler(get('?groupId=lesson-1'))).status).toBe(401);
    expect(fetched.calls).toHaveLength(0);
  });

  it('falls back to the pre-session columns when 0002 has not been applied', async () => {
    // A deploy can land before its migration. Taking the dashboard down for
    // that window would be worse than losing session filtering for it.
    const calls: URL[] = [];
    vi.stubGlobal('fetch', async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.searchParams.get('select')?.includes('session_id')) {
        return new Response(
          JSON.stringify({ code: '42703', message: 'column answers.session_id does not exist' }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify([{ id: 'r1', group_id: 'lesson-1' }]), { status: 200 });
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await createAnswersHandler(CONFIG)(get('?groupId=lesson-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ id: 'r1', group_id: 'lesson-1', session_id: null }] });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.searchParams.get('select')).not.toContain('session_id');
  });

  it('does not retry an unrelated 400', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ code: '22P02' }), { status: 400 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await createAnswersHandler(CONFIG)(get('?groupId=lesson-1'))).status).toBe(502);
    expect(calls.calls).toHaveLength(1);
  });
});
