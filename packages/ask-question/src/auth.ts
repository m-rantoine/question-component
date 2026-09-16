/**
 * Password protection for the teacher side.
 *
 * Server-only — this module reads `process.env` and must never carry a
 * `"use client"` directive.
 *
 * The important part is that ONE guard protects both the dashboard page and the
 * answers endpoint. Protecting only the page would look like security and
 * provide none: `/api/answers?groupId=lesson-1` hands every answer to anyone
 * who asks.
 *
 *   // Astro — src/pages/api/answers.ts
 *   const auth = createTeacherAuth({ loginPath: '/teacher/login' });
 *   const handler = createAnswersHandler({ authorize: auth.guard });
 *
 *   // Astro — src/middleware.ts, or a Next middleware / layout
 *   export const onRequest = async ({ request }, next) =>
 *     (await auth.guard(request)) ?? next();
 */

const DEFAULT_COOKIE = 'askq_teacher';
const DEFAULT_MAX_AGE = 12 * 60 * 60; // A school day.
const MIN_SECRET_LENGTH = 32;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 10 * 60_000;

export interface TeacherAuthOptions {
  /** Defaults to `ASKQ_TEACHER_USER`. */
  user?: string;
  /** Defaults to `ASKQ_TEACHER_PASSWORD`. */
  password?: string;
  /** Defaults to `ASKQ_AUTH_SECRET`. At least 32 characters. */
  secret?: string;
  cookieName?: string;
  /** Defaults to 12 hours. */
  maxAgeSeconds?: number;
  /**
   * Your login page — where `guard()` sends a browser that is not signed in,
   * and where `logout()` returns to. Required: the package cannot know where
   * you mounted it, and a wrong guess would redirect a locked-out teacher to a
   * 404.
   */
  loginPath: string;
  /**
   * Adds `Secure` to the cookie. Defaults to true, and to false when
   * `NODE_ENV` is `development` so that `http://localhost` still works.
   */
  secure?: boolean;
}

export interface TeacherAuth {
  isAuthenticated(request: Request): Promise<boolean>;
  /** Validates a submitted form or JSON body and sets the session cookie. */
  login(request: Request): Promise<Response>;
  logout(): Response;
  /** `null` allows the request; a `Response` refuses it. */
  guard(request: Request): Promise<Response | null>;
}

function env(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Compares two equal-length byte strings without leaking where they differ.
 *
 * Both sides are HMACs, so they are always the same length and a plain loop
 * over every byte is constant time with respect to the secret.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

function parseCookies(header: string | null): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return jar;
}

