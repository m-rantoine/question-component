/**
 * The dashboard's URL shape, in one place.
 *
 * The leading path segment is the only thing protecting these pages, so it is
 * defined once and every link is built from it.
 */
export const DASHBOARD_ROOT = '/secretkey_abc123/teacher-dashboard';

export function groupHref(groupId: string): string {
  return `${DASHBOARD_ROOT}/${encodeURIComponent(groupId)}`;
}

export function questionHref(groupId: string, questionId: string): string {
  return `${groupHref(groupId)}/${encodeURIComponent(questionId)}`;
}
