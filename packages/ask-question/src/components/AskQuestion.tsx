import { useEffect, useId, useMemo, useState } from 'react';
import { formatCorrectAnswer, gradeAnswer, isGraded } from '../grade';
import { useQuestion, useStudent } from '../hooks';
import { randomId } from '../identity';
import { submitAnswer } from '../store';
import { getLocalAttemptCount, recordLocalAttempt } from '../submissions';
import type { AnswerValue, Question } from '../types';
import { Markdown } from './Markdown';
import { NameGate } from './NameGate';
import { QuestionInput } from './inputs/QuestionInput';

export interface AskQuestionProps {
  /** The question object. Use this from React or MDX. */
  q?: Question;
  /** `"<groupId>/<questionId>"`. Use this from Astro, where island props must be JSON. */
  id?: string;
  className?: string;
  /** Prompt shown when nobody is signed in yet. */
  namePrompt?: string;
  onSubmitted?: (result: { value: AnswerValue; correct: boolean | null; attempt: number }) => void;
}

type Phase = 'editing' | 'submitting' | 'submitted';

interface Outcome {
  value: AnswerValue;
  correct: boolean | null;
  queued: boolean;
  attempt: number;
}

function emptyValue(question: Question): AnswerValue | null {
  if (question.type === 'checkboxes') return [];
  if (question.type === 'short-text' || question.type === 'long-text') return '';
  return null;
}

function hasAnswer(question: Question, value: AnswerValue | null): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') {
    if (question.type === 'number') return value !== '';
    return value.trim().length > 0;
  }
  return Number.isFinite(value);
}

function validationMessage(question: Question, value: AnswerValue | null): string | null {
  if (!hasAnswer(question, value)) return 'Choose or enter an answer first.';
  if (question.type === 'long-text' && question.minLength) {
    const length = typeof value === 'string' ? value.trim().length : 0;
    if (length < question.minLength) {
      return `Please write at least ${question.minLength} characters.`;
    }
  }
  if (question.type === 'number' && typeof value !== 'number') {
    return 'Please enter a number.';
  }
  return null;
}

/**
 * Presents one question and submits one attempt at a time.
 *
 * Every submission is a new row: a retry never overwrites an earlier answer.
 */
export function AskQuestion({
  q,
  id,
  className,
  namePrompt,
  onSubmitted,
}: AskQuestionProps) {
  const question = useQuestion(q, id);
  const { student, loaded } = useStudent();
  const uid = useId();

  const [value, setValue] = useState<AnswerValue | null>(() => emptyValue(question));
  const [phase, setPhase] = useState<Phase>('editing');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const allowRetries = question.allowMultipleAttempts !== false;
  const reveal = question.showCorrectAnswer ?? 'never';
  const graded = isGraded(question);

  // Restore the "already answered" state after a reload, and reset everything
  // when the signed-in student changes.
  useEffect(() => {
    setValue(emptyValue(question));
    setOutcome(null);
    setError(null);
    if (!student) {
      setAttempts(0);
      setPhase('editing');
      return;
    }
    const previous = getLocalAttemptCount(student.id, question.groupId, question.questionId);
    setAttempts(previous);
    setPhase(previous > 0 && !allowRetries ? 'submitted' : 'editing');
  }, [student, question, allowRetries]);

  const locked = !allowRetries && attempts > 0;
  const correctAnswerText = useMemo(() => formatCorrectAnswer(question), [question]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!student || phase === 'submitting' || locked) return;

    const problem = validationMessage(question, value);
    if (problem) {
      setError(problem);
      return;
    }

    const answer = question.type === 'number' ? Number(value) : (value as AnswerValue);
    setError(null);
    setPhase('submitting');

    const result = await submitAnswer({
      id: randomId(),
      student_id: student.id,
      student_name: student.name,
      group_id: question.groupId,
      question_id: question.questionId,
      answer,
    });

    const attempt = recordLocalAttempt(student.id, question.groupId, question.questionId);
    const correct = gradeAnswer(question, answer);
    setAttempts(attempt);
    setOutcome({ value: answer, correct, queued: !result.delivered, attempt });
    setPhase('submitted');
    onSubmitted?.({ value: answer, correct, attempt });
  }

  function handleRetry(event: React.MouseEvent<HTMLButtonElement>) {
    // Cancel the button's activation behaviour explicitly. React reuses the
    // same <button> element for "Submit" and "Try again" and only patches its
    // `type`, so by the time the browser evaluates the default action the
    // attribute already reads "submit" and the form would submit again.
    event.preventDefault();
    setOutcome(null);
    setError(null);
    setPhase('editing');
  }

  const label = <Markdown source={question.question} />;

  if (!loaded) {
    return <div className={`askq ${className ?? ''}`} aria-busy="true" />;
  }

  if (!student) {
    return (
      <div className={`askq ${className ?? ''}`}>
        <div className="askq-question">{label}</div>
        <NameGate prompt={namePrompt} />
      </div>
    );
  }

  const disabled = phase !== 'editing' || locked;

  return (
    <form className={`askq ${className ?? ''}`} onSubmit={handleSubmit} noValidate>
      <QuestionInput
        question={question}
        label={label}
        uid={uid}
        value={value}
        onChange={(next) => {
          setValue(next);
          setError(null);
        }}
        disabled={disabled}
      />

      <div className="askq-actions">
        {phase === 'submitted' ? (
          allowRetries ? (
            <button
              key="retry"
              type="button"
              className="askq-button askq-button--ghost"
              onClick={handleRetry}
            >
              Try again
            </button>
          ) : null
        ) : (
          <button
            key="submit"
            type="submit"
            className="askq-button"
            disabled={phase === 'submitting'}
          >
            {phase === 'submitting' ? 'Submitting…' : 'Submit'}
          </button>
        )}

        {attempts > 0 ? (
          <span className="askq-attempts">
            {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
          </span>
        ) : null}
      </div>

      <div className="askq-feedback" aria-live="polite">
        {error ? (
          <p className="askq-error" role="alert">
            {error}
          </p>
        ) : null}

        {outcome ? <Feedback outcome={outcome} reveal={reveal} graded={graded} answer={correctAnswerText} /> : null}

        {locked && !outcome ? (
          <p className="askq-note">You have already answered this question.</p>
        ) : null}
      </div>
    </form>
  );
}

function Feedback({
  outcome,
  reveal,
  graded,
  answer,
}: {
  outcome: Outcome;
  reveal: 'never' | 'if-correct' | 'always';
  graded: boolean;
  answer: string | null;
}) {
  const showVerdict = reveal !== 'never' && graded && outcome.correct !== null;
  const showAnswer = reveal === 'always' && answer !== null;

  return (
    <div className="askq-result">
      {showVerdict ? (
        <p className={outcome.correct ? 'askq-verdict askq-verdict--ok' : 'askq-verdict askq-verdict--no'}>
          <span aria-hidden="true">{outcome.correct ? '✓' : '✗'}</span>{' '}
          {outcome.correct ? 'Correct' : 'Not quite'}
        </p>
      ) : (
        <p className="askq-note">Answer submitted.</p>
      )}

      {showAnswer ? (
        <p className="askq-note">
          Correct answer: <strong>{answer}</strong>
        </p>
      ) : null}

      {outcome.queued ? (
        <p className="askq-note askq-note--warn">
          Saved on this device — it will be sent when the connection returns.
        </p>
      ) : null}
    </div>
  );
}
