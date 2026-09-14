import { registerQuestion } from './registry';
import type { Question, QuestionBase } from './types';

/** A question as written in a question bank: no `groupId`, no `questionId`. */
export type QuestionInput = {
  [K in Question as K['type']]: Omit<K, keyof Pick<QuestionBase, 'groupId' | 'questionId'>>;
}[Question['type']];

/**
 * Ids end up in a URL path and in a database column with the same constraint,
 * so an id with a slash or a space would fail at submit time, in front of a
 * class. Fail at authoring time instead.
 */
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function assertValidId(kind: 'groupId' | 'questionId', value: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new Error(
      `[askq] Invalid ${kind} "${value}". Use 1-64 characters from A-Z a-z 0-9 _ . - ` +
        `— ids appear in dashboard URLs and in the database.`,
    );
  }
}

function assertValid(question: Question): void {
  const where = `${question.groupId}/${question.questionId}`;
  assertValidId('questionId', question.questionId);

  if (!question.question || !question.question.trim()) {
    throw new Error(`[askq] ${where}: "question" is empty.`);
  }

  if (question.type === 'multiple-choice' || question.type === 'button-choice') {
    if (!question.options?.length) throw new Error(`[askq] ${where}: needs at least one option.`);
    if (new Set(question.options).size !== question.options.length) {
      throw new Error(
        `[askq] ${where}: options must be unique — the stored answer is the option's text.`,
      );
    }
    if (question.correctAnswer !== undefined && !question.options.includes(question.correctAnswer)) {
      throw new Error(
        `[askq] ${where}: correctAnswer "${question.correctAnswer}" is not one of the options. ` +
          `Everyone would be marked wrong.`,
      );
    }
  }

  if (question.type === 'checkboxes') {
    if (!question.options?.length) throw new Error(`[askq] ${where}: needs at least one option.`);
    if (new Set(question.options).size !== question.options.length) {
      throw new Error(`[askq] ${where}: options must be unique.`);
    }
    for (const answer of question.correctAnswer ?? []) {
      if (!question.options.includes(answer)) {
        throw new Error(`[askq] ${where}: correctAnswer "${answer}" is not one of the options.`);
      }
    }
  }

  if (question.type === 'scale') {
    const { min, max, countBy } = question.config;
    if (!(max > min)) throw new Error(`[askq] ${where}: scale max must be greater than min.`);
    if (countBy !== undefined && countBy <= 0) {
      throw new Error(`[askq] ${where}: scale countBy must be positive.`);
    }
  }

  if (question.type === 'rating') {
    const max = question.config?.max ?? 5;
    if (max < 2) throw new Error(`[askq] ${where}: rating max must be at least 2.`);
  }
}

/**
 * Turns a question bank into fully-formed questions: `groupId` comes from the
 * first argument, `questionId` from each key, so neither can be mistyped or
 * fall out of sync with the object it sits in.
 */
export function defineGroup<const T extends Record<string, QuestionInput>>(
  groupId: string,
  questions: T,
): { [K in keyof T]: Extract<Question, { type: T[K]['type'] }> } {
  assertValidId('groupId', groupId);

  const out = {} as Record<string, Question>;
  for (const [questionId, input] of Object.entries(questions)) {
    const question = { ...input, groupId, questionId } as Question;
    assertValid(question);
    registerQuestion(question);
    out[questionId] = question;
  }
  return out as { [K in keyof T]: Extract<Question, { type: T[K]['type'] }> };
}
