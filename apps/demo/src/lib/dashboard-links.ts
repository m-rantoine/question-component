/**
 * The dashboard's URL shape, in one place.
 *
 * These paths belong to this app, not to the package: `@askq/react` takes every
 * route it needs as a prop or an option, so a project using it picks its own.
 * The middleware guards whatever is declared here.
 */
export const DASHBOARD_ROOT = '/teacher-dashboard';
export const LOGIN_PATH = '/teacher/login';
export const LOGIN_ACTION = '/api/teacher/login';
export const LOGOUT_ACTION = '/api/teacher/logout';
export const READ_ENDPOINT = '/api/answers';

export function groupHref(groupId: string): string {
  return `${DASHBOARD_ROOT}/${encodeURIComponent(groupId)}`;
}

export function questionHref(groupId: string, questionId: string): string {
  return `${groupHref(groupId)}/${encodeURIComponent(questionId)}`;
}
