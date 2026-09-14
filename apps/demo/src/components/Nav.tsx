import '../lib/askq-config';
import { StudentBadge } from '@askq/react';

/** Header widget: who is answering, plus the log-out button that clears them. */
export default function Nav() {
  return <StudentBadge signedOutLabel="Not signed in" />;
}
