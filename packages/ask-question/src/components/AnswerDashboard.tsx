import { useMemo, useState } from 'react';
import { csvFilename, downloadCsv, toCsv } from '../csv';
import { useGroupAnswers, useLocale, useSessionIds } from '../hooks';
import type { Messages } from '../i18n';
import { AnswersProvider } from '../providers';
import { questionKey, questionsInGroup, registeredGroupIds } from '../registry';
import type { Question } from '../types';
import { SeeAnswers, type AnswersView } from './SeeAnswers';

/**
 * The whole teacher dashboard as one component.
 *
 *   <AnswerDashboard show="all" />
 *   <AnswerDashboard show="groupPicker" />
 *   <AnswerDashboard show="group" groupId="unit-1-lesson-1" />
 *   <AnswerDashboard show="question" groupId="unit-1-lesson-1" questionId="question-1" />
 *
 * Without `linkTo` it owns its navigation: the group picker and previous/next
 * are buttons that re-render in place, which is what a drop-in component needs
 * when it knows nothing about the host's router. Pass `linkTo` and the same
 * controls become real links, so every view has its own URL.
 */

export type DashboardTarget =
  | { kind: 'groups' }
  | { kind: 'group'; groupId: string }
  | { kind: 'question'; groupId: string; questionId: string };

export interface AnswerDashboardCommon {
  /** Passed to every `SeeAnswers`. Defaults to `toggle`. */
  view?: AnswersView;
  /** Show one session only. Omit for every session, including unscoped answers. */
  sessionId?: string;
  /** Render a session `<select>` built from the sessions seen in the answers. */
  sessionPicker?: boolean;
  /** Render a "Download CSV" button scoped to what is on screen. Defaults to true. */
  csv?: boolean;
  /** Supply to render navigation as links instead of buttons. */
  linkTo?: (target: DashboardTarget) => string;
  className?: string;
}

export type AnswerDashboardProps = AnswerDashboardCommon &
  (
    | { show?: 'all' | 'groupPicker' }
    | { show: 'group'; groupId: string }
    | {
        show: 'question';
        groupId: string;
        questionId: string;
        /** Previous/next across the group. Defaults to true. */
        navAll?: boolean;
      }
  );

type Route =
  | { kind: 'all' }
  | { kind: 'groupPicker' }
  | { kind: 'group'; groupId: string }
  | { kind: 'question'; groupId: string; questionId: string };

function routeFromProps(props: AnswerDashboardProps): Route {
  const show = props.show ?? 'all';
  if (show === 'group') return { kind: 'group', groupId: (props as { groupId: string }).groupId };
  if (show === 'question') {
    const { groupId, questionId } = props as { groupId: string; questionId: string };
    return { kind: 'question', groupId, questionId };
  }
  return { kind: show };
}

/** `undefined` means "every session"; the select needs a string for that. */
const ALL_SESSIONS = '';

