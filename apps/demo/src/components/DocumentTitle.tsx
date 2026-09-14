import '../lib/askq-config';
import { useEffect } from 'react';
import { useLocale } from '@askq/react';
import { siteText, type SiteKey } from '../lib/site-text';

export interface DocumentTitleProps {
  k: SiteKey;
  /** Appended after an em dash, e.g. the group or question id. Not translated. */
  suffix?: string;
}

/** Keeps <title> in step with the picker. Renders nothing. */
export default function DocumentTitle({ k, suffix }: DocumentTitleProps) {
  const { locale } = useLocale();
  useEffect(() => {
    const base = siteText(locale, k);
    document.title = suffix ? `${base} — ${suffix}` : base;
  }, [locale, k, suffix]);
  return null;
}
