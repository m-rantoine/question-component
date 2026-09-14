import '../lib/askq-config';
import { AnswersProvider, SeeAnswers, type AnswersView } from '@askq/react';
import { questionHref } from '../lib/dashboard-links';

export interface ResultsProps {
  groupId: string;
  /** `"<groupId>/<questionId>"` for each question to show. */
  questionIds: string[];
  view?: AnswersView;
  /** Link each question's title to its own page. */
  linkQuestions?: boolean;
}

/**
 * The whole dashboard section is ONE island on purpose: `AnswersProvider` holds
 * a single poller for the group, so twenty questions still cost one request
 * every five seconds rather than twenty.
 */
export default function Results({
  groupId,
  questionIds,
  view = 'toggle',
  linkQuestions = false,
}: ResultsProps) {
  return (
    <AnswersProvider groupId={groupId}>
      {questionIds.map((id) => (
        <SeeAnswers
          key={id}
          id={id}
          view={view}
          titleHref={linkQuestions ? questionHref(groupId, id.split('/').slice(1).join('/')) : undefined}
        />
      ))}
    </AnswersProvider>
  );
}
