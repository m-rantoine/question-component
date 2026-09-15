import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeeAnswers } from '../src/components/SeeAnswers';
import { defineGroup } from '../src/defineGroup';
import { configure } from '../src/runtime';
import { createMemoryTransport } from '../src/transport';
import type { AnswerRow } from '../src/types';

let seq = 0;
function row(partial: Partial<AnswerRow> & Pick<AnswerRow, 'answer'>): AnswerRow {
  seq += 1;
  return {
    id: `seed-${seq}`,
    student_id: partial.student_id ?? `s${seq}`,
    student_name: partial.student_name ?? 'Ada',
    session_id: partial.session_id ?? null,
    group_id: 'lesson-1',
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

/** The stats line bolds its numbers, so assert on the line's full text. */
function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

describe('SeeAnswers', () => {
  it('shows an empty state before anyone answers', async () => {
    configure({ transport: createMemoryTransport() });
    render(<SeeAnswers q={bank().q1} />);
    expect(await screen.findByText('No answers yet.')).toBeInTheDocument();
  });

  it('summarises option counts and the attempt footnote', async () => {
    configure({
      transport: createMemoryTransport([
        row({ student_name: 'Ada', answer: 'fruit' }),
        row({ student_name: 'Ada', answer: 'fruit' }),
        row({ student_name: 'Grace', answer: 'rock' }),
      ]),
    });
    render(<SeeAnswers q={bank().q1} />);

    await waitFor(() => expect(textOf('.askq-answers__stats')).toMatch(/2 students/));
    expect(textOf('.askq-answers__stats')).toMatch(/1 correct \(50%\)/);
    expect(textOf('.askq-answers__footnote')).toBe(
      'Attempts per student — min 1 · avg 1.5 · max 2',
    );
  });

  it('switches between the two views when toggling', async () => {
    configure({
      transport: createMemoryTransport([row({ student_name: 'Ada', answer: 'fruit' })]),
    });
    render(<SeeAnswers q={bank().q1} view="toggle" />);

    await waitFor(() => expect(textOf('.askq-answers__stats')).toMatch(/1 student/));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Per student' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Ada' })).toBeInTheDocument();
  });

  it('exposes a per-student attempt history', async () => {
    configure({
      transport: createMemoryTransport([
        row({ student_name: 'Ada', answer: 'rock' }),
        row({ student_name: 'Ada', answer: 'fruit' }),
      ]),
    });
    render(<SeeAnswers q={bank().q1} view="per-student" />);

    await waitFor(() => expect(document.querySelector('.askq-history')).not.toBeNull());
    const toggle = document.querySelector('.askq-history summary') as HTMLElement;
    expect(toggle.textContent).toBe('2');
    await userEvent.click(toggle);
    expect(textOf('.askq-history__list')).toMatch(/rock/);
  });
});
