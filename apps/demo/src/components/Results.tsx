import '../lib/askq-config';
import { AnswersProvider, SeeAnswers, type AnswersView } from '@askq/react';

export interface ResultsProps {
  groupId: string;
  /** `"<groupId>/<questionId>"` for each question to show. */
  questionIds: string[];
  view?: AnswersView;
}

/**
 * The whole dashboard is ONE island on purpose: `AnswersProvider` holds a single
 * poller for the group, so twenty questions still cost one request every five
 * seconds rather than twenty.
 */
export default function Results({ groupId, questionIds, view = 'toggle' }: ResultsProps) {
  return (
    <AnswersProvider groupId={groupId}>
      {questionIds.map((id) => (
        <SeeAnswers key={id} id={id} view={view} />
      ))}
    </AnswersProvider>
  );
}
