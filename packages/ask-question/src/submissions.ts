import { questionKey } from './registry';

const SUBMITTED_KEY = 'askq.submitted.v1';

type SubmittedMap = Record<string, Record<string, { count: number; lastAt: number }>>;

/**
 * Remembers what this browser has already submitted, per student id.
 *
 * This drives the lock for `allowMultipleAttempts: false` and restores the
 * "already answered" state after a reload. It is UX, not a control: the anon
 * key has no select permission, so the browser cannot ask the server what it
 * already sent. Real enforcement happens at read time, where a locked question
 * counts only a student's earliest attempt.
 */
function read(): SubmittedMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SUBMITTED_KEY);
    return raw ? ((JSON.parse(raw) as SubmittedMap) ?? {}) : {};
  } catch {
    return {};
  }
}

function write(map: SubmittedMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify(map));
  } catch {
    // Ignored: the lock simply won't survive a reload.
  }
}

/**
 * Keyed by session as well, so a student locked out of a single-attempt
 * question during period 1 is not still locked during period 2.
 */
function attemptKey(groupId: string, questionId: string, sessionId?: string): string {
  const base = questionKey(groupId, questionId);
  return sessionId === undefined ? base : `${base}@${sessionId}`;
}

export function getLocalAttemptCount(
  studentId: string,
  groupId: string,
  questionId: string,
  sessionId?: string,
): number {
  return read()[studentId]?.[attemptKey(groupId, questionId, sessionId)]?.count ?? 0;
}

export function recordLocalAttempt(
  studentId: string,
  groupId: string,
  questionId: string,
  sessionId?: string,
): number {
  const map = read();
  const key = attemptKey(groupId, questionId, sessionId);
  const forStudent = map[studentId] ?? {};
  const next = (forStudent[key]?.count ?? 0) + 1;
  forStudent[key] = { count: next, lastAt: Date.now() };
  map[studentId] = forStudent;
  write(map);
  return next;
}

export function clearLocalAttempts(): void {
  write({});
}
