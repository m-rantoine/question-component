import type { APIRoute } from 'astro';
import { teacherAuth } from '../../../lib/teacher-auth';

export const prerender = false;

export const POST: APIRoute = ({ request }) => {
  const auth = teacherAuth();
  if (!auth) return new Response('Teacher auth is not configured.', { status: 404 });
  return auth.login(request);
};