function wantsHtml(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('text/html');
}

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function createTeacherAuth(options: TeacherAuthOptions): TeacherAuth {
  const user = options.user ?? env('ASKQ_TEACHER_USER');
  const password = options.password ?? env('ASKQ_TEACHER_PASSWORD');
  const secret = options.secret ?? env('ASKQ_AUTH_SECRET');
  const cookieName = options.cookieName ?? DEFAULT_COOKIE;
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE;
  const { loginPath } = options;
  const secure = options.secure ?? env('NODE_ENV') !== 'development';

  // Loud on purpose. A dashboard that silently falls back to "no password"
  // is the failure this whole module exists to prevent.
  if (!user || !password) {
    throw new Error(
      '[askq] Teacher auth needs ASKQ_TEACHER_USER and ASKQ_TEACHER_PASSWORD. ' +
        'Set them in the server environment — never with a PUBLIC_ or NEXT_PUBLIC_ prefix.',
    );
  }
  if (!loginPath || !loginPath.startsWith('/')) {
    throw new Error(
      '[askq] createTeacherAuth needs loginPath — the same-origin path of your login page, ' +
        "e.g. '/teacher/login'. guard() redirects there, so a wrong value locks the teacher out.",
    );
  }
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[askq] ASKQ_AUTH_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }

  let keyPromise: Promise<CryptoKey> | null = null;
  function signingKey(): Promise<CryptoKey> {
    keyPromise ??= crypto.subtle.importKey(
      'raw',
      encoder.encode(secret as string),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    return keyPromise;
  }

  async function hmac(value: string): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(value)));
  }

  /** `<payload>.<signature>`, where payload carries its own expiry. */
  async function mint(): Promise<string> {
    const payload = base64url(
      encoder.encode(JSON.stringify({ u: user, exp: Date.now() + maxAge * 1000 })),
    );
    return `${payload}.${base64url(await hmac(payload))}`;
  }

  async function verify(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return false;
    const payload = token.slice(0, dot);
    let signature: Uint8Array;
    try {
      signature = fromBase64url(token.slice(dot + 1));
    } catch {
      return false;
    }
    if (!timingSafeEqual(signature, await hmac(payload))) return false;
    try {
      const claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as {
        u?: string;
        exp?: number;
      };
      return claims.u === user && typeof claims.exp === 'number' && claims.exp > Date.now();
    } catch {
      return false;
    }
  }

  function cookie(value: string, seconds: number): string {
    return [
      `${cookieName}=${value}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : null,
      `Max-Age=${seconds}`,
    ]
      .filter(Boolean)
      .join('; ');
  }

  /**
   * Per-instance, in-memory throttle. On serverless this is per-instance and
   * therefore weak — it slows a single attacker down, it does not stop a
   * distributed one. Said plainly in the README rather than implied away.
   */
  const attempts = new Map<string, { count: number; resetAt: number }>();

  function throttled(request: Request): boolean {
    const key = clientKey(request);
    const now = Date.now();
    const record = attempts.get(key);
    if (!record || record.resetAt < now) {
      attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
      return false;
    }
    record.count += 1;
    return record.count > MAX_ATTEMPTS;
  }

  async function credentials(request: Request): Promise<{ user: string; password: string; next: string }> {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        user: String(body.user ?? ''),
        password: String(body.password ?? ''),
        next: String(body.next ?? ''),
      };
    }
    const form = await request.formData().catch(() => new FormData());
    return {
      user: String(form.get('user') ?? ''),
      password: String(form.get('password') ?? ''),
      next: String(form.get('next') ?? ''),
    };
  }

  /** Only same-origin paths, so a crafted `next` cannot bounce the teacher off-site. */
  function safeNext(next: string): string {
    return /^\/(?!\/)/.test(next) ? next : '/';
  }

  return {
    async isAuthenticated(request) {
      return verify(parseCookies(request.headers.get('cookie'))[cookieName]);
    },

    async login(request) {
      if (throttled(request)) {
        return new Response(JSON.stringify({ error: 'Too many attempts' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '600' },
        });
      }

      const submitted = await credentials(request);
      // Both sides are hashed before comparison, so a wrong password cannot be
      // discovered a character at a time from the response timing.
      const [submittedUser, expectedUser, submittedPassword, expectedPassword] = await Promise.all([
        hmac(submitted.user),
        hmac(user as string),
        hmac(submitted.password),
        hmac(password as string),
      ]);

      if (
        !timingSafeEqual(submittedUser, expectedUser) ||
        !timingSafeEqual(submittedPassword, expectedPassword)
      ) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }

      attempts.delete(clientKey(request));
      return new Response(null, {
        status: 303,
        headers: { location: safeNext(submitted.next), 'set-cookie': cookie(await mint(), maxAge) },
      });
    },

    logout() {
      return new Response(null, {
        status: 303,
        headers: { location: loginPath, 'set-cookie': cookie('', 0) },
      });
    },

    async guard(request) {
      if (await verify(parseCookies(request.headers.get('cookie'))[cookieName])) return null;

      // A fetch gets a 401 it can act on; a browser gets the login page.
      if (!wantsHtml(request)) {
        return new Response(JSON.stringify({ error: 'Not signed in', rows: [] }), {
          status: 401,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      const url = new URL(request.url);
      const next = encodeURIComponent(`${url.pathname}${url.search}`);
      return new Response(null, {
        status: 302,
        headers: { location: `${loginPath}?next=${next}`, 'cache-control': 'no-store' },
      });
    },
  };
}
