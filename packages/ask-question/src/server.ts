/**
 * Server entry point. Deliberately carries NO `"use client"` directive — this
 * module reads `process.env` and must run on the server.
 *
 * Next Route Handlers and Astro endpoints both speak the Web `Request`/`Response`
 * types, so one handler serves both with no framework adapter:
 *
 *   // Next.js — app/api/answers/route.ts
 *   export const GET = createAnswersHandler();
 *
 *   // Astro — src/pages/api/answers.ts
 *   export const prerender = false;
 *   const handler = createAnswersHandler();
 *   export const GET: APIRoute = ({ request }) => handler(request);
 */

import type { AnswerRow } from './types';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const BASE_COLUMNS = 'id,student_id,student_name,group_id,question_id,answer,created_at';
const COLUMNS = `id,student_id,student_name,session_id,group_id,question_id,answer,created_at`;
const DEFAULT_MAX_ROWS = 5000;

/** Postgres `undefined_column`, as PostgREST reports it. */
const UNDEFINED_COLUMN = '42703';
let warnedAboutSessionId = false;

export interface AnswersHandlerOptions {
  /** Defaults to `SUPABASE_URL`, then `PUBLIC_SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string;
  /** Defaults to `SUPABASE_SERVICE_ROLE_KEY`. Never expose this to the browser. */
  serviceRoleKey?: string;
  maxRows?: number;
  /**
   * Called before reading. Return a `Response` to refuse the request — wire this
   * to `createTeacherAuth().guard` so the endpoint is protected, not just the page.
   */
  authorize?: (request: Request) => Promise<Response | null> | Response | null;
}

function env(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Reads answers for one group with the service-role key. */
export function createAnswersHandler(options: AnswersHandlerOptions = {}) {
  return async function handleAnswersRequest(request: Request): Promise<Response> {
    const refusal = await options.authorize?.(request);
    if (refusal) return refusal;

    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');
    const sessionId = url.searchParams.get('sessionId');
    const since = url.searchParams.get('since');

    if (!groupId) return json({ error: 'groupId is required' }, 400);
    if (!ID_PATTERN.test(groupId)) return json({ error: 'invalid groupId' }, 400);
    if (sessionId !== null && !ID_PATTERN.test(sessionId)) {
      return json({ error: 'invalid sessionId' }, 400);
    }
    if (since && Number.isNaN(Date.parse(since))) return json({ error: 'invalid since' }, 400);

    const supabaseUrl =
      options.supabaseUrl ??
      env('SUPABASE_URL') ??
      env('PUBLIC_SUPABASE_URL') ??
      env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = options.serviceRoleKey ?? env('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return json(
        {
          error:
            'Server is not configured. Set the Supabase URL and SUPABASE_SERVICE_ROLE_KEY.',
          rows: [],
        },
        503,
      );
    }

    const base = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/answers`;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    };

    function build(withSession: boolean): URL {
      const query = new URL(base);
      query.searchParams.set('select', withSession ? COLUMNS : BASE_COLUMNS);
      query.searchParams.set('group_id', `eq.${groupId}`);
      if (withSession && sessionId !== null) {
        query.searchParams.set('session_id', `eq.${sessionId}`);
      }
      if (since) query.searchParams.set('created_at', `gte.${since}`);
      query.searchParams.set('order', 'created_at.asc');
      query.searchParams.set('limit', String(options.maxRows ?? DEFAULT_MAX_ROWS));
      return query;
    }

    let response = await fetch(build(true), { headers });
    let hasSessionColumn = true;

    if (!response.ok) {
      // A deploy can land before its migration does. Rather than take the
      // dashboard down for that window, fall back to the pre-session columns
      // once and say what needs applying. It heals itself when 0002 lands.
      const body = await response.text().catch(() => '');
      if (body.includes(UNDEFINED_COLUMN) && body.includes('session_id')) {
        if (!warnedAboutSessionId) {
          warnedAboutSessionId = true;
          console.warn(
            '[askq] The answers table has no session_id column, so session filtering is off. ' +
              'Apply migration 0002_add_session_id.sql.',
          );
        }
        hasSessionColumn = false;
        response = await fetch(build(false), { headers });
      }
    }

    if (!response.ok) {
      // Never echo the upstream body: it can carry configuration detail.
      console.error('[askq] Supabase read failed', response.status);
      return json({ error: 'Could not read answers', rows: [] }, 502);
    }

    const rows = (await response.json()) as AnswerRow[];
    // The client's row type requires the field, so supply it rather than
    // leaving every row a shape the components do not expect.
    return json({ rows: hasSessionColumn ? rows : rows.map((row) => ({ ...row, session_id: null })) });
  };
}

export {
  createTeacherAuth,
  type TeacherAuth,
  type TeacherAuthOptions,
} from './auth';

export type { AnswerRow } from './types';
