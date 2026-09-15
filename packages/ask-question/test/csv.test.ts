import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from '../src/csv';
import { defineGroup } from '../src/defineGroup';
import type { AnswerRow } from '../src/types';

let seq = 0;
function row(partial: Partial<AnswerRow> & Pick<AnswerRow, 'answer'>): AnswerRow {
  seq += 1;
  return {
    id: `c-${seq}`,
    student_id: partial.student_id ?? 's1',
    student_name: partial.student_name ?? 'Ada',
    session_id: partial.session_id ?? null,
    group_id: 'lesson-1',
    question_id: partial.question_id ?? 'q1',
    created_at: partial.created_at ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
    answer: partial.answer,
  };
}

const bank = () =>
  defineGroup('lesson-1', {
    q1: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
    },
    q2: { type: 'long-text', question: 'Explain why' },
  });

/** Body rows, with the BOM and the header stripped. */
function body(csv: string): string[] {
  return csv.replace(/^﻿/, '').trimEnd().split('\r\n').slice(1);
}

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and a CRLF header, so Excel reads the accents', () => {
    const csv = toCsv({ questions: [bank().q1], rows: [] });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'student_name,student_id,session_id,group_id,question_id,question_text,answer,is_correct,attempt_number,is_counted,created_at',
    );
  });

  it('writes one line per attempt and marks the one that counts', () => {
    const questions = bank();
    const csv = toCsv({
      questions: [questions.q1],
      rows: [
        row({ student_name: 'Ada', answer: 'vegetable' }),
        row({ student_name: 'Ada', answer: 'fruit' }),
      ],
    });

    const lines = body(csv);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(',vegetable,false,1,false,');
    expect(lines[1]).toContain(',fruit,true,2,true,');
  });

  it('counts the earliest attempt when retries are not allowed', () => {
    const questions = defineGroup('lesson-1', {
      q1: {
        type: 'multiple-choice',
        question: 'An apple is a',
        options: ['fruit', 'vegetable'],
        correctAnswer: 'fruit',
        allowMultipleAttempts: false,
      },
    });
    const csv = toCsv({
      questions: [questions.q1],
      rows: [
        row({ student_name: 'Ada', answer: 'vegetable' }),
        row({ student_name: 'Ada', answer: 'fruit' }),
      ],
    });

    const lines = body(csv);
    expect(lines[0]).toContain(',1,true,');
    expect(lines[1]).toContain(',2,false,');
  });

  it('carries the session id through', () => {
    const csv = toCsv({
      questions: [bank().q1],
      rows: [row({ student_name: 'Ada', session_id: 'period-1', answer: 'fruit' })],
    });
    expect(body(csv)[0]).toContain('Ada,s1,period-1,lesson-1,q1,');
  });

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    const csv = toCsv({
      questions: [bank().q2],
      rows: [row({ question_id: 'q2', answer: 'She said "hi", then left\nand came back' })],
    });
    expect(body(csv)[0]).toContain('"She said ""hi"", then left\nand came back"');
  });

  it('defuses a field a spreadsheet would run as a formula', () => {
    const csv = toCsv({
      questions: [bank().q2],
      rows: [row({ question_id: 'q2', answer: '=HYPERLINK("http://evil.example","click")' })],
    });
    // The apostrophe makes Excel treat it as text; the quoting is incidental.
    expect(body(csv)[0]).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
  });

  it('leaves is_correct blank for an ungraded question', () => {
    const csv = toCsv({
      questions: [bank().q2],
      rows: [row({ question_id: 'q2', answer: 'Because it has seeds' })],
    });
    expect(body(csv)[0]).toContain(',Because it has seeds,,1,true,');
  });

  it('accepts a semicolon delimiter for an Excel set to fr-FR', () => {
    const csv = toCsv({
      questions: [bank().q1],
      rows: [row({ answer: 'fruit' })],
      delimiter: ';',
    });
    expect(csv.slice(1).split('\r\n')[0]).toContain('student_name;student_id;');
    expect(body(csv)[0]).toContain(';fruit;true;1;true;');
  });
});

describe('csvFilename', () => {
  it('names the file after whatever is on screen', () => {
    const date = new Date('2026-03-04T12:00:00.000Z');
    expect(csvFilename({ groupId: 'lesson-1', date })).toBe('answers-lesson-1-2026-03-04.csv');
    expect(csvFilename({ groupId: 'lesson-1', questionId: 'q1', sessionId: 'period-1', date })).toBe(
      'answers-lesson-1-q1-period-1-2026-03-04.csv',
    );
  });
});
