"use client";

/**
 * Teacher-facing entry point.
 *
 * Kept separate from `.` so a student page never downloads the charts, the
 * aggregation code or the CSV writer — none of which it can use.
 */

export { SeeAnswers, type AnswersView, type SeeAnswersProps } from './components/SeeAnswers';
export { AnswersProvider, type AnswersProviderProps } from './providers';

export {
  useGroupAnswers,
  useGroupSubscription,
  useQuestionSummary,
} from './hooks';

export {
  attemptStats,
  groupByStudent,
  summariseNumeric,
  summariseQuestion,
  tallyOptions,
  tallyText,
  type AttemptStats,
  type NumericSummary,
  type QuestionSummary,
  type StudentResult,
  type Tally,
} from './aggregate';
