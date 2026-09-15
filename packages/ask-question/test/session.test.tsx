import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SeeAnswers } from '../src/components/SeeAnswers';
import { defineGroup } from '../src/defineGroup';
import { configure, scopeKey } from '../src/runtime';
import { createMemoryTransport } from '../src/transport';
import { getGroupSnapshot, recordLocalAnswer, subscribeToGroup } from '../src/store';
import { getLocalAttemptCount, recordLocalAttempt } from '../src/submissions';
import type { AnswerRow } from '../src/types';

let seq = 0;
function row(partial: Partial<AnswerRow> & Pick<AnswerRow, 'answer'>): AnswerRow {
  seq += 1;
  return {
    id: `s-${seq}`,
    student_id: partial.student_id ?? `student-${seq}`,
    student_name: partial.student_name ?? 'Ada',
    session_id: partial.session_id ?? null,
    group_id: partial.group_id ?? 'lesson-1',
    question_id: partial.question_id ?? 'q1',
    created_at: partial.created_at ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
    answer: partial.answer,
  };
}

function bank() {
  return defineGroup('lesson-1', {
    q1: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable', 'rock'],
      correctAnswer: 'fruit',
    },
  });
}

const seeded = () => [
  row({ student_name: 'Ada', session_id: 'period-1', answer: 'fruit' }),
  row({ student_name: 'Grace', session_id: 'period-1', answer: 'fruit' }),
  row({ student_name: 'Alan', session_id: 'period-2', answer: 'rock' }),
  row({ student_name: 'Edsger', session_id: null, answer: 'vegetable' }),
];

function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

describe('session scoping', () => {
  it('keys the cache by group AND session', () => {
    expect(scopeKey({ groupId: 'lesson-1' })).toBe('lesson-1|');
    expect(scopeKey({ groupId: 'lesson-1', sessionId: 'period-1' })).toBe('lesson-1|period-1');
    expect(scopeKey({ groupId: 'lesson-1', sessionId: 'period-1' })).not.toBe(
      scopeKey({ groupId: 'lesson-1', sessionId: 'period-2' }),
    );
  });

  it('reads only the requested session, and everything when none is given', async () => {
    configure({ transport: createMemoryTransport(seeded()) });

    const all = { groupId: 'lesson-1' };
    const period1 = { groupId: 'lesson-1', sessionId: 'period-1' };
    const stop = [subscribeToGroup(all, () => {}), subscribeToGroup(period1, () => {})];

    await waitFor(() => {
      expect(getGroupSnapshot(all).rows).toHaveLength(4);
      expect(getGroupSnapshot(period1).rows).toHaveLength(2);
    });
    expect(getGroupSnapshot(period1).rows.map((r) => r.student_name)).toEqual(['Ada', 'Grace']);
    for (const unsubscribe of stop) unsubscribe();
  });

  it('fans a locally-submitted answer into every scope that would have fetched it', async () => {
    configure({ transport: createMemoryTransport() });

    const all = { groupId: 'lesson-1' };
    const period1 = { groupId: 'lesson-1', sessionId: 'period-1' };
    const period2 = { groupId: 'lesson-1', sessionId: 'period-2' };
    const stop = [
      subscribeToGroup(all, () => {}),
      subscribeToGroup(period1, () => {}),
      subscribeToGroup(period2, () => {}),
    ];
    await waitFor(() => expect(getGroupSnapshot(all).status).toBe('ready'));

    recordLocalAnswer(row({ student_name: 'Ada', session_id: 'period-1', answer: 'fruit' }));

    expect(getGroupSnapshot(all).rows).toHaveLength(1);
    expect(getGroupSnapshot(period1).rows).toHaveLength(1);
    expect(getGroupSnapshot(period2).rows).toHaveLength(0);
    for (const unsubscribe of stop) unsubscribe();
  });

  it('scores a single session when SeeAnswers is given one', async () => {
    configure({ transport: createMemoryTransport(seeded()) });
    render(<SeeAnswers q={bank().q1} sessionId="period-1" />);

    await waitFor(() => expect(textOf('.askq-answers__stats')).toMatch(/2 students/));
    expect(textOf('.askq-answers__stats')).toMatch(/2 correct \(100%\)/);
  });

  it('scores every session when SeeAnswers is given none', async () => {
    configure({ transport: createMemoryTransport(seeded()) });
    render(<SeeAnswers q={bank().q1} />);

    await waitFor(() => expect(textOf('.askq-answers__stats')).toMatch(/4 students/));
    expect(textOf('.askq-answers__stats')).toMatch(/2 correct \(50%\)/);
  });
});

describe('attempt lock', () => {
  it('is per session, so period 1 does not lock a student out of period 2', () => {
    recordLocalAttempt('s1', 'lesson-1', 'q1', 'period-1');

    expect(getLocalAttemptCount('s1', 'lesson-1', 'q1', 'period-1')).toBe(1);
    expect(getLocalAttemptCount('s1', 'lesson-1', 'q1', 'period-2')).toBe(0);
    expect(getLocalAttemptCount('s1', 'lesson-1', 'q1')).toBe(0);
  });

  it('still locks within the same session', () => {
    recordLocalAttempt('s1', 'lesson-1', 'q1', 'period-1');
    expect(recordLocalAttempt('s1', 'lesson-1', 'q1', 'period-1')).toBe(2);
    expect(getLocalAttemptCount('s1', 'lesson-1', 'q1', 'period-1')).toBe(2);
  });
});
