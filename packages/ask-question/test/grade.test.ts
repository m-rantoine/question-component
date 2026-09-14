import { describe, expect, it } from 'vitest';
import { defineGroup } from '../src/defineGroup';
import { gradeAnswer, isGraded, scoreAnswer } from '../src/grade';

const g = () =>
  defineGroup('t', {
    text: { type: 'short-text', question: 'q', correctAnswer: ['2', 'two'] },
    textCase: {
      type: 'short-text',
      question: 'q',
      correctAnswer: ['Paris'],
      caseSensitive: true,
    },
    essay: { type: 'long-text', question: 'q' },
    choice: {
      type: 'multiple-choice',
      question: 'q',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
    },
    boxes: {
      type: 'checkboxes',
      question: 'q',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: ['a', 'b'],
      partialCredit: true,
    },
    num: { type: 'number', question: 'q', config: { tolerance: 0.5 }, correctAnswer: 10 },
    scale: { type: 'scale', question: 'q', config: { min: 0, max: 20 }, correctAnswer: 8 },
    poll: { type: 'scale', question: 'q', config: { min: 1, max: 5 } },
  });

describe('grading', () => {
  it('normalises whitespace and case for short text', () => {
    const q = g().text;
    expect(gradeAnswer(q, '  Two ')).toBe(true);
    expect(gradeAnswer(q, '2')).toBe(true);
    expect(gradeAnswer(q, 'three')).toBe(false);
  });

  it('honours caseSensitive', () => {
    const q = g().textCase;
    expect(gradeAnswer(q, 'Paris')).toBe(true);
    expect(gradeAnswer(q, 'paris')).toBe(false);
  });

  it('treats questions without a correct answer as ungraded', () => {
    const q = g();
    expect(isGraded(q.essay)).toBe(false);
    expect(gradeAnswer(q.essay, 'anything')).toBeNull();
    expect(gradeAnswer(q.poll, 3)).toBeNull();
  });

  it('matches a choice by option text, not index', () => {
    const q = g().choice;
    expect(gradeAnswer(q, 'fruit')).toBe(true);
    expect(gradeAnswer(q, 'vegetable')).toBe(false);
  });

  it('requires an exact set for checkboxes even with partial credit on', () => {
    const q = g().boxes;
    expect(gradeAnswer(q, ['a', 'b'])).toBe(true);
    expect(gradeAnswer(q, ['a'])).toBe(false);
    expect(gradeAnswer(q, ['a', 'b', 'c'])).toBe(false);
    expect(scoreAnswer(q, ['a'])).toBe(0.5);
    expect(scoreAnswer(q, ['a', 'b', 'c'])).toBe(0.5);
    expect(scoreAnswer(q, ['c', 'd'])).toBe(0);
  });

  it('applies a numeric tolerance', () => {
    const q = g().num;
    expect(gradeAnswer(q, 10.4)).toBe(true);
    expect(gradeAnswer(q, 11)).toBe(false);
  });

  it('grades a scale exactly', () => {
    const q = g().scale;
    expect(gradeAnswer(q, 8)).toBe(true);
    expect(gradeAnswer(q, 9)).toBe(false);
  });
});
