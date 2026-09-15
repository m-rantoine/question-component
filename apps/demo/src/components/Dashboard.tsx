import '../lib/askq-config';
import { AnswerDashboard, type AnswerDashboardProps, type DashboardTarget } from '@askq/react/dashboard';
import { DASHBOARD_ROOT, groupHref, questionHref } from '../lib/dashboard-links';

/**
 * Island wrapper around the packaged dashboard.
 *
 * It exists for one reason: Astro serialises island props as JSON, so `linkTo`
 * — a function — has to be supplied on the client side rather than from the
 * `.astro` page. Everything else the dashboard does is in the package.
 */
function linkTo(target: DashboardTarget): string {
  if (target.kind === 'groups') return DASHBOARD_ROOT;
  if (target.kind === 'group') return groupHref(target.groupId);
  return questionHref(target.groupId, target.questionId);
}

export default function Dashboard(props: AnswerDashboardProps & { signOut?: boolean }) {
  const { signOut, ...rest } = props;
  return (
    <AnswerDashboard
      {...rest}
      linkTo={linkTo}
      sessionPicker
      signOutHref={signOut ? '/api/teacher/logout' : undefined}
    />
  );
}
