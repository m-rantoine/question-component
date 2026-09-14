import '../lib/askq-config';
import { useLocale } from '@askq/react';
import { siteFn, siteText } from '../lib/site-text';

export interface QuestionNavProps {
  /** null at the ends of the group. */
  prevHref: string | null;
  nextHref: string | null;
  groupHref: string;
  /** 1-based position in the group. */
  index: number;
  total: number;
}

/**
 * Previous / next across the questions of one group.
 *
 * Real links, not buttons: every question has its own URL, so they work on
 * middle-click, they can be bookmarked, and they survive a failed hydration.
 */
export default function QuestionNav({
  prevHref,
  nextHref,
  groupHref,
  index,
  total,
}: QuestionNavProps) {
  const { locale } = useLocale();

  return (
    <nav className="qnav" aria-label={siteText(locale, 'dashboard.group')}>
      {prevHref ? (
        <a className="qnav__link" href={prevHref} rel="prev">
          {siteText(locale, 'dashboard.previous')}
        </a>
      ) : (
        <span className="qnav__link qnav__link--off" aria-disabled="true">
          {siteText(locale, 'dashboard.previous')}
        </span>
      )}

      <span className="qnav__position">
        {siteFn(locale).questionPosition(index, total)}
        <a className="qnav__up" href={groupHref}>
          {siteText(locale, 'dashboard.backToGroup')}
        </a>
      </span>

      {nextHref ? (
        <a className="qnav__link" href={nextHref} rel="next">
          {siteText(locale, 'dashboard.next')}
        </a>
      ) : (
        <span className="qnav__link qnav__link--off" aria-disabled="true">
          {siteText(locale, 'dashboard.next')}
        </span>
      )}
    </nav>
  );
}
