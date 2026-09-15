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

export function registerQuestion(question: Question): void {
  const key = questionKey(question.groupId, question.questionId);
  const existing = registry.get(key);
  if (existing && existing !== question) {
    throw new Error(
      `[askq] Duplicate question id "${key}". Question ids must be unique within a group — ` +
        `they are the database key for every answer.`,
    );
  }
  registry.set(key, question);
  const list = groups.get(question.groupId) ?? [];
  if (!list.includes(question)) list.push(question);
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
