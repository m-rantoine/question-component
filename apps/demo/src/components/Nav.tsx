import '../lib/askq-config';
import { LanguagePicker, StudentBadge } from '@askq/react';

/** Header controls: interface language, plus who is answering and the log-out button. */
export default function Nav({ showIdentity = true }: { showIdentity?: boolean }) {
  return (
    <div className="site-header__controls">
      <LanguagePicker />
      {showIdentity ? <StudentBadge /> : null}
    </div>
  );
}
