import '../lib/askq-config';
import { useLocale } from '@askq/react';
import { siteText, type SiteKey } from '../lib/site-text';

/**
 * Says plainly that the dashboard is open.
 *
 * It used to sit behind an unguessable path segment, which protected nothing
 * but looked like it did. With the segment gone, an unconfigured deployment has
 * to say so rather than look the same as a protected one.
 */
export default function UnprotectedNotice({ k = 'dashboard.unprotected' }: { k?: SiteKey }) {
  const { locale } = useLocale();
  return (
    <div className="notice notice--warning" role="status">
      {siteText(locale, k)}
    </div>
  );
}
