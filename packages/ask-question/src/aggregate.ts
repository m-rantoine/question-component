import { nameKey, normaliseName } from './identity';
import { formatAnswer, gradeAnswer, isGraded, normaliseText, scoreAnswer } from './grade';
import type { AnswerRow, AnswerValue, Question } from './types';

export interface StudentResult {
  /** Lower-cased, whitespace-collapsed name — the grouping key. */
  key: string;
  /** Display name, taken from the most recent attempt. */
  name: string;
  /** Every attempt by this student, oldest first. */
  attempts: AnswerRow[];
  /** The attempt that counts: latest, or earliest when retries are disallowed. */
  effective: AnswerRow;
  correct: boolean | null;
  score: number | null;
}

export interface AttemptStats {
  students: number;
  min: number;
  max: number;
  /** Mean attempts per student, rounded to one decimal. */
  avg: number;
  total: number;
}

/**
 * Attempts are grouped by normalised name rather than by `student_id`.
 *
 * A student who logs out and back in gets a fresh id, and a teacher should not
 * see them twice. The trade-off is explicit: two real students sharing a name
 * are merged into one row.
 */
export function groupByStudent(question: Question, rows: AnswerRow[]): StudentResult[] {
  const allowRetries = question.allowMultipleAttempts !== false;
  const byStudent = new Map<string, AnswerRow[]>();

  for (const row of rows) {
    if (row.question_id !== question.questionId || row.group_id !== question.groupId) continue;
    const key = nameKey(row.student_name);
    const list = byStudent.get(key);
    if (list) list.push(row);
    else byStudent.set(key, [row]);
  }

  const results: StudentResult[] = [];
  for (const [key, attempts] of byStudent) {
    attempts.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    // When retries are off, a second attempt that slipped through is ignored:
    // the first answer stands.
    const effective = (allowRetries ? attempts[attempts.length - 1] : attempts[0]) as AnswerRow;
    const latest = attempts[attempts.length - 1] as AnswerRow;
    results.push({
      key,
      name: normaliseName(latest.student_name),
      attempts,
      effective,
      correct: gradeAnswer(question, effective.answer),
      score: scoreAnswer(question, effective.answer),
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function attemptStats(results: StudentResult[]): AttemptStats {
  if (results.length === 0) return { students: 0, min: 0, max: 0, avg: 0, total: 0 };
  const counts = results.map((result) => result.attempts.length);
  const total = counts.reduce((sum, n) => sum + n, 0);
  return {
    students: results.length,
    min: Math.min(...counts),
    max: Math.max(...counts),
    avg: Math.round((total / results.length) * 10) / 10,
    total,
  };
}

export interface Tally {
  label: string;
  count: number;
  /** 0..1 share of responses. */
  share: number;
  isCorrect: boolean;
}

/** Counts per option, in the order the question declares them. */
export function tallyOptions(question: Question, results: StudentResult[]): Tally[] {
  if (
    question.type !== 'multiple-choice' &&
    question.type !== 'button-choice' &&
    question.type !== 'checkboxes'
  ) {
    return [];
  }

  const correct =
    question.type === 'checkboxes'
      ? new Set(question.correctAnswer ?? [])
      : new Set(question.correctAnswer === undefined ? [] : [question.correctAnswer]);

  const counts = new Map<string, number>(question.options.map((option) => [option, 0]));
  for (const result of results) {
    const picked = Array.isArray(result.effective.answer)
      ? result.effective.answer
      : [String(result.effective.answer)];
    for (const option of picked) {
      if (counts.has(option)) counts.set(option, (counts.get(option) ?? 0) + 1);
    }
  }

  const denominator = Math.max(1, results.length);
  return question.options.map((option) => ({
    label: option,
    count: counts.get(option) ?? 0,
    share: (counts.get(option) ?? 0) / denominator,
    isCorrect: correct.has(option),
  }));
}

/** Distinct free-text answers, most common first, with correct variants folded together. */
export function tallyText(question: Question, results: StudentResult[]): Tally[] {
  const caseSensitive = question.type === 'short-text' ? Boolean(question.caseSensitive) : false;
  const buckets = new Map<string, { label: string; count: number }>();

  for (const result of results) {
    const raw = String(result.effective.answer);
    const key = normaliseText(raw, caseSensitive);
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { label: raw.trim() || '(blank)', count: 1 });
  }

  const denominator = Math.max(1, results.length);
  return [...buckets.values()]
    .map((bucket) => ({
      label: bucket.label,
      count: bucket.count,
      share: bucket.count / denominator,
      isCorrect: gradeAnswer(question, bucket.label) === true,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface NumericSummary {
  bins: { label: string; value: number; count: number; share: number; isCorrect: boolean }[];
  mean: number;
  median: number;
  count: number;
}

/** One bin per step across the configured range — a real histogram, not a bar per answer. */
export function summariseNumeric(question: Question, results: StudentResult[]): NumericSummary {
  const values = results
    .map((result) => Number(result.effective.answer))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  let min: number;
  let max: number;
  let step: number;

  if (question.type === 'scale') {
    ({ min, max } = question.config);
    step = question.config.countBy ?? 1;
  } else if (question.type === 'rating') {
    min = 1;
    max = question.config?.max ?? 5;
    step = 1;
  } else {
    min = question.type === 'number' ? (question.config?.min ?? (values[0] ?? 0)) : 0;
    max =
      question.type === 'number'
        ? (question.config?.max ?? (values[values.length - 1] ?? 0))
        : 0;
    step = (question.type === 'number' ? question.config?.step : undefined) ?? 1;
  }

  if (!Number.isFinite(step) || step <= 0) step = 1;
  const steps = Math.max(1, Math.round((max - min) / step));
  // A `number` question with a wide open range would otherwise produce thousands
  // of empty bins; fall back to counting distinct answers.
  const useBins = steps <= 40;

  const counts = new Map<number, number>();
  if (useBins) {
    for (let i = 0; i <= steps; i += 1) counts.set(Math.round((min + i * step) * 1e6) / 1e6, 0);
  }
  for (const value of values) {
    const bucket = useBins
      ? Math.round((min + Math.round((value - min) / step) * step) * 1e6) / 1e6
      : value;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const denominator = Math.max(1, values.length);
  const correctAnswer =
    question.type === 'scale' || question.type === 'rating' || question.type === 'number'
      ? question.correctAnswer
      : undefined;

  const bins = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({
      label: String(value),
      value,
      count,
      share: count / denominator,
      isCorrect: correctAnswer !== undefined && value === correctAnswer,
    }));

  const mean = values.length
    ? Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100) / 100
    : 0;
  const mid = Math.floor(values.length / 2);
  const median = values.length
    ? values.length % 2
      ? (values[mid] as number)
      : Math.round((((values[mid - 1] as number) + (values[mid] as number)) / 2) * 100) / 100
    : 0;

  return { bins, mean, median, count: values.length };
}

export interface QuestionSummary {
  results: StudentResult[];
  responded: number;
  graded: boolean;
  correctCount: number;
  correctRate: number | null;
  /** Mean partial score, only meaningful for partial-credit checkboxes. */
  averageScore: number | null;
  attempts: AttemptStats;
}

export function summariseQuestion(question: Question, rows: AnswerRow[]): QuestionSummary {
  const results = groupByStudent(question, rows);
  const graded = isGraded(question);
  const correctCount = results.filter((result) => result.correct === true).length;
  const scored = results.map((result) => result.score).filter((s): s is number => s !== null);

  return {
    results,
    responded: results.length,
    graded,
    correctCount,
    correctRate: graded && results.length ? correctCount / results.length : null,
    averageScore: scored.length
      ? Math.round((scored.reduce((sum, n) => sum + n, 0) / scored.length) * 100) / 100
      : null,
    attempts: attemptStats(results),
  };
}

export function displayAnswer(question: Question, value: AnswerValue): string {
  return formatAnswer(question, value);
}
