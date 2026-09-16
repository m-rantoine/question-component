import { describe, expect, it } from 'vitest';
import { createTeacherAuth } from '../src/auth';
import { createAnswersHandler } from '../src/server';

const CONFIG = {
  user: 'teacher',
  password: 'correct horse battery staple',
  secret: 'x'.repeat(32),
  loginPath: '/teacher/login',
};

function form(fields: Record<string, string>): Request {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request('https://school.example/api/teacher/login', { method: 'POST', body });
}

/** The cookie value from a Set-Cookie header, ready to send back. */
function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  return header.split(';')[0] ?? '';
}

function page(cookie?: string): Request {
  return new Request('https://school.example/teacher-dashboard', {
    headers: {
      accept: 'text/html',
      ...(cookie ? { cookie } : {}),
    },
  });
}

function api(cookie?: string): Request {
  return new Request('https://school.example/api/answers?groupId=lesson-1', {
    headers: { accept: 'application/json', ...(cookie ? { cookie } : {}) },
  });
}

describe('createTeacherAuth', () => {
  it('refuses to start without credentials', () => {
    expect(() =>
      createTeacherAuth({ secret: 'x'.repeat(32), loginPath: '/teacher/login' }),
    ).toThrow(/ASKQ_TEACHER_USER/);
  });

  it('refuses to start without a login path', () => {
    // A wrong or missing value would redirect a locked-out teacher to a 404,
    // so there is no default to fall back to.
    const { loginPath: _omitted, ...rest } = CONFIG;
    expect(() => createTeacherAuth(rest as typeof CONFIG)).toThrow(/loginPath/);
    expect(() => createTeacherAuth({ ...CONFIG, loginPath: 'teacher/login' })).toThrow(
      /loginPath/,
    );
  });

  it('refuses to start with a short secret', () => {
    expect(() => createTeacherAuth({ ...CONFIG, secret: 'too-short' })).toThrow(
      /ASKQ_AUTH_SECRET/,
    );
  });

  it('signs in with the right password and out again', async () => {
    const auth = createTeacherAuth(CONFIG);

    const response = await auth.login(form({ user: 'teacher', password: CONFIG.password }));
    expect(response.status).toBe(303);

    const cookie = cookieFrom(response);
    expect(await auth.isAuthenticated(page(cookie))).toBe(true);

    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');

    // Logging out clears the cookie rather than relying on the browser to.
    expect(cookieFrom(auth.logout())).toBe('askq_teacher=');
  });

  it('rejects a wrong password and a wrong user', async () => {
    const auth = createTeacherAuth(CONFIG);
    expect((await auth.login(form({ user: 'teacher', password: 'nope' }))).status).toBe(401);
    expect((await auth.login(form({ user: 'someone', password: CONFIG.password }))).status).toBe(
      401,
    );
  });

  it('never puts the password in the cookie', async () => {
    const auth = createTeacherAuth(CONFIG);
    const cookie = cookieFrom(
      await auth.login(form({ user: 'teacher', password: CONFIG.password })),
    );
    expect(cookie).not.toContain(CONFIG.password);
  });

  it('rejects a cookie signed with a different secret', async () => {
    const mine = createTeacherAuth(CONFIG);
    const theirs = createTeacherAuth({ ...CONFIG, secret: 'y'.repeat(32) });

    const cookie = cookieFrom(
      await theirs.login(form({ user: 'teacher', password: CONFIG.password })),
    );
    expect(await mine.isAuthenticated(page(cookie))).toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const auth = createTeacherAuth(CONFIG);
    const cookie = cookieFrom(await auth.login(form({ user: 'teacher', password: CONFIG.password })));
    const [name, value = ''] = cookie.split('=');
    const [payload, signature] = value.split('.');
    const forged = `${name}=${payload}x.${signature}`;
    expect(await auth.isAuthenticated(page(forged))).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    const auth = createTeacherAuth({ ...CONFIG, maxAgeSeconds: -1 });
    const cookie = cookieFrom(await auth.login(form({ user: 'teacher', password: CONFIG.password })));
    expect(await auth.isAuthenticated(page(cookie))).toBe(false);
  });

  it('sends a browser to the login page and a fetch a 401', async () => {
    const auth = createTeacherAuth(CONFIG);

    const html = await auth.guard(page());
    expect(html?.status).toBe(302);
    expect(html?.headers.get('location')).toBe(
      '/teacher/login?next=%2Fteacher-dashboard',
    );

    const json = await auth.guard(api());
    expect(json?.status).toBe(401);
    expect(await json?.json()).toMatchObject({ rows: [] });
  });

  it('lets a signed-in request through', async () => {
    const auth = createTeacherAuth(CONFIG);
    const cookie = cookieFrom(await auth.login(form({ user: 'teacher', password: CONFIG.password })));
    expect(await auth.guard(page(cookie))).toBeNull();
    expect(await auth.guard(api(cookie))).toBeNull();
  });

  it('throttles repeated wrong passwords from one address', async () => {
    const auth = createTeacherAuth(CONFIG);
    const attempt = () =>
      auth.login(
        new Request('https://school.example/api/teacher/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
          body: JSON.stringify({ user: 'teacher', password: 'nope' }),
        }),
      );

    let last = 0;
    for (let i = 0; i < 12; i += 1) last = (await attempt()).status;
    expect(last).toBe(429);
  });

  it('ignores an off-site redirect target', async () => {
    const auth = createTeacherAuth(CONFIG);
    const response = await auth.login(
      form({ user: 'teacher', password: CONFIG.password, next: 'https://evil.example/steal' }),
    );
    expect(response.headers.get('location')).toBe('/');

    // Protocol-relative URLs are the other way a redirect leaves the site.
    const sneaky = await auth.login(
      form({ user: 'teacher', password: CONFIG.password, next: '//evil.example/steal' }),
    );
    expect(sneaky.headers.get('location')).toBe('/');
  });

  it('protects the answers endpoint, not just the page', async () => {
    const auth = createTeacherAuth(CONFIG);
    const handler = createAnswersHandler({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-key',
      authorize: auth.guard,
    });

    expect((await handler(api())).status).toBe(401);
  });
});
