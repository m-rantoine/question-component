import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerDashboard, type DashboardTarget } from '../src/components/AnswerDashboard';
import { defineGroup } from '../src/defineGroup';
import { configure } from '../src/runtime';
import { createMemoryTransport } from '../src/transport';
import type { AnswerRow } from '../src/types';

let seq = 0;
function row(partial: Partial<AnswerRow> & Pick<AnswerRow, 'answer'>): AnswerRow {
  seq += 1;
  return {
    id: `d-${seq}`,
    student_id: partial.student_id ?? `student-${seq}`,
    student_name: partial.student_name ?? 'Ada',
    session_id: partial.session_id ?? null,
    group_id: partial.group_id ?? 'lesson-1',
    question_id: partial.question_id ?? 'q1',
    created_at: partial.created_at ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
    answer: partial.answer,
  };
}

/** Two groups, three questions, so navigation has somewhere to go. */
function banks() {
  defineGroup('lesson-1', {
    q1: { type: 'short-text', question: 'Capital of France' },
    q2: { type: 'short-text', question: 'Capital of Spain' },
    q3: { type: 'short-text', question: 'Capital of Italy' },
  });
  defineGroup('lesson-2', {
    q1: { type: 'short-text', question: 'Largest ocean' },
  });
}

const linkTo = (target: DashboardTarget): string =>
  target.kind === 'groups'
    ? '/dash'
    : target.kind === 'group'
      ? `/dash/${target.groupId}`
      : `/dash/${target.groupId}/${target.questionId}`;

describe('AnswerDashboard', () => {
  it('show="all" renders every group with its questions', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="all" />);

    await waitFor(() => expect(screen.getByText('Capital of France')).toBeInTheDocument());
    expect(screen.getByText('Largest ocean')).toBeInTheDocument();
    expect(screen.getAllByText('3 questions')).toHaveLength(1);
    expect(screen.getAllByText('1 question')).toHaveLength(1);
  });

  it('show="groupPicker" lists the groups and opens one on click', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="groupPicker" />);

    expect(screen.queryByText('Capital of France')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /lesson-1/ }));

    await waitFor(() => expect(screen.getByText('Capital of France')).toBeInTheDocument());
    expect(screen.queryByText('Largest ocean')).not.toBeInTheDocument();
  });

  it('show="group" renders one group only', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="group" groupId="lesson-2" />);

    await waitFor(() => expect(screen.getByText('Largest ocean')).toBeInTheDocument());
    expect(screen.queryByText('Capital of France')).not.toBeInTheDocument();
  });

  it('show="question" renders one question and walks the group with prev/next', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="question" groupId="lesson-1" questionId="q2" />);

    await waitFor(() => expect(screen.getByText('Capital of Spain')).toBeInTheDocument());
    expect(screen.getAllByText('Question 2 of 3').length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: 'Next →' })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('Capital of Italy')).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button', { name: '← Previous' })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('Capital of Spain')).toBeInTheDocument());
  });

  it('disables previous on the first question and next on the last', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    const { unmount } = render(
      <AnswerDashboard show="question" groupId="lesson-1" questionId="q1" />,
    );
    await waitFor(() => expect(screen.getByText('Capital of France')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '← Previous' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Next →' }).length).toBeGreaterThan(0);
    unmount();

    render(<AnswerDashboard show="question" groupId="lesson-1" questionId="q3" />);
    await waitFor(() => expect(screen.getByText('Capital of Italy')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Next →' })).not.toBeInTheDocument();
  });

  it('navAll={false} drops prev/next entirely', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="question" groupId="lesson-1" questionId="q2" navAll={false} />);

    await waitFor(() => expect(screen.getByText('Capital of Spain')).toBeInTheDocument());
    expect(screen.queryByText('Question 2 of 3')).not.toBeInTheDocument();
  });

  it('renders links instead of buttons when linkTo is supplied', async () => {
    banks();
    configure({ transport: createMemoryTransport() });
    render(
      <AnswerDashboard show="question" groupId="lesson-1" questionId="q2" linkTo={linkTo} />,
    );

    await waitFor(() => expect(screen.getByText('Capital of Spain')).toBeInTheDocument());
    const next = screen.getAllByRole('link', { name: 'Next →' })[0] as HTMLAnchorElement;
    expect(next.getAttribute('href')).toBe('/dash/lesson-1/q3');
    expect(next.getAttribute('rel')).toBe('next');
    expect(screen.queryByRole('button', { name: 'Next →' })).not.toBeInTheDocument();
  });

  it('offers a session picker built from the sessions in the answers', async () => {
    banks();
    configure({
      transport: createMemoryTransport([
        row({ student_name: 'Ada', session_id: 'period-1', answer: 'Paris' }),
        row({ student_name: 'Alan', session_id: 'period-2', answer: 'Lyon' }),
      ]),
    });
    render(<AnswerDashboard show="group" groupId="lesson-1" sessionPicker />);

    const select = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'All sessions',
        'period-1',
        'period-2',
      ]),
    );

    // Both sessions' answers are tallied until one is chosen.
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();

    // Filtering narrows the summary to that session's answers.
    await userEvent.selectOptions(select, 'period-1');
    await waitFor(() => expect(screen.queryByText('Lyon')).not.toBeInTheDocument());
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('keeps every session in the picker after filtering to one', async () => {
    banks();
    configure({
      transport: createMemoryTransport([
        row({ student_name: 'Ada', session_id: 'period-1', answer: 'Paris' }),
        row({ student_name: 'Alan', session_id: 'period-2', answer: 'Lyon' }),
      ]),
    });
    render(<AnswerDashboard show="group" groupId="lesson-1" sessionPicker />);

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    await userEvent.selectOptions(select, 'period-1');

    // The period-1 poller never returns period-2 rows, so the options have to
    // come from an index that accumulates rather than from the rows on screen.
    expect(within(select).getAllByRole('option')).toHaveLength(3);
  });

  it('says so when no groups are registered', () => {
    configure({ transport: createMemoryTransport() });
    render(<AnswerDashboard show="all" />);
    expect(screen.getByText('No question groups are defined.')).toBeInTheDocument();
  });
});
