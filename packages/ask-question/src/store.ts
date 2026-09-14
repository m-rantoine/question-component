import { isPollingPaused, subscribeToIdle } from './idle';
import { dequeue, enqueue, readOutbox } from './outbox';
import { runtime, type GroupSnapshot, type GroupState } from './runtime';
import { getTransport } from './transport';
import type { AnswerRow, PendingAnswerRow } from './types';

/** Re-ask for a little before the newest row we hold, so a row committed
 *  mid-request is not skipped by the cursor. */
const CURSOR_OVERLAP_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

// One frozen empty snapshot per group id. `useSyncExternalStore` compares
// snapshots by identity, so returning a fresh object here would loop forever.
const EMPTY_SNAPSHOTS = new Map<string, GroupSnapshot>();

function emptySnapshot(groupId: string): GroupSnapshot {
  let snapshot = EMPTY_SNAPSHOTS.get(groupId);
  if (!snapshot) {
    snapshot = { groupId, rows: [], status: 'idle', error: null, lastFetchedAt: null };
    EMPTY_SNAPSHOTS.set(groupId, snapshot);
  }
  return snapshot;
}

function getGroup(groupId: string): GroupState {
  let group = runtime.groups.get(groupId);
  if (!group) {
    group = {
      groupId,
      rows: [],
      seen: new Set(),
      cursor: null,
      status: 'idle',
      error: null,
      lastFetchedAt: null,
      listeners: new Set(),
      subscribers: 0,
      timer: null,
      inFlight: false,
      failures: 0,
      snapshot: emptySnapshot(groupId),
    };
    runtime.groups.set(groupId, group);
  }
  return group;
}

function publish(group: GroupState): void {
  group.snapshot = {
    groupId: group.groupId,
    rows: group.rows,
    status: group.status,
    error: group.error,
    lastFetchedAt: group.lastFetchedAt,
  };
  for (const listener of [...group.listeners]) listener();
}

/** Merge fetched rows, dropping ids we already hold and keeping chronological order. */
function mergeRows(group: GroupState, incoming: AnswerRow[]): boolean {
  const fresh = incoming.filter((row) => !group.seen.has(row.id));
  if (fresh.length === 0) return false;
  for (const row of fresh) group.seen.add(row.id);
  group.rows = [...group.rows, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return true;
}

function advanceCursor(group: GroupState): void {
  const newest = group.rows[group.rows.length - 1];
  if (!newest) return;
  const overlapped = new Date(new Date(newest.created_at).getTime() - CURSOR_OVERLAP_MS);
  group.cursor = Number.isNaN(overlapped.getTime()) ? null : overlapped.toISOString();
}

async function fetchGroup(groupId: string, full = false): Promise<void> {
  const group = getGroup(groupId);
  if (group.inFlight) return;
  group.inFlight = true;
  if (group.status === 'idle') {
    group.status = 'loading';
    publish(group);
  }

  try {
    const since = full ? null : group.cursor;
    const rows = await getTransport().fetchAnswers(groupId, since);
    mergeRows(group, rows);
    advanceCursor(group);
    group.failures = 0;
    group.status = 'ready';
    group.error = null;
    group.lastFetchedAt = Date.now();
    publish(group);
  } catch (error) {
    group.failures += 1;
    group.status = group.rows.length ? 'ready' : 'error';
    group.error = error instanceof Error ? error.message : String(error);
    publish(group);
  } finally {
    group.inFlight = false;
  }
}

function nextDelay(group: GroupState): number {
  const base = runtime.config.pollMs;
  if (group.failures === 0) return base;
  return Math.min(MAX_BACKOFF_MS, base * 2 ** Math.min(group.failures, 5));
}

function schedule(group: GroupState): void {
  if (group.timer) clearTimeout(group.timer);
  group.timer = null;
  if (group.subscribers === 0) return;
  // Chained timeout rather than setInterval: a slow request must never stack
  // another request on top of itself.
  group.timer = setTimeout(() => void poll(group.groupId), nextDelay(group));
}

async function poll(groupId: string): Promise<void> {
  const group = getGroup(groupId);
  if (group.subscribers === 0) return;
  if (!isPollingPaused()) await fetchGroup(groupId);
  schedule(group);
}

let idleUnsubscribe: (() => void) | null = null;
let wasPaused = false;

function watchIdle(): void {
  if (idleUnsubscribe) return;
  wasPaused = isPollingPaused();
  idleUnsubscribe = subscribeToIdle(() => {
    const paused = isPollingPaused();
    if (wasPaused && !paused) {
      // Resuming from a pause: everything we have may be stale, so re-read the
      // whole group rather than trusting the cursor.
      for (const group of runtime.groups.values()) {
        if (group.subscribers > 0) {
          group.cursor = null;
          void fetchGroup(group.groupId, true).then(() => schedule(group));
        }
      }
    }
    wasPaused = paused;
  });
}

/** Subscribe to a group's answers. The first subscriber starts the poller; the last stops it. */
export function subscribeToGroup(groupId: string, listener: () => void): () => void {
  const group = getGroup(groupId);
  group.listeners.add(listener);
  group.subscribers += 1;
  watchIdle();

  if (group.subscribers === 1) {
    void fetchGroup(groupId, group.rows.length === 0).then(() => schedule(group));
    void flushOutbox();
  }

  return () => {
    group.listeners.delete(listener);
    group.subscribers = Math.max(0, group.subscribers - 1);
    if (group.subscribers === 0 && group.timer) {
      clearTimeout(group.timer);
      group.timer = null;
    }
  };
}

export function getGroupSnapshot(groupId: string): GroupSnapshot {
  return runtime.groups.get(groupId)?.snapshot ?? emptySnapshot(groupId);
}

/** Server render has no answers; the same cached instance keeps hydration stable. */
export function getServerGroupSnapshot(groupId: string): GroupSnapshot {
  return emptySnapshot(groupId);
}

export function refreshGroup(groupId: string): Promise<void> {
  const group = getGroup(groupId);
  group.cursor = null;
  return fetchGroup(groupId, true).then(() => schedule(group));
}

/**
 * Adds a locally-submitted answer to the cache immediately, so a dashboard open
 * on the same page reflects it without waiting for the next poll.
 */
export function recordLocalAnswer(row: AnswerRow): void {
  const group = getGroup(row.group_id);
  if (mergeRows(group, [row])) publish(group);
}

/** Submit one attempt. Never throws for network reasons — it queues instead. */
export async function submitAnswer(
  row: PendingAnswerRow,
): Promise<{ delivered: boolean; error?: string }> {
  const optimistic: AnswerRow = { ...row, created_at: new Date().toISOString() };
  try {
    await getTransport().submit(row);
    recordLocalAnswer(optimistic);
    void flushOutbox();
    return { delivered: true };
  } catch (error) {
    enqueue(row);
    recordLocalAnswer(optimistic);
    return { delivered: false, error: error instanceof Error ? error.message : String(error) };
  }
}

let flushing = false;

export async function flushOutbox(): Promise<number> {
  if (flushing) return 0;
  const queued = readOutbox();
  if (queued.length === 0) return 0;
  flushing = true;
  let sent = 0;
  try {
    const transport = getTransport();
    for (const row of queued) {
      try {
        await transport.submit(row);
        dequeue(row.id);
        sent += 1;
      } catch {
        break; // Still offline; keep the rest queued for the next attempt.
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOutbox());
}
