/**
 * The client-free half of the library: authoring a question bank, and the pure
 * functions that grade one.
 *
 * Deliberately carries NO `"use client"` directive, and is bundled without code
 * splitting so it shares no chunk with the components.
 *
 * This entry exists because of React Server Components. `@askq/react` has to be
 * a client module — it exports components that call `useState` — and in the App
 * Router that marks everything it re-exports, `defineGroup` included. A Server
 * Component importing a question bank would then fail with "Attempted to call
 * defineGroup() from the server", which is exactly what a page doing
 * `<AskQuestion q={bank.q1} />` needs to do.
 *
 *   // app/questions/lesson-one.ts — importable from server and client alike
 *   import { defineGroup } from '@askq/react/questions';
 *
 * Everything here is also exported from `@askq/react`, which is what an Astro or
 * client-only app should use. The two copies stay consistent because the
 * registry lives on `globalThis`, not in module scope.
 */

export { defineGroup, type QuestionInput } from './defineGroup';

export {
  questionKey,
  questionsInGroup,
  registerQuestion,
  registeredGroupIds,
  resetRegistry,
  resolveQuestion,
  tryResolveQuestion,
} from './registry';

export {
  formatAnswer,
  formatCorrectAnswer,
  gradeAnswer,
  isGraded,
  normaliseText,
  scoreAnswer,
} from './grade';

export type {
  AnswerRow,
  AnswerValue,
  CheckboxesQuestion,
  ChoiceQuestion,
  LongTextQuestion,
  NumberQuestion,
  PendingAnswerRow,
  Question,
  QuestionBase,
  QuestionGroup,
  QuestionType,
  RatingQuestion,
  Reveal,
  ScaleQuestion,
  ShortTextQuestion,
} from './types';
