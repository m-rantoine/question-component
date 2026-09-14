import '../lib/askq-config';
import { useLocale } from '@askq/react';
import { siteFn, siteText } from '../lib/site-text';

export interface GroupHeadingProps {
  groupId: string;
  questionCount: number;
  /** Renders a link to the group's own page instead of a plain heading. */
  href?: string;
}

/** "Results — lesson-1", with the group id shown verbatim since it is an id. */
export default function GroupHeading({ groupId, questionCount, href }: GroupHeadingProps) {
  const { locale } = useLocale();
  const label = (
    <>
      {siteText(locale, 'dashboard.title')} — <code>{groupId}</code>
    </>
  );

  return (
    <div className="group-heading">
      <h2 className="group-heading__title">{href ? <a href={href}>{label}</a> : label}</h2>
      <span className="group-heading__count">{siteFn(locale).questionCount(questionCount)}</span>
    </div>
  );
}
