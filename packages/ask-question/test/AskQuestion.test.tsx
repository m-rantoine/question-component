import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskQuestion } from '../src/components/AskQuestion';
import { SeeAnswers } from '../src/components/SeeAnswers';
import { defineGroup } from '../src/defineGroup';
import { configure } from '../src/runtime';
import { createMemoryTransport } from '../src/transport';
import { signIn } from '../src/identity';

function bank() {
  return defineGroup('lesson-1', {
    silent: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
    },
    verdict: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
      showCorrectAnswer: 'if-correct',
    },
    reveal: {
      type: 'short-text',
      question: 'What is **1 + 1**?',
      correctAnswer: ['2', 'two'],
      showCorrectAnswer: 'always',
    },
    once: {
      type: 'short-text',
      question: 'One shot',
      correctAnswer: ['a'],
      allowMultipleAttempts: false,
      showCorrectAnswer: 'if-correct',
    },
  });
}

function useMemoryTransport() {
  configure({ transport: createMemoryTransport() });
}

describe('AskQuestion', () => {
  it('asks for a name before it will take an answer', async () => {
    useMemoryTransport();
    render(<AskQuestion q={bank().silent} />);
    expect(screen.getByText('Enter your name to answer')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Enter your name to answer'), 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('radio', { name: 'fruit' })).toBeInTheDocument();
  });

  it('renders markdown in the question', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().reveal} />);
    expect(await screen.findByText('1 + 1')).toBeInTheDocument();
  });

  it('gives no feedback at all when showCorrectAnswer is never', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().silent} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'vegetable' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Answer submitted.')).toBeInTheDocument();
    expect(screen.queryByText(/Not quite/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct answer/)).not.toBeInTheDocument();
  });

  it('shows right or wrong but not the answer when showCorrectAnswer is if-correct', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().verdict} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'vegetable' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Not quite')).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
  });

  it('reveals the correct answer when showCorrectAnswer is always', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().reveal} />);

    await userEvent.type(await screen.findByRole('textbox'), 'three');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('refuses to submit an empty answer', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().silent} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose or enter an answer first.');
  });

  it('counts every attempt separately and keeps the retry button', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().verdict} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'vegetable' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('radio', { name: 'fruit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('2 attempts')).toBeInTheDocument();
  });

  it('does not resubmit when the retry button is pressed', async () => {
    // React reuses one <button> element across the Submit/Try again states, so
    // a mishandled retry click submits a second attempt. Guard against that.
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().verdict} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'fruit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('1 attempt')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('1 attempt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });

  it('locks the question after one submission when retries are off', async () => {
    useMemoryTransport();
    signIn('Ada');
    render(<AskQuestion q={bank().once} />);

    await userEvent.type(await screen.findByRole('textbox'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Correct')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('feeds the answer straight into a dashboard on the same page', async () => {
    useMemoryTransport();
    signIn('Ada');
    const questions = bank();
    render(
      <>
        <AskQuestion q={questions.verdict} />
        <SeeAnswers q={questions.verdict} view="per-student" />
      </>,
    );

    await userEvent.click(await screen.findByRole('radio', { name: 'fruit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: 'Ada' })).toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'fruit' })).toBeInTheDocument();
  });
});
