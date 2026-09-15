import { isPollingPaused, subscribeToIdle } from './idle';
import { dequeue, enqueue, readOutbox } from './outbox';
import { runtime, scopeKey, type GroupScope, type GroupSnapshot, type GroupState } from './runtime';
import { getTransport } from './transport';
import type { AnswerRow, PendingAnswerRow } from './types';

/** Re-ask for a little before the newest row we hold, so a row committed
 *  mid-request is not skipped by the cursor. */
const CURSOR_OVERLAP_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

// One frozen empty snapshot per scope. `useSyncExternalStore` compares
// snapshots by identity, so returning a fresh object here would loop forever.
const EMPTY_SNAPSHOTS = new Map<string, GroupSnapshot>();

function emptySnapshot(scope: GroupScope): GroupSnapshot {
  const key = scopeKey(scope);
  let snapshot = EMPTY_SNAPSHOTS.get(key);
  if (!snapshot) {
    snapshot = {
      groupId: scope.groupId,
      sessionId: scope.sessionId,
      rows: [],
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    };
    EMPTY_SNAPSHOTS.set(key, snapshot);
  }
  return snapshot;
}

function getGroup(scope: GroupScope): GroupState {
  const key = scopeKey(scope);
  let group = runtime.groups.get(key);
  if (!group) {
    group = {
      key,
      groupId: scope.groupId,
      sessionId: scope.sessionId,
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
      snapshot: emptySnapshot(scope),
    };
    runtime.groups.set(key, group);
  }
  return group;
}

/** The scope a cached group was opened with. */
function scopeOf(group: GroupState): GroupScope {
  return { groupId: group.groupId, sessionId: group.sessionId };
}

function publish(group: GroupState): void {
  group.snapshot = {
    groupId: group.groupId,
    sessionId: group.sessionId,
    rows: group.rows,
    status: group.status,
    error: group.error,
    lastFetchedAt: group.lastFetchedAt,
  };
  for (const listener of [...group.listeners]) listener();
}

const NO_SESSIONS: readonly string[] = [];

/** Record any session ids we have not seen for this group, and notify if new. */
function noteSessions(groupId: string, rows: readonly AnswerRow[]): void {
  const index = runtime.sessions;
  let known = index.byGroup.get(groupId);
  if (!known) {
    known = new Set();
    index.byGroup.set(groupId, known);
  }
  let added = false;
  for (const row of rows) {
    if (row.session_id && !known.has(row.session_id)) {
      known.add(row.session_id);
      added = true;
    }
  }
  if (!added) return;
  // A new array only when the set grew: `useSyncExternalStore` compares by identity.
  index.snapshots.set(groupId, [...known].sort());
  index.version += 1;
  for (const listener of [...index.listeners]) listener();
}

/** Every session id seen for a group, sorted. Accumulates across filters. */
export function getKnownSessions(groupId: string): readonly string[] {
  return runtime.sessions.snapshots.get(groupId) ?? NO_SESSIONS;
}

export function getSessionsVersion(): number {
  return runtime.sessions.version;
}

export function subscribeToSessions(listener: () => void): () => void {
  runtime.sessions.listeners.add(listener);
  return () => {
    runtime.sessions.listeners.delete(listener);
  };
}

/** Merge fetched rows, dropping ids we already hold and keeping chronological order. */
function mergeRows(group: GroupState, incoming: AnswerRow[]): boolean {
  noteSessions(group.groupId, incoming);
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

async function fetchGroup(scope: GroupScope, full = false): Promise<void> {
  const group = getGroup(scope);
  if (group.inFlight) return;
  group.inFlight = true;
  if (group.status === 'idle') {
    group.status = 'loading';
    publish(group);
  }

  try {
    const since = full ? null : group.cursor;
    const rows = await getTransport().fetchAnswers(scope, since);
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
  group.timer = setTimeout(() => void poll(scopeOf(group)), nextDelay(group));
}

async function poll(scope: GroupScope): Promise<void> {
  const group = getGroup(scope);
  if (group.subscribers === 0) return;
  if (!isPollingPaused()) await fetchGroup(scope);
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
          void fetchGroup(scopeOf(group), true).then(() => schedule(group));
        }
      }
    }
    wasPaused = paused;
  });
}

/**
 * Subscribe to one scope's answers. The first subscriber starts the poller; the
 * last stops it. A scope is a group plus an optional session, so a dashboard
 * filtered to period 2 polls separately from one showing every session.
 */
export function subscribeToGroup(scope: GroupScope, listener: () => void): () => void {
  const group = getGroup(scope);
  group.listeners.add(listener);
  group.subscribers += 1;
  watchIdle();

  if (group.subscribers === 1) {
    void fetchGroup(scope, group.rows.length === 0).then(() => schedule(group));
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

export function getGroupSnapshot(scope: GroupScope): GroupSnapshot {
  return runtime.groups.get(scopeKey(scope))?.snapshot ?? emptySnapshot(scope);
}

/** Server render has no answers; the same cached instance keeps hydration stable. */
export function getServerGroupSnapshot(scope: GroupScope): GroupSnapshot {
  return emptySnapshot(scope);
}

export function refreshGroup(scope: GroupScope): Promise<void> {
  const group = getGroup(scope);
  group.cursor = null;
  return fetchGroup(scope, true).then(() => schedule(group));
}

/**
 * Adds a locally-submitted answer to the cache immediately, so a dashboard open
 * on the same page reflects it without waiting for the next poll.
 *
 * The row lands in every cached scope that would have fetched it: its own
 * session, and any all-sessions view of the same group.
 */
export function recordLocalAnswer(row: AnswerRow): void {
  for (const group of runtime.groups.values()) {
    if (group.groupId !== row.group_id) continue;
    if (group.sessionId !== undefined && group.sessionId !== row.session_id) continue;
    if (mergeRows(group, [row])) publish(group);
  }
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
