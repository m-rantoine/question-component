import { createTeacherAuth, type TeacherAuth } from '@askq/react/server';
import { LOGIN_PATH } from './dashboard-links';

/**
 * The demo's teacher auth, or `null` when it has not been configured.
 *
 * `createTeacherAuth` throws on missing credentials on purpose — a dashboard
 * that quietly falls back to "no password" is exactly the failure it exists to
 * prevent. This wrapper checks first so that a fresh clone with no `.env` still
 * runs; when auth is off, the dashboard says so in a banner instead of
 * pretending to be protected.
 */
function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromProcess ?? (import.meta.env as Record<string, string | undefined>)[name];
}

let cached: TeacherAuth | null | undefined;

export function teacherAuth(): TeacherAuth | null {
  if (cached !== undefined) return cached;

  const user = env('ASKQ_TEACHER_USER');
  const password = env('ASKQ_TEACHER_PASSWORD');
  const secret = env('ASKQ_AUTH_SECRET');

  cached =
    user && password && secret
      ? createTeacherAuth({ user, password, secret, loginPath: LOGIN_PATH })
      : null;
  return cached;
}

export function isTeacherAuthConfigured(): boolean {
  return teacherAuth() !== null;
}
