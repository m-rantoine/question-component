import { useMemo } from 'react';
import { renderMarkdown } from '../markdown';

export interface MarkdownProps {
  source: string;
  mode?: 'inline' | 'block';
  className?: string;
}

/**
 * `dangerouslySetInnerHTML` is safe here: `renderMarkdown` escapes the whole
 * source before it produces any markup, so input cannot introduce a tag.
 */
export function Markdown({ source, mode = 'inline', className }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(source, mode), [source, mode]);
  if (mode === 'block') {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
