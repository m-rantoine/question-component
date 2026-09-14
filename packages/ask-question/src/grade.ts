import { getMessages } from './i18n';
import type { AnswerValue, Question } from './types';

/** Trim, collapse internal whitespace, and (unless case-sensitive) lowercase. */
export function normaliseText(value: string, caseSensitive = false): string {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

/** `true` when the question has a correct answer that can be checked automatically. */
export function isGraded(question: Question): boolean {
  if (question.type === 'long-text') return false;
  if (question.type === 'short-text') {
    return Boolean(question.match) || Boolean(question.correctAnswer?.length);
  }
  if (question.type === 'checkboxes') return Boolean(question.correctAnswer?.length);
  return question.correctAnswer !== undefined;
}

function asString(value: AnswerValue): string {
  return typeof value === 'string' ? value : String(value);
}

function asStringArray(value: AnswerValue): string[] {
  return Array.isArray(value) ? value : [asString(value)];
}

/**
 * Score in the range 0..1. `null` when the question is not graded.
 *
 * Only `checkboxes` with `partialCredit` can produce a value strictly between
 * 0 and 1; everything else is 0 or 1.
 */
export function scoreAnswer(question: Question, value: AnswerValue): number | null {
  if (!isGraded(question)) return null;

  switch (question.type) {
    case 'short-text': {
      const raw = asString(value);
      if (question.match) return question.match(raw) ? 1 : 0;
      const needle = normaliseText(raw, question.caseSensitive);
      const hit = (question.correctAnswer ?? []).some(
        (candidate) => normaliseText(candidate, question.caseSensitive) === needle,
      );
      return hit ? 1 : 0;
    }

    case 'multiple-choice':
    case 'button-choice':
      return asString(value) === question.correctAnswer ? 1 : 0;

    case 'checkboxes': {
      const expected = new Set(question.correctAnswer ?? []);
      const picked = new Set(asStringArray(value));
      const hits = [...picked].filter((option) => expected.has(option)).length;
      const misses = [...picked].filter((option) => !expected.has(option)).length;
      const exact = hits === expected.size && misses === 0;
      if (!question.partialCredit) return exact ? 1 : 0;
      if (expected.size === 0) return exact ? 1 : 0;
      return Math.max(0, Math.min(1, (hits - misses) / expected.size));
    }

    case 'number': {
      const tolerance = question.config?.tolerance ?? 0;
      return Math.abs(Number(value) - (question.correctAnswer as number)) <= tolerance ? 1 : 0;
    }

    case 'scale':
    case 'rating':
      return Number(value) === question.correctAnswer ? 1 : 0;

    default:
      return null;
  }
}

/** Right or wrong, as shown to a student. Always exact match, even with partial credit on. */
export function gradeAnswer(question: Question, value: AnswerValue): boolean | null {
  if (!isGraded(question)) return null;
  if (question.type === 'checkboxes') {
    const expected = new Set(question.correctAnswer ?? []);
    const picked = new Set(asStringArray(value));
    if (expected.size !== picked.size) return false;
    return [...expected].every((option) => picked.has(option));
  }
  const score = scoreAnswer(question, value);
  return score === null ? null : score === 1;
}

/** The correct answer as display text, or `null` when there isn't one to show. */
export function formatCorrectAnswer(question: Question): string | null {
  switch (question.type) {
    case 'short-text': {
      const variants = question.correctAnswer ?? [];
      if (!variants.length) return null;
      return variants[0] as string;
    }
    case 'multiple-choice':
    case 'button-choice':
      return question.correctAnswer ?? null;
    case 'checkboxes':
      return question.correctAnswer?.length ? question.correctAnswer.join(', ') : null;
    case 'number':
    case 'scale':
      return question.correctAnswer === undefined ? null : String(question.correctAnswer);
    case 'rating':
      return question.correctAnswer === undefined
        ? null
        : getMessages().ratingOf(question.correctAnswer, question.config?.max ?? 5);
    default:
      return null;
  }
}

/**
 * Renders an answer value for display in the dashboard.
 *
 * Only the surrounding wording is translated — the answer itself is shown
 * exactly as the student submitted it.
 */
export function formatAnswer(question: Question, value: AnswerValue): string {
  const messages = getMessages();
  if (Array.isArray(value)) return value.length ? value.join(', ') : messages.nothingSelected;
  if (question.type === 'rating') return messages.ratingOf(value, question.config?.max ?? 5);
  const text = asString(value);
  return text.trim() ? text : messages.blankAnswer;
}
