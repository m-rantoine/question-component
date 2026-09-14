import { useState } from 'react';
import {
  summariseNumeric,
  tallyOptions,
  tallyText,
  type QuestionSummary,
  type StudentResult,
} from '../aggregate';
import { formatAnswer, formatCorrectAnswer } from '../grade';
import { useQuestion, useQuestionSummary } from '../hooks';
import type { Question } from '../types';
import { Markdown } from './Markdown';
import { BarList, Histogram } from './summary/Charts';

export type AnswersView = 'summary' | 'per-student' | 'toggle';

export interface SeeAnswersProps {
  q?: Question;
  /** `"<groupId>/<questionId>"`, for Astro islands. */
  id?: string;
  /** Defaults to `summary`. `toggle` adds a switch between the two views. */
  view?: AnswersView;
  className?: string;
  /** Hide the question text, e.g. when the dashboard already prints it. */
  hideQuestion?: boolean;
}

/** Teacher-facing results for one question. Reads from the shared group poller. */
export function SeeAnswers({ q, id, view = 'summary', className, hideQuestion }: SeeAnswersProps) {
  const question = useQuestion(q, id);
  const summary = useQuestionSummary(question);
  const [active, setActive] = useState<'summary' | 'per-student'>(
    view === 'per-student' ? 'per-student' : 'summary',
  );

  const shown = view === 'toggle' ? active : view;
  const { snapshot } = summary;

  return (
    <section className={`askq-answers ${className ?? ''}`}>
      <header className="askq-answers__header">
        {hideQuestion ? null : (
          <h3 className="askq-answers__title">
            <Markdown source={question.question} />
          </h3>
        )}
        {view === 'toggle' ? (
          <div className="askq-toggle" role="group" aria-label="Result view">
            <button
              type="button"
              className={`askq-toggle__button ${shown === 'summary' ? 'is-active' : ''}`}
              aria-pressed={shown === 'summary'}
              onClick={() => setActive('summary')}
            >
              Summary
            </button>
            <button
              type="button"
              className={`askq-toggle__button ${shown === 'per-student' ? 'is-active' : ''}`}
              aria-pressed={shown === 'per-student'}
              onClick={() => setActive('per-student')}
            >
              Per student
            </button>
          </div>
        ) : null}
      </header>

      <p className="askq-answers__stats">
        <strong>{summary.responded}</strong> {summary.responded === 1 ? 'student' : 'students'}
        {summary.correctRate === null ? null : (
          <>
            {' · '}
            <strong>{summary.correctCount}</strong> correct (
            {Math.round(summary.correctRate * 100)}%)
          </>
        )}
        {question.allowMultipleAttempts === false ? (
          <span className="askq-muted"> · first attempt only</span>
        ) : null}
      </p>

      {snapshot.status === 'error' && summary.responded === 0 ? (
        <p className="askq-error" role="alert">
          Could not load results: {snapshot.error}
        </p>
      ) : null}

      {summary.responded === 0 ? (
        <p className="askq-note">
          {snapshot.status === 'loading' ? 'Loading results…' : 'No answers yet.'}
        </p>
      ) : shown === 'summary' ? (
        <SummaryView question={question} summary={summary} />
      ) : (
        <PerStudentView question={question} summary={summary} />
      )}

      {summary.responded > 0 ? (
        <p className="askq-answers__footnote">
          Attempts per student — min {summary.attempts.min} · avg {summary.attempts.avg} · max{' '}
          {summary.attempts.max}
        </p>
      ) : null}
    </section>
  );
}

function SummaryView({ question, summary }: { question: Question; summary: QuestionSummary }) {
  switch (question.type) {
    case 'multiple-choice':
    case 'button-choice':
      return <BarList tallies={tallyOptions(question, summary.results)} total={summary.responded} />;

    case 'checkboxes':
      return (
        <>
          <BarList tallies={tallyOptions(question, summary.results)} total={summary.responded} />
          {question.partialCredit && summary.averageScore !== null ? (
            <p className="askq-note">
              Average partial score: {Math.round(summary.averageScore * 100)}%
            </p>
          ) : null}
        </>
      );

    case 'short-text':
      return <BarList tallies={tallyText(question, summary.results)} total={summary.responded} />;

    case 'long-text':
      return (
        <ul className="askq-responses">
          {[...summary.results]
            .sort((a, b) => b.effective.created_at.localeCompare(a.effective.created_at))
            .map((result) => (
              <li className="askq-responses__item" key={result.key}>
                <span className="askq-responses__who">{result.name}</span>
                <span className="askq-responses__text">
                  {formatAnswer(question, result.effective.answer)}
                </span>
              </li>
            ))}
        </ul>
      );

    case 'number':
    case 'scale':
    case 'rating': {
      const numeric = summariseNumeric(question, summary.results);
      return (
        <>
          <Histogram bins={numeric.bins} total={numeric.count} />
          <p className="askq-note">
            mean {numeric.mean} · median {numeric.median}
            {formatCorrectAnswer(question) ? (
              <> · correct {formatCorrectAnswer(question)}</>
            ) : null}
          </p>
        </>
      );
    }

    default:
      return null;
  }
}

function PerStudentView({ question, summary }: { question: Question; summary: QuestionSummary }) {
  return (
    <div className="askq-table-wrap">
      <table className="askq-table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Answer</th>
            {summary.graded ? <th scope="col">Result</th> : null}
            <th scope="col">Attempts</th>
            <th scope="col">Answered</th>
          </tr>
        </thead>
        <tbody>
          {summary.results.map((result) => (
            <StudentRow key={result.key} question={question} result={result} graded={summary.graded} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentRow({
  question,
  result,
  graded,
}: {
  question: Question;
  result: StudentResult;
  graded: boolean;
}) {
  const multiple = result.attempts.length > 1;
  return (
    <tr>
      <th scope="row">{result.name}</th>
      <td>{formatAnswer(question, result.effective.answer)}</td>
      {graded ? (
        <td>
          {result.correct === null ? (
            <span className="askq-muted">—</span>
          ) : (
            <span
              className={result.correct ? 'askq-verdict--ok' : 'askq-verdict--no'}
              title={result.correct ? 'Correct' : 'Incorrect'}
            >
              <span aria-hidden="true">{result.correct ? '✓' : '✗'}</span>
              <span className="askq-sr-only">{result.correct ? 'Correct' : 'Incorrect'}</span>
            </span>
          )}
        </td>
      ) : null}
      <td>
        {multiple ? (
          <details className="askq-history">
            <summary>{result.attempts.length}</summary>
            <ol className="askq-history__list">
              {result.attempts.map((attempt) => (
                <li key={attempt.id}>
                  <span className="askq-history__when">{shortTime(attempt.created_at)}</span>{' '}
                  {formatAnswer(question, attempt.answer)}
                </li>
              ))}
            </ol>
          </details>
        ) : (
          result.attempts.length
        )}
      </td>
      <td className="askq-muted">{shortTime(result.effective.created_at)}</td>
    </tr>
  );
}

function shortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
