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
import { resolveQuestion, tryResolveQuestion } from './registry';
import type { GroupSnapshot } from './runtime';
import { getGroupSnapshot, getServerGroupSnapshot, refreshGroup, subscribeToGroup } from './store';
import { summariseQuestion, type QuestionSummary } from './aggregate';
import type { Question } from './types';

export function useStudent(): { student: Student | null; loaded: boolean } {
  const student = useSyncExternalStore(subscribeToIdentity, getStudent, () => null);
  const loaded = useSyncExternalStore(subscribeToIdentity, isIdentityLoaded, () => false);
  return { student, loaded };
}

export function useGroupAnswers(groupId: string): GroupSnapshot & { refresh: () => void } {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToGroup(groupId, listener),
    [groupId],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getGroupSnapshot(groupId),
    () => getServerGroupSnapshot(groupId),
  );
  const refresh = useCallback(() => void refreshGroup(groupId), [groupId]);
  return { ...snapshot, refresh };
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

/** Keeps a group's poller alive for as long as the component is mounted. */
export function useGroupSubscription(groupId: string): void {
  useEffect(() => subscribeToGroup(groupId, () => {}), [groupId]);
}

export function useQuestionSummary(question: Question): QuestionSummary & { snapshot: GroupSnapshot } {
  const snapshot = useGroupAnswers(question.groupId);
  const summary = useMemo(
    () => summariseQuestion(question, [...snapshot.rows]),
    [question, snapshot.rows],
  );
  return { ...summary, snapshot };
}

export { tryResolveQuestion };
