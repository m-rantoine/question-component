import '../lib/askq-config';
import { isOfflineMode } from '@askq/react';

/** Visible reminder that answers are not being stored anywhere yet. */
export default function SetupNotice() {
  if (!isOfflineMode()) return null;
  return (
    <div className="notice">
      <strong>Demo mode.</strong> No Supabase credentials are configured, so answers are kept in
      memory for this page only and disappear on reload. Copy <code>.env.example</code> to{' '}
      <code>.env</code> and fill it in to store answers for real.
    </div>
  );
}
