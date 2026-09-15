import { defineMiddleware } from 'astro:middleware';
import { teacherAuth } from './lib/teacher-auth';
import { DASHBOARD_ROOT } from './lib/dashboard-links';

/**
 * One guard for both the dashboard pages and the answers endpoint.
 *
 * Guarding only the pages would look like security and provide none:
 * `/api/answers?groupId=lesson-1` returns every answer as JSON to anyone who
 * asks for it.
 */
export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  const auth = teacherAuth();
  if (!auth) return next();

  const protectedPath =
    url.pathname.startsWith(DASHBOARD_ROOT) || url.pathname === '/api/answers';
  if (!protectedPath) return next();

  return (await auth.guard(request)) ?? next();
});
