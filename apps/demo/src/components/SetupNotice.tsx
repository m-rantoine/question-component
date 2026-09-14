import '../lib/askq-config';
import { isOfflineMode, useLocale } from '@askq/react';
import { siteText } from '../lib/site-text';

/** Visible reminder that answers are not being stored anywhere yet. */
export default function SetupNotice() {
  const { locale } = useLocale();
  if (!isOfflineMode()) return null;
  return (
    <div className="notice">
      <strong>{siteText(locale, 'setup.title')}</strong> {siteText(locale, 'setup.body')}
    </div>
  );
}
