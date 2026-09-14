import '../lib/askq-config';
import { useLocale } from '@askq/react';
import { siteText, type SiteKey } from '../lib/site-text';

export interface SiteTextProps {
  k: SiteKey;
  as?: 'h1' | 'h2' | 'p' | 'span' | 'strong';
  className?: string;
}

/**
 * One piece of the site's own prose, in the active language.
 *
 * Astro renders this server-side in the default locale, then hydrates and
 * follows the picker — so the page reads correctly before JavaScript arrives.
 */
export default function SiteText({ k, as = 'span', className }: SiteTextProps) {
  const { locale } = useLocale();
  const Tag = as;
  return <Tag className={className}>{siteText(locale, k)}</Tag>;
}
