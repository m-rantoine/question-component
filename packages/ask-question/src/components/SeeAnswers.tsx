import { useState } from 'react';
import {
  summariseNumeric,
  tallyOptions,
  tallyText,
  type QuestionSummary,
  type StudentResult,
} from '../aggregate';
import { formatAnswer, formatCorrectAnswer } from '../grade';
import { useLocale, useQuestion, useQuestionSummary } from '../hooks';
import { formatNumber, formatPercent, formatTime, type Locale, type Messages } from '../i18n';
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
  /** Score one session only. Omit to include every session, and unscoped answers. */
  sessionId?: string;
  className?: string;
  /** Hide the question text, e.g. when the dashboard already prints it. */
  hideQuestion?: boolean;
  /** Turns the question title into a link, e.g. to this question's own page. */
  titleHref?: string;
}

/** Teacher-facing results for one question. Reads from the shared group poller. */
export function SeeAnswers({
  q,
  id,
  view = 'summary',
  sessionId,
  className,
  hideQuestion,
  titleHref,
}: SeeAnswersProps) {
  const question = useQuestion(q, id);
  const { locale, messages } = useLocale();
  const summary = useQuestionSummary(question, sessionId);
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
            {titleHref ? (
              <a className="askq-answers__link" href={titleHref}>
                <Markdown source={question.question} />
              </a>
            ) : (
              <Markdown source={question.question} />
            )}
          </h3>
        )}
        {view === 'toggle' ? (
          <div className="askq-toggle" role="group" aria-label={messages.resultView}>
            <button
              type="button"
              className={`askq-toggle__button ${shown === 'summary' ? 'is-active' : ''}`}
              aria-pressed={shown === 'summary'}
              onClick={() => setActive('summary')}
            >
              {messages.summaryView}
            </button>
            <button
              type="button"
              className={`askq-toggle__button ${shown === 'per-student' ? 'is-active' : ''}`}
              aria-pressed={shown === 'per-student'}
              onClick={() => setActive('per-student')}
            >
              {messages.perStudentView}
            </button>
          </div>
        ) : null}
      </header>

      <p className="askq-answers__stats">
        <strong>{formatNumber(summary.responded, locale)}</strong>{' '}
        {messages.studentCount(summary.responded)}
        {summary.correctRate === null ? null : (
          <>
            {' · '}
            {messages.correctSummary(summary.correctCount, formatPercent(summary.correctRate, locale))}
          </>
        )}
        {question.allowMultipleAttempts === false ? (
          <span className="askq-muted"> · {messages.firstAttemptOnly}</span>
        ) : null}
      </p>

      {snapshot.status === 'error' && summary.responded === 0 ? (
        <p className="askq-error" role="alert">
          {messages.couldNotLoad(snapshot.error ?? '')}
        </p>
      ) : null}

      {summary.responded === 0 ? (
        <p className="askq-note">
          {snapshot.status === 'loading' ? messages.loadingResults : messages.noAnswersYet}
        </p>
      ) : shown === 'summary' ? (
        <SummaryView question={question} summary={summary} locale={locale} messages={messages} />
      ) : (
        <PerStudentView question={question} summary={summary} locale={locale} messages={messages} />
      )}

      {summary.responded > 0 ? (
        <p className="askq-answers__footnote">
          {messages.attemptsFootnote(
            formatNumber(summary.attempts.min, locale),
            formatNumber(summary.attempts.avg, locale),
            formatNumber(summary.attempts.max, locale),
          )}
        </p>
      ) : null}
    </section>
  );
}

interface ViewProps {
  question: Question;
  summary: QuestionSummary;
  locale: Locale;
  messages: Messages;
}

function SummaryView({ question, summary, locale, messages }: ViewProps) {
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
              {messages.averagePartialScore(formatPercent(summary.averageScore, locale))}
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
            {messages.meanMedian(
              formatNumber(numeric.mean, locale),
              formatNumber(numeric.median, locale),
            )}
            {formatCorrectAnswer(question) ? (
              <> · {messages.correctValue(formatCorrectAnswer(question) as string)}</>
            ) : null}
          </p>
        </>
      );
    }

    default:
      return null;
  }
}

function PerStudentView({ question, summary, locale, messages }: ViewProps) {
  return (
    <div className="askq-table-wrap">
      <table className="askq-table">
        <thead>
          <tr>
            <th scope="col">{messages.tableStudent}</th>
            <th scope="col">{messages.tableAnswer}</th>
            {summary.graded ? <th scope="col">{messages.tableResult}</th> : null}
            <th scope="col">{messages.tableAttempts}</th>
            <th scope="col">{messages.tableAnswered}</th>
          </tr>
        </thead>
        <tbody>
          {summary.results.map((result) => (
            <StudentRow
              key={result.key}
              question={question}
              result={result}
              graded={summary.graded}
              locale={locale}
              messages={messages}
            />
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
  locale,
  messages,
}: {
  question: Question;
  result: StudentResult;
  graded: boolean;
  locale: Locale;
  messages: Messages;
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
              title={result.correct ? messages.correctVerdict : messages.incorrectVerdict}
            >
              <span aria-hidden="true">{result.correct ? '✓' : '✗'}</span>
              <span className="askq-sr-only">
                {result.correct ? messages.correctVerdict : messages.incorrectVerdict}
              </span>
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
                  <span className="askq-history__when">
                    {formatTime(attempt.created_at, locale)}
                  </span>{' '}
                  {formatAnswer(question, attempt.answer)}
                </li>
              ))}
            </ol>
          </details>
        ) : (
          result.attempts.length
        )}
      </td>
      <td className="askq-muted">{formatTime(result.effective.created_at, locale)}</td>
    </tr>
  );
}
