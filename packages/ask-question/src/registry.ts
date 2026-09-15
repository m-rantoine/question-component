import { globalState } from './globalState';
import type { Question } from './types';

/**
 * Questions are looked up by `"<groupId>/<questionId>"` so that an Astro island
 * can be handed a plain string prop. Astro serialises island props as JSON, so
 * passing the question object itself only works from inside React.
 */
const state = globalState('__askq_registry_v1', () => ({
  registry: new Map<string, Question>(),
  groups: new Map<string, Question[]>(),
}));
const { registry, groups } = state;

export function questionKey(groupId: string, questionId: string): string {
  return `${groupId}/${questionId}`;
}

/**
 * A comparable form of a question, used to tell a real id collision from the
 * same bank being registered twice.
 *
 * Bundlers duplicate modules more often than it seems: a Next app importing the
 * bank from both a Server Component and a `"use client"` module evaluates it
 * once per graph, in the same process, producing two distinct objects with the
 * same ids. A `match` function cannot be compared, so both sides collapse to a
 * marker — two banks that differ only in the body of a `match` are treated as
 * the same question, which is the safe way round.
 */
function fingerprint(question: Question): string {
  return JSON.stringify(question, (_key, value) =>
    typeof value === 'function' ? '[function]' : value,
  );
}

/** Enough of a question to see what differs, without filling the console. */
function brief(question: Question): string {
  const text = fingerprint(question);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function registerQuestion(question: Question): void {
  const key = questionKey(question.groupId, question.questionId);
  const existing = registry.get(key);
  if (existing) {
    // Re-registering the identical question is a duplicated module, not a
    // mistake. Two different questions under one id is the real error: it would
    // put two questions' answers in one database bucket.
    if (existing === question || fingerprint(existing) === fingerprint(question)) return;
    throw new Error(
      `[askq] Duplicate question id "${key}". Question ids must be unique within a group — ` +
        `they are the database key for every answer.\n` +
        `  already registered: ${brief(existing)}\n` +
        `  now registering:    ${brief(question)}`,
    );
  }
  registry.set(key, question);
  const list = groups.get(question.groupId) ?? [];
  list.push(question);
  groups.set(question.groupId, list);
}

/** Throws when the id is unknown, because a silent miss would look like "nobody answered". */
export function resolveQuestion(id: string): Question {
  const question = registry.get(id);
  if (!question) {
    const known = [...registry.keys()].sort().join(', ') || '(none registered)';
    throw new Error(
      `[askq] Unknown question id "${id}". Registered ids: ${known}. ` +
        `If this is a React Server Components app, the usual cause is importing the question ` +
        `bank only on the server — it has to reach the browser bundle for id lookup to work. ` +
        `Import it from a "use client" module, or pass the question object as q={...} instead.`,
    );
  }
  return question;
}

export function tryResolveQuestion(id: string): Question | undefined {
  return registry.get(id);
}

/** Every group id that has registered questions, in first-seen order. */
export function registeredGroupIds(): string[] {
  return [...groups.keys()];
}

/** Every registered question in a group, in declaration order. */
export function questionsInGroup(groupId: string): Question[] {
  return [...(groups.get(groupId) ?? [])];
}

/** Test helper — the registry is module state and would otherwise leak between cases. */
export function resetRegistry(): void {
  registry.clear();
  groups.clear();
}
