import type { PendingAnswerRow } from './types';

const OUTBOX_KEY = 'askq.outbox.v1';
const MAX_QUEUED = 200;

/**
 * Answers that failed to reach the server are parked here and retried.
 *
 * Classroom wi-fi drops, and losing a student's work to a failed request is the
 * worst failure this app has. Retrying is safe because the row id is minted on
 * the client: a duplicate insert is rejected by the primary key and treated as
 * success by the transport.
 */
export function readOutbox(): PendingAnswerRow[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAnswerRow[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(rows: PendingAnswerRow[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows.slice(-MAX_QUEUED)));
  } catch {
    // Storage full or blocked: the in-flight retry is all we can offer.
  }
}

export function enqueue(row: PendingAnswerRow): void {
  const rows = readOutbox();
  if (rows.some((queued) => queued.id === row.id)) return;
  rows.push(row);
  writeOutbox(rows);
}

export function dequeue(id: string): void {
  writeOutbox(readOutbox().filter((row) => row.id !== id));
}

export function outboxSize(): number {
  return readOutbox().length;
}

export function clearOutbox(): void {
  writeOutbox([]);
}
