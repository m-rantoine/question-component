/**
 * Controls what a student is told after they submit.
 *
 * - `never`      no feedback at all: no right/wrong, no answer.
 * - `if-correct` shows right or wrong, but never reveals the correct answer.
 * - `always`     shows right or wrong AND reveals the correct answer.
 *
 * Feedback is only ever shown after a submission, never before.
 */
export type Reveal = 'never' | 'if-correct' | 'always';

export interface QuestionBase {
  /** Stable id for the group this question belongs to, e.g. `lesson-1`. */
  groupId: string;
  /** Stable id for the question, unique within its group. */
  questionId: string;
  /** Question text, written as markdown (see `renderMarkdown` for the supported subset). */
  question: string;
  /** Defaults to `never`. */
  showCorrectAnswer?: Reveal;
  /**
   * Defaults to `true`. When `false` the student is locked out after their first
   * submission, and reads (summary and per-student views) use their EARLIEST
   * attempt so that a second attempt slipping through cannot overwrite the first.
   */
  allowMultipleAttempts?: boolean;
}

export interface ShortTextQuestion extends QuestionBase {
  type: 'short-text';
  /** Any listed variant counts as correct. Compared after normalisation. */
  correctAnswer?: string[];
  /** Defaults to `false`: answers are compared case-insensitively. */
  caseSensitive?: boolean;
  /** Escape hatch for grading that a variant list cannot express. Receives the raw answer. */
  match?: (raw: string) => boolean;
  placeholder?: string;
  maxLength?: number;
}

export interface LongTextQuestion extends QuestionBase {
  type: 'long-text';
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
}

export interface ChoiceQuestion extends QuestionBase {
  /** `multiple-choice` renders radios; `button-choice` renders the same data as buttons. */
  type: 'multiple-choice' | 'button-choice';
  options: string[];
  /** The option's own text, not its index — reordering options must not change meaning. */
  correctAnswer?: string;
}

export interface CheckboxesQuestion extends QuestionBase {
  type: 'checkboxes';
  options: string[];
  correctAnswer?: string[];
  /**
   * When true the summary reports an average partial score alongside the
   * exact-match rate. Right/wrong shown to a student is always exact match.
   */
  partialCredit?: boolean;
}

export interface NumberQuestion extends QuestionBase {
  type: 'number';
  config?: { min?: number; max?: number; step?: number; tolerance?: number };
  correctAnswer?: number;
}

export interface ScaleQuestion extends QuestionBase {
  type: 'scale';
  config: { min: number; max: number; countBy?: number; minLabel?: string; maxLabel?: string };
  correctAnswer?: number;
}

export interface RatingQuestion extends QuestionBase {
  type: 'rating';
  config?: { max?: number };
  correctAnswer?: number;
}

export type Question =
  | ShortTextQuestion
  | LongTextQuestion
  | ChoiceQuestion
  | CheckboxesQuestion
  | NumberQuestion
  | ScaleQuestion
  | RatingQuestion;

export type QuestionType = Question['type'];

/** Everything that can land in the `answer` jsonb column. */
export type AnswerValue = string | string[] | number;

/** One attempt. `id` is minted client-side so a retried submit cannot duplicate a row. */
export interface AnswerRow {
  id: string;
  student_id: string;
  student_name: string;
  /**
   * Which run of these questions this answer belongs to — a class period, a
   * section, or the same lesson taught again next term. `null` means unscoped.
   */
  session_id: string | null;
  group_id: string;
  question_id: string;
  answer: AnswerValue;
  /** Set by Postgres on insert; present on every row read back. */
  created_at: string;
}

/** A row on its way to the server — `created_at` is the database's job. */
export type PendingAnswerRow = Omit<AnswerRow, 'created_at'>;

/** A group as produced by `defineGroup`. */
export type QuestionGroup<K extends string = string> = Record<K, Question> & {
  /** Non-enumerable helpers are avoided; the group id lives on every question. */
  readonly __groupId: string;
};
