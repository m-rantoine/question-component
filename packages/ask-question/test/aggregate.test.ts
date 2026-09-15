import { describe, expect, it } from 'vitest';
import { defineGroup } from '../src/defineGroup';
import { groupByStudent, summariseNumeric, summariseQuestion, tallyOptions } from '../src/aggregate';
import type { AnswerRow } from '../src/types';

let seq = 0;
function row(partial: Partial<AnswerRow> & Pick<AnswerRow, 'answer'>): AnswerRow {
  seq += 1;
  return {
    id: `row-${seq}`,
    student_id: partial.student_id ?? 's1',
    student_name: partial.student_name ?? 'Ada',
    session_id: partial.session_id ?? null,
    group_id: partial.group_id ?? 'lesson-1',
    question_id: partial.question_id ?? 'q1',
    created_at: partial.created_at ?? `2026-01-01T00:00:0${seq}.000Z`,
    answer: partial.answer,
  };
}

const bank = () =>
  defineGroup('lesson-1', {
    q1: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable', 'rock'],
      correctAnswer: 'fruit',
    },
    locked: {
      type: 'multiple-choice',
      question: 'Locked',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
      allowMultipleAttempts: false,
    },
    scale: {
      type: 'scale',
      question: 'How many planets?',
      config: { min: 0, max: 10, countBy: 1 },
      correctAnswer: 8,
    },
  });

describe('aggregation', () => {
  it('uses the latest attempt when retries are allowed', () => {
    const q = bank().q1;
    const results = groupByStudent(q, [
      row({ answer: 'rock' }),
      row({ answer: 'fruit' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.effective.answer).toBe('fruit');
    expect(results[0]!.correct).toBe(true);
    expect(results[0]!.attempts).toHaveLength(2);
  });

  it('uses the earliest attempt when retries are disallowed', () => {
    const q = bank().locked;
    const results = groupByStudent(q, [
      row({ question_id: 'locked', answer: 'vegetable' }),
      row({ question_id: 'locked', answer: 'fruit' }),
    ]);
    expect(results[0]!.effective.answer).toBe('vegetable');
    expect(results[0]!.correct).toBe(false);
  });

  it('merges a student who signed out and back in under a new id', () => {
    const q = bank().q1;
    const results = groupByStudent(q, [
      row({ student_id: 'a', student_name: 'Ada', answer: 'rock' }),
      row({ student_id: 'b', student_name: ' ada ', answer: 'fruit' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.attempts).toHaveLength(2);
    expect(results[0]!.effective.answer).toBe('fruit');
  });

  it('ignores rows belonging to a different question', () => {
    const q = bank().q1;
    const results = groupByStudent(q, [row({ question_id: 'q2', answer: 'fruit' })]);
    expect(results).toHaveLength(0);
  });

  it('reports attempt min, average and max per student', () => {
    const q = bank().q1;
    const summary = summariseQuestion(q, [
      row({ student_name: 'Ada', answer: 'fruit' }),
      row({ student_name: 'Ada', answer: 'fruit' }),
      row({ student_name: 'Ada', answer: 'fruit' }),
      row({ student_name: 'Grace', answer: 'rock' }),
    ]);
    expect(summary.responded).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.correctRate).toBe(0.5);
    expect(summary.attempts).toMatchObject({ min: 1, max: 3, avg: 2, total: 4 });
  });

  it('tallies every option, including ones nobody picked', () => {
    const q = bank().q1;
    const tallies = tallyOptions(q, groupByStudent(q, [row({ answer: 'fruit' })]));
    expect(tallies.map((t) => [t.label, t.count])).toEqual([
      ['fruit', 1],
      ['vegetable', 0],
      ['rock', 0],
    ]);
    expect(tallies[0]!.isCorrect).toBe(true);
  });

  it('bins a scale across its whole configured range', () => {
    const q = bank().scale;
    const results = groupByStudent(q, [
      row({ question_id: 'scale', student_name: 'Ada', answer: 8 }),
      row({ question_id: 'scale', student_name: 'Grace', answer: 9 }),
    ]);
    const numeric = summariseNumeric(q, results);
    expect(numeric.bins).toHaveLength(11);
    expect(numeric.bins.find((b) => b.value === 8)).toMatchObject({ count: 1, isCorrect: true });
    expect(numeric.mean).toBe(8.5);
    expect(numeric.median).toBe(8.5);
  });
});
