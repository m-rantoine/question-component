import { describe, expect, it } from 'vitest';
import { defineGroup } from '../src/defineGroup';
import { questionsInGroup, registeredGroupIds, resolveQuestion } from '../src/registry';

describe('defineGroup', () => {
  it('injects groupId and questionId from the keys', () => {
    const group = defineGroup('lesson-1', {
      q1: { type: 'short-text', question: 'What is 1+1?', correctAnswer: ['2'] },
    });
    expect(group.q1.groupId).toBe('lesson-1');
    expect(group.q1.questionId).toBe('q1');
    expect(resolveQuestion('lesson-1/q1')).toBe(group.q1);
  });

  it('rejects a correctAnswer that is not one of the options', () => {
    expect(() =>
      defineGroup('lesson-1', {
        q1: {
          type: 'multiple-choice',
          question: 'An apple is a',
          options: ['fruit', 'vegetable'],
          correctAnswer: 'Fruit',
        },
      }),
    ).toThrow(/not one of the options/);
  });

  it('rejects duplicate options, which would make the stored answer ambiguous', () => {
    expect(() =>
      defineGroup('lesson-1', {
        q1: { type: 'checkboxes', question: 'Pick', options: ['a', 'a'] },
      }),
    ).toThrow(/unique/);
  });

  it('rejects an inverted scale range', () => {
    expect(() =>
      defineGroup('lesson-1', {
        q1: { type: 'scale', question: 'How many?', config: { min: 10, max: 2 } },
      }),
    ).toThrow(/greater than min/);
  });

  it('rejects ids that would break a URL or the database column', () => {
    expect(() =>
      defineGroup('lesson 1', { q1: { type: 'long-text', question: 'x' } }),
    ).toThrow(/Invalid groupId/);
    expect(() =>
      defineGroup('lesson-1', { 'q/1': { type: 'long-text', question: 'x' } }),
    ).toThrow(/Invalid questionId/);
    expect(() => defineGroup('', { q1: { type: 'long-text', question: 'x' } })).toThrow(
      /Invalid groupId/,
    );
  });

  it('enumerates groups and their questions in declaration order', () => {
    defineGroup('lesson-1', {
      q1: { type: 'long-text', question: 'One' },
      q2: { type: 'long-text', question: 'Two' },
    });
    defineGroup('lesson-2', { q1: { type: 'long-text', question: 'Three' } });

    expect(registeredGroupIds()).toEqual(['lesson-1', 'lesson-2']);
    expect(questionsInGroup('lesson-1').map((q) => q.questionId)).toEqual(['q1', 'q2']);
    expect(questionsInGroup('nope')).toEqual([]);
  });

  it('reports an unknown question id with the ids it does know', () => {
    defineGroup('lesson-1', { q1: { type: 'long-text', question: 'Explain' } });
    expect(() => resolveQuestion('lesson-1/q9')).toThrow(/lesson-1\/q1/);
  });
});
