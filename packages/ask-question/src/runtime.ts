import type { AnswerRow } from './types';

export interface AskqConfig {
  /** Supabase project URL. Answers are inserted straight from the browser. */
  supabaseUrl?: string;
  /** Anon key. RLS makes it insert-only, so it is safe in the client bundle. */
  supabaseAnonKey?: string;
  /** Server route that reads results with the service-role key. */
  readEndpoint: string;
  /**
   * Default run identifier attached to every answer — a class period, section
   * or term. Individual components can override it. Leave unset for one
   * permanent pool of answers per group.
   */
  sessionId?: string;
  /** How often the dashboard polls, in ms. */
  pollMs: number;
  /** Idle time before polling pauses, in ms. */
  idleMs: number;
  /** Hard stop for a polling session regardless of activity, in ms. */
  maxSessionMs: number;
  /** Replaces the built-in transport entirely. Used by tests and the offline demo. */
  transport?: Transport;
}

export interface GroupScope {
  groupId: string;
  /** Omit to read every session, including answers with no session at all. */
  sessionId?: string;
}

/** Cache and poller key. One scope is one poller and one row cache. */
export function scopeKey(scope: GroupScope): string {
  return `${scope.groupId}|${scope.sessionId ?? ''}`;
}

export interface Transport {
  submit(row: Omit<AnswerRow, 'created_at'>): Promise<void>;
  fetchAnswers(scope: GroupScope, since: string | null): Promise<AnswerRow[]>;
}

export type GroupStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Immutable view handed to React. Replaced wholesale on every change. */
export interface GroupSnapshot {
  groupId: string;
  sessionId: string | undefined;
  rows: readonly AnswerRow[];
  status: GroupStatus;
  error: string | null;
  lastFetchedAt: number | null;
}

export interface GroupState {
  /** `${groupId}|${sessionId ?? ''}` — see scopeKey(). */
  key: string;
  groupId: string;
  sessionId: string | undefined;
  rows: AnswerRow[];
  seen: Set<string>;
  cursor: string | null;
  status: GroupStatus;
  error: string | null;
  lastFetchedAt: number | null;
  listeners: Set<() => void>;
  subscribers: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  failures: number;
  snapshot: GroupSnapshot;
}

export interface IdleState {
  paused: boolean;
  reason: 'idle' | 'hidden' | 'session-limit' | null;
  lastActivityAt: number;
  sessionStartedAt: number;
  listeners: Set<() => void>;
  installed: boolean;
  timer: ReturnType<typeof setInterval> | null;
  version: number;
}

export interface Runtime {
  config: AskqConfig;
  groups: Map<string, GroupState>;
  idle: IdleState;
  warnedAboutMemory: boolean;
  /** Shared in-memory transport used when Supabase is not configured. */
  memoryTransport: Transport | null;
}

const DEFAULT_CONFIG: AskqConfig = {
  readEndpoint: '/api/answers',
  pollMs: 5000,
  idleMs: 60_000,
  maxSessionMs: 30 * 60_000,
};

function createRuntime(): Runtime {
  return {
    config: { ...DEFAULT_CONFIG },
    groups: new Map(),
    idle: {
      paused: false,
      reason: null,
      lastActivityAt: Date.now(),
      sessionStartedAt: Date.now(),
      listeners: new Set(),
      installed: false,
      timer: null,
      version: 0,
    },
    warnedAboutMemory: false,
    memoryTransport: null,
  };
}

const RUNTIME_KEY = '__askq_runtime_v1';

/**
 * Pinned to `globalThis` rather than kept in module scope.
 *
 * Astro renders every `client:*` component as its own React root, and depending
 * on how Vite chunks the build those roots can end up with separate copies of a
 * module. Two copies here would mean two pollers and two answer caches, so the
 * runtime is deliberately global: one per page, no matter the bundling.
 */
export const runtime: Runtime = (() => {
  const host = globalThis as typeof globalThis & { [RUNTIME_KEY]?: Runtime };
  if (!host[RUNTIME_KEY]) host[RUNTIME_KEY] = createRuntime();
  return host[RUNTIME_KEY] as Runtime;
})();

/** Merge configuration. Safe to call from every island — later calls only override what they set. */
export function configure(partial: Partial<AskqConfig>): void {
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      (runtime.config as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

export function getConfig(): Readonly<AskqConfig> {
  return runtime.config;
}

/** True when answers are being kept in memory because Supabase was never configured. */
export function isOfflineMode(): boolean {
  const { supabaseUrl, supabaseAnonKey, transport } = runtime.config;
  return !transport && !(supabaseUrl && supabaseAnonKey);
}

/** Test helper — drops all cached answers, timers and configuration. */
export function resetRuntime(): void {
  for (const group of runtime.groups.values()) {
    if (group.timer) clearTimeout(group.timer);
  }
  runtime.groups.clear();
  if (runtime.idle.timer) clearInterval(runtime.idle.timer);
  runtime.config = { ...DEFAULT_CONFIG };
  runtime.idle = createRuntime().idle;
  runtime.warnedAboutMemory = false;
  runtime.memoryTransport = null;
}
