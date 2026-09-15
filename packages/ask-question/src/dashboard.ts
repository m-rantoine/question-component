"use client";

/**
 * Teacher-facing entry point.
 *
 * Kept separate from `.` so a student page never downloads the charts, the
 * aggregation code or the CSV writer — none of which it can use.
 */

export {
  AnswerDashboard,
  type AnswerDashboardCommon,
  type AnswerDashboardProps,
  type DashboardTarget,
} from './components/AnswerDashboard';
export { SeeAnswers, type AnswersView, type SeeAnswersProps } from './components/SeeAnswers';
export { TeacherLogin, type TeacherLoginProps } from './components/TeacherLogin';
export { AnswersProvider, type AnswersProviderProps } from './providers';

export {
  useGroupAnswers,
  useGroupSubscription,
  useQuestionSummary,
  useSessionIds,
} from './hooks';

export {
  CSV_COLUMNS,
  csvFilename,
  downloadCsv,
  toCsv,
  type CsvFilenameParts,
  type CsvOptions,
} from './csv';

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
