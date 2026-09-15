import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getIdleReason,
  getIdleVersion,
  isPollingPaused,
  resumePolling,
  subscribeToIdle,
  type IdleReason,
} from './idle';
import { getStudent, isIdentityLoaded, subscribeToIdentity, type Student } from './identity';
import {
  getLocale,
  getMessages,
  setLocale,
  subscribeToLocale,
  DEFAULT_LOCALE,
  type Locale,
  type Messages,
} from './i18n';
import { resolveQuestion, tryResolveQuestion } from './registry';
import type { GroupScope, GroupSnapshot } from './runtime';
import {
  getGroupSnapshot,
  getKnownSessions,
  getServerGroupSnapshot,
  getSessionsVersion,
  refreshGroup,
  subscribeToGroup,
  subscribeToSessions,
} from './store';
import { summariseQuestion, type QuestionSummary } from './aggregate';
import type { Question } from './types';

export interface LocaleControls {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
}

/**
 * The active interface language. Every component reads its text through this,
 * so switching language re-renders all of them at once — including islands in
 * other Astro roots, which the locale store notifies directly.
 */
export function useLocale(): LocaleControls {
  const locale = useSyncExternalStore(subscribeToLocale, getLocale, () => DEFAULT_LOCALE);
  return { locale, messages: getMessages(locale), setLocale };
}

/** Shorthand for components that only need the strings. */
export function useMessages(): Messages {
  return useLocale().messages;
}

export function useStudent(): { student: Student | null; loaded: boolean } {
  const student = useSyncExternalStore(subscribeToIdentity, getStudent, () => null);
  const loaded = useSyncExternalStore(subscribeToIdentity, isIdentityLoaded, () => false);
  return { student, loaded };
}

/**
 * Answers for one scope — a group, optionally narrowed to a single session.
 *
 * Takes the scope apart into primitives before building the callbacks, because
 * callers pass an object literal and a new identity every render would tear the
 * subscription down and back up on each one.
 */
export function useGroupAnswers(scope: GroupScope): GroupSnapshot & { refresh: () => void } {
  const { groupId, sessionId } = scope;
  const subscribe = useCallback(
    (listener: () => void) => subscribeToGroup({ groupId, sessionId }, listener),
    [groupId, sessionId],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getGroupSnapshot({ groupId, sessionId }),
    () => getServerGroupSnapshot({ groupId, sessionId }),
  );
  const refresh = useCallback(() => void refreshGroup({ groupId, sessionId }), [groupId, sessionId]);
  return { ...snapshot, refresh };
}

const NO_SESSIONS: readonly string[] = [];

/**
 * Every session id seen so far across the given groups, sorted.
 *
 * Feeds the session picker. It reads an index that accumulates rather than the
 * rows on screen, because once a dashboard is filtered to one session its
 * poller only ever returns that session — and the picker still has to offer
 * the others.
 */
export function useSessionIds(groupIds: string | readonly string[]): readonly string[] {
  // Group ids cannot contain a comma (they match /^[A-Za-z0-9_.-]+$/), so this
  // is a safe stable dependency for the memo below.
  const key = typeof groupIds === 'string' ? groupIds : groupIds.join(',');
  const version = useSyncExternalStore(subscribeToSessions, getSessionsVersion, () => 0);
  return useMemo(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 1) return getKnownSessions(ids[0] as string);
    const union = new Set<string>();
    for (const id of ids) for (const session of getKnownSessions(id)) union.add(session);
    return union.size === 0 ? NO_SESSIONS : [...union].sort();
    // `version` is the store signal; `key` is which groups to union.
  }, [key, version]);
}

export interface IdleControls {
  paused: boolean;
  reason: IdleReason | null;
  resume: () => void;
}

export function useIdleState(): IdleControls {
  useSyncExternalStore(
    subscribeToIdle,
    getIdleVersion,
    () => 0,
  );
  return {
    paused: isPollingPaused(),
    reason: getIdleReason(),
    resume: resumePolling,
  };
}

/**
 * Accepts either a question object (React and MDX callers) or its
 * `"<groupId>/<questionId>"` id (Astro islands, whose props must be JSON).
 */
export function useQuestion(q: Question | undefined, id: string | undefined): Question {
  return useMemo(() => {
    if (q) return q;
    if (!id) {
      throw new Error('[askq] Pass either a `q` question object or an `id` like "lesson-1/q1".');
    }
    return resolveQuestion(id);
  }, [q, id]);
}

/** Keeps a scope's poller alive for as long as the component is mounted. */
export function useGroupSubscription(scope: GroupScope): void {
  const { groupId, sessionId } = scope;
  useEffect(() => subscribeToGroup({ groupId, sessionId }, () => {}), [groupId, sessionId]);
}

/** Pass `sessionId` to score one session's answers; omit it to score them all. */
export function useQuestionSummary(
  question: Question,
  sessionId?: string,
): QuestionSummary & { snapshot: GroupSnapshot } {
  const snapshot = useGroupAnswers({ groupId: question.groupId, sessionId });
  const summary = useMemo(
    () => summariseQuestion(question, [...snapshot.rows]),
    [question, snapshot.rows],
  );
  return { ...summary, snapshot };
}

export { tryResolveQuestion };
