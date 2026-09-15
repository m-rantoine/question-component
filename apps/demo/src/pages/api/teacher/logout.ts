import type { APIRoute } from 'astro';
import { teacherAuth } from '../../../lib/teacher-auth';

export const prerender = false;

// GET as well as POST: the dashboard's sign-out control is a plain link.
export const GET: APIRoute = () => teacherAuth()?.logout() ?? new Response(null, { status: 404 });
export const POST: APIRoute = GET;
