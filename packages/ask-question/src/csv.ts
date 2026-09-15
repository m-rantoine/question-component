import { groupByStudent } from './aggregate';
import { formatAnswer, gradeAnswer, isGraded } from './grade';
import type { AnswerRow, Question } from './types';

/**
 * Exports answers as a CSV a teacher can open in Excel or Google Sheets.
 *
 * Every attempt gets a row, with `is_counted` marking the one the summary used,
 * because a gradebook wants the full history and a flag is friendlier than a
 * second export button.
 */

export interface CsvOptions {
  /** The questions to export, in the order they should appear. */
  questions: readonly Question[];
  rows: readonly AnswerRow[];
  /**
   * `,` by default — right for en-CA and fr-CA Excel, and the only delimiter
   * Google Sheets accepts without asking. Use `;` for an Excel set to fr-FR.
   */
  delimiter?: string;
}

export const CSV_COLUMNS = [
  'student_name',
  'student_id',
  'session_id',
  'group_id',
  'question_id',
  'question_text',
  'answer',
  'is_correct',
  'attempt_number',
  'is_counted',
  'created_at',
] as const;

/**
 * A leading `=`, `+`, `-`, `@`, tab or CR makes a spreadsheet treat the cell as
 * a formula. Student free text lands in this file and a teacher opens it, so
 * anything that could execute is prefixed with an apostrophe first.
 */
function defuse(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string, delimiter: string): string {
  const safe = defuse(value);
  return /["\n\r]|^\s|\s$/.test(safe) || safe.includes(delimiter)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

/** Question text is markdown and may be several lines; a CSV cell wants one. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function toCsv({ questions, rows, delimiter = ',' }: CsvOptions): string {
  const lines: string[] = [CSV_COLUMNS.join(delimiter)];

  for (const question of questions) {
    const graded = isGraded(question);
    for (const result of groupByStudent(question, [...rows])) {
      result.attempts.forEach((attempt, index) => {
        const correct = graded ? gradeAnswer(question, attempt.answer) : null;
        const cells = [
          result.name,
          attempt.student_id,
          attempt.session_id ?? '',
          attempt.group_id,
          attempt.question_id,
          oneLine(question.question),
          formatAnswer(question, attempt.answer),
          correct === null ? '' : String(correct),
          String(index + 1),
          String(attempt.id === result.effective.id),
          attempt.created_at,
        ];
        lines.push(cells.map((cell) => quote(cell, delimiter)).join(delimiter));
      });
    }
  }

  // CRLF, and a UTF-8 BOM so Excel does not mangle every accent — which, with
  // French question text, would ruin essentially every export.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export interface CsvFilenameParts {
  groupId?: string;
  questionId?: string;
  sessionId?: string;
  /** Defaults to today. */
  date?: Date;
}

export function csvFilename(parts: CsvFilenameParts = {}): string {
  const date = (parts.date ?? new Date()).toISOString().slice(0, 10);
  const pieces = ['answers', parts.groupId, parts.questionId, parts.sessionId, date]
    .filter((piece): piece is string => Boolean(piece))
    .map((piece) => piece.replace(/[^A-Za-z0-9_.-]+/g, '-'));
  return `${pieces.join('-')}.csv`;
}

/** Client-side download — no server round trip, so the export works offline. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
