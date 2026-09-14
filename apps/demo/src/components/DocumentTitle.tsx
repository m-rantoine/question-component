import '../lib/askq-config';
import { useEffect } from 'react';
import { useLocale } from '@askq/react';
import { siteText, type SiteKey } from '../lib/site-text';

/** Keeps <title> in step with the picker. Renders nothing. */
export default function DocumentTitle({ k }: { k: SiteKey }) {
  const { locale } = useLocale();
  useEffect(() => {
    document.title = siteText(locale, k);
  }, [locale, k]);
  return null;
}