export function AnswerDashboard(props: AnswerDashboardProps) {
  const {
    view = 'toggle',
    sessionId,
    sessionPicker = false,
    csv = true,
    linkTo,
    className,
  } = props;
  const { messages } = useLocale();

  // Internal navigation, reset whenever the props name a different view. When
  // `linkTo` is supplied the host owns navigation, so props win outright.
  const fromProps = routeFromProps(props);
  const signature = JSON.stringify(fromProps);
  const [nav, setNav] = useState<Route>(fromProps);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setNav(fromProps);
  }
  const route = linkTo ? fromProps : nav;

  const [session, setSession] = useState<string>(sessionId ?? ALL_SESSIONS);
  const activeSession = sessionPicker
    ? session === ALL_SESSIONS
      ? undefined
      : session
    : sessionId;

  const groupIds = useMemo(
    () => (route.kind === 'all' || route.kind === 'groupPicker' ? registeredGroupIds() : [route.groupId]),
    [route],
  );

  const picker = sessionPicker ? (
    <SessionPicker
      groupIds={groupIds}
      value={session}
      onChange={setSession}
      messages={messages}
    />
  ) : null;

  const navigate = linkTo ? undefined : setNav;

  return (
    <div className={`askq-dashboard ${className ?? ''}`}>
      {route.kind === 'all' ? (
        <AllGroups
          groupIds={groupIds}
          view={view}
          sessionId={activeSession}
          csv={csv}
          linkTo={linkTo}
          navigate={navigate}
          toolbar={picker}
          messages={messages}
        />
      ) : route.kind === 'groupPicker' ? (
        <GroupPicker groupIds={groupIds} linkTo={linkTo} navigate={navigate} messages={messages} />
      ) : route.kind === 'group' ? (
        <GroupView
          groupId={route.groupId}
          view={view}
          sessionId={activeSession}
          csv={csv}
          linkTo={linkTo}
          navigate={navigate}
          toolbar={picker}
          messages={messages}
        />
      ) : (
        <QuestionView
          groupId={route.groupId}
          questionId={route.questionId}
          navAll={(props as { navAll?: boolean }).navAll !== false}
          view={view}
          sessionId={activeSession}
          csv={csv}
          linkTo={linkTo}
          navigate={navigate}
          toolbar={picker}
          messages={messages}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

interface ViewProps {
  view: AnswersView;
  sessionId: string | undefined;
  csv: boolean;
  linkTo?: (target: DashboardTarget) => string;
  navigate?: (route: Route) => void;
  toolbar: React.ReactNode;
  messages: Messages;
}

function AllGroups({
  groupIds,
  ...rest
}: ViewProps & { groupIds: readonly string[] }) {
  if (groupIds.length === 0) return <p className="askq-dashboard__empty">{rest.messages.noGroups}</p>;
  return (
    <>
      {rest.toolbar}
      {groupIds.map((groupId) => (
        <section className="askq-dashboard__group" key={groupId}>
          <GroupBody {...rest} groupId={groupId} toolbar={null} linkQuestions headingLinked />
        </section>
      ))}
    </>
  );
}

function GroupPicker({
  groupIds,
  linkTo,
  navigate,
  messages,
}: {
  groupIds: readonly string[];
  linkTo?: (target: DashboardTarget) => string;
  navigate?: (route: Route) => void;
  messages: Messages;
}) {
  if (groupIds.length === 0) return <p className="askq-dashboard__empty">{messages.noGroups}</p>;
  return (
    <nav className="askq-dashboard__picker" aria-label={messages.chooseGroup}>
      <h2 className="askq-dashboard__picker-title">{messages.chooseGroup}</h2>
      <ul className="askq-dashboard__picker-list">
        {groupIds.map((groupId) => {
          const count = questionsInGroup(groupId).length;
          const label = (
            <>
              <code>{groupId}</code>
              <span className="askq-dashboard__count">{messages.questionCount(count)}</span>
            </>
          );
          return (
            <li key={groupId}>
              {linkTo ? (
                <a className="askq-dashboard__picker-item" href={linkTo({ kind: 'group', groupId })}>
                  {label}
                </a>
              ) : (
                <button
                  type="button"
                  className="askq-dashboard__picker-item"
                  onClick={() => navigate?.({ kind: 'group', groupId })}
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function GroupView({ groupId, ...rest }: ViewProps & { groupId: string }) {
  return (
    <>
      <Breadcrumb {...rest} />
      <GroupBody {...rest} groupId={groupId} linkQuestions />
    </>
  );
}

function QuestionView({
  groupId,
  questionId,
  navAll,
  ...rest
}: ViewProps & { groupId: string; questionId: string; navAll: boolean }) {
  const questions = questionsInGroup(groupId);
  const index = questions.findIndex((question) => question.questionId === questionId);
  const previous = index > 0 ? questions[index - 1] : undefined;
  const next = index >= 0 && index < questions.length - 1 ? questions[index + 1] : undefined;
  const question = index >= 0 ? (questions[index] as Question) : undefined;

  const nav = navAll ? (
    <QuestionNav
      groupId={groupId}
      previous={previous}
      next={next}
      index={index + 1}
      total={questions.length}
      linkTo={rest.linkTo}
      navigate={rest.navigate}
      messages={rest.messages}
    />
  ) : null;

  return (
    <>
      <Breadcrumb {...rest} />
      <GroupHeading
        groupId={groupId}
        count={questions.length}
        href={rest.linkTo?.({ kind: 'group', groupId })}
        onOpen={rest.navigate ? () => rest.navigate?.({ kind: 'group', groupId }) : undefined}
        messages={rest.messages}
      />
      {rest.toolbar}
      {nav}
      <AnswersProvider groupId={groupId} sessionId={rest.sessionId}>
        {question ? (
          <SeeAnswers
            id={questionKey(groupId, questionId)}
            view={rest.view}
            sessionId={rest.sessionId}
          />
        ) : (
          <p className="askq-dashboard__empty">{rest.messages.noAnswersYet}</p>
        )}
        {rest.csv && question ? (
          <CsvButton
            groupId={groupId}
            questions={[question]}
            sessionId={rest.sessionId}
            messages={rest.messages}
          />
        ) : null}
      </AnswersProvider>
      {nav}
    </>
  );
}

/**
 * One group's questions under a single poller.
 *
 * `AnswersProvider` is the reason this is one component rather than a `SeeAnswers`
 * per question at the top level: twenty questions then cost one request every
 * five seconds instead of twenty.
 */
function GroupBody({
  groupId,
  view,
  sessionId,
  csv,
  linkTo,
  navigate,
  toolbar,
  messages,
  linkQuestions,
  headingLinked,
}: ViewProps & { groupId: string; linkQuestions?: boolean; headingLinked?: boolean }) {
  const questions = questionsInGroup(groupId);

  return (
    <>
      <GroupHeading
        groupId={groupId}
        count={questions.length}
        href={headingLinked ? linkTo?.({ kind: 'group', groupId }) : undefined}
        onOpen={headingLinked && navigate ? () => navigate({ kind: 'group', groupId }) : undefined}
        messages={messages}
      />
      {toolbar}
      <AnswersProvider groupId={groupId} sessionId={sessionId}>
        {questions.map((question) => (
          <SeeAnswers
            key={question.questionId}
            q={question}
            view={view}
            sessionId={sessionId}
            titleHref={
              linkQuestions
                ? linkTo?.({ kind: 'question', groupId, questionId: question.questionId })
                : undefined
            }
            onTitleClick={
              linkQuestions && navigate
                ? () => navigate({ kind: 'question', groupId, questionId: question.questionId })
                : undefined
            }
          />
        ))}
        {csv ? (
          <CsvButton
            groupId={groupId}
            questions={questions}
            sessionId={sessionId}
            messages={messages}
          />
        ) : null}
      </AnswersProvider>
    </>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Breadcrumb({ linkTo, navigate, messages }: Pick<ViewProps, 'linkTo' | 'navigate' | 'messages'>) {
  if (linkTo) {
    return (
      <p className="askq-dashboard__crumb">
        <a href={linkTo({ kind: 'groups' })}>{messages.allGroups}</a>
      </p>
    );
  }
  if (!navigate) return null;
  return (
    <p className="askq-dashboard__crumb">
      <button type="button" onClick={() => navigate({ kind: 'groupPicker' })}>
        {messages.allGroups}
      </button>
    </p>
  );
}

function GroupHeading({
  groupId,
  count,
  href,
  onOpen,
  messages,
}: {
  groupId: string;
  count: number;
  href?: string;
  onOpen?: () => void;
  messages: Messages;
}) {
  const label = (
    <>
      {messages.resultsTitle} — <code>{groupId}</code>
    </>
  );
  return (
    <div className="askq-dashboard__heading">
      <h2 className="askq-dashboard__heading-title">
        {href ? (
          <a href={href}>{label}</a>
        ) : onOpen ? (
          <button type="button" onClick={onOpen}>
            {label}
          </button>
        ) : (
          label
        )}
      </h2>
      <span className="askq-dashboard__count">{messages.questionCount(count)}</span>
    </div>
  );
}

/**
 * Previous/next across the questions of one group, in declaration order.
 *
 * With `linkTo` these are real links — bookmarkable, middle-clickable, and
 * marked `rel="prev"`/`rel="next"`. Without it they are buttons that swap the
 * question in place.
 */
function QuestionNav({
  groupId,
  previous,
  next,
  index,
  total,
  linkTo,
  navigate,
  messages,
}: {
  groupId: string;
  previous: Question | undefined;
  next: Question | undefined;
  index: number;
  total: number;
  linkTo?: (target: DashboardTarget) => string;
  navigate?: (route: Route) => void;
  messages: Messages;
}) {
  function step(question: Question | undefined, rel: 'prev' | 'next', label: string) {
    if (!question) {
      return (
        <span className="askq-qnav__link askq-qnav__link--off" aria-disabled="true">
          {label}
        </span>
      );
    }
    const target: DashboardTarget = {
      kind: 'question',
      groupId,
      questionId: question.questionId,
    };
    if (linkTo) {
      return (
        <a className="askq-qnav__link" href={linkTo(target)} rel={rel}>
          {label}
        </a>
      );
    }
    return (
      <button
        type="button"
        className="askq-qnav__link"
        onClick={() => navigate?.({ kind: 'question', groupId, questionId: question.questionId })}
      >
        {label}
      </button>
    );
  }

  return (
    <nav className="askq-qnav" aria-label={messages.groupLabel}>
      {step(previous, 'prev', messages.previousQuestion)}
      <span className="askq-qnav__position">
        {messages.questionPosition(index, total)}
        {linkTo ? (
          <a className="askq-qnav__up" href={linkTo({ kind: 'group', groupId })}>
            {messages.backToGroup}
          </a>
        ) : navigate ? (
          <button
            type="button"
            className="askq-qnav__up"
            onClick={() => navigate({ kind: 'group', groupId })}
          >
            {messages.backToGroup}
          </button>
        ) : null}
      </span>
      {step(next, 'next', messages.nextQuestion)}
    </nav>
  );
}

function SessionPicker({
  groupIds,
  value,
  onChange,
  messages,
}: {
  groupIds: readonly string[];
  value: string;
  onChange: (value: string) => void;
  messages: Messages;
}) {
  const sessions = useSessionIds(groupIds);
  // Nothing to choose between until at least one answer carries a session.
  if (sessions.length === 0) return null;

  return (
    <label className="askq-dashboard__sessions">
      <span>{messages.sessionLabel}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={ALL_SESSIONS}>{messages.allSessions}</option>
        {sessions.map((session) => (
          <option key={session} value={session}>
            {session}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Exports exactly what is on screen — the same group, questions and session.
 *
 * Reads the poller's cache rather than fetching, so it costs nothing and cannot
 * disagree with the summary above it.
 */
function CsvButton({
  groupId,
  questions,
  sessionId,
  messages,
}: {
  groupId: string;
  questions: readonly Question[];
  sessionId: string | undefined;
  messages: Messages;
}) {
  const { rows } = useGroupAnswers({ groupId, sessionId });
  if (rows.length === 0) return null;

  return (
    <div className="askq-dashboard__export">
      <button
        type="button"
        className="askq-dashboard__export-button"
        onClick={() =>
          downloadCsv(
            csvFilename({
              groupId,
              questionId: questions.length === 1 ? questions[0]?.questionId : undefined,
              sessionId,
            }),
            toCsv({ questions, rows }),
          )
        }
      >
        {messages.downloadCsv}
      </button>
    </div>
  );
}
