import { registerQuestion } from './registry';
import type { Question, QuestionBase } from './types';

/** A question as written in a question bank: no `groupId`, no `questionId`. */
export type QuestionInput = {
  [K in Question as K['type']]: Omit<K, keyof Pick<QuestionBase, 'groupId' | 'questionId'>>;
}[Question['type']];

function assertValid(question: Question): void {
  const where = `${question.groupId}/${question.questionId}`;

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
  if (!groupId.trim()) throw new Error('[askq] defineGroup: groupId is required.');

  const out = {} as Record<string, Question>;
  for (const [questionId, input] of Object.entries(questions)) {
    const question = { ...input, groupId, questionId } as Question;
    assertValid(question);
    registerQuestion(question);
    out[questionId] = question;
  }
  return out as { [K in keyof T]: Extract<Question, { type: T[K]['type'] }> };
}
