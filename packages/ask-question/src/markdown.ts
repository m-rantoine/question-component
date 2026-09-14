/**
 * A deliberately small, escape-first markdown renderer.
 *
 * Question text is developer-authored, but student answers are also rendered
 * through the same path in the dashboard, so everything is HTML-escaped BEFORE
 * any markup is produced. There is no way for input to introduce a tag.
 *
 * Supported: `**bold**`, `*italic*` / `_italic_`, `` `code` ``, `~~strike~~`,
 * `[text](href)`, and in block mode blank-line paragraphs plus `- ` lists.
 * Anything else renders as literal text.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

/** Only http(s), mailto, root-relative and fragment links survive; everything else is dropped. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) return trimmed;
  return null;
}

// Sentinel used to park code spans while the rest of the inline syntax is processed.
// A private-use code point, so it can never appear in escaped input.
const SENTINEL = '';

function renderInlineEscaped(escaped: string): string {
  const codes: string[] = [];
  let out = escaped.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });

  const linkRe = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
  out = out.replace(linkRe, (_match, text: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return text;
    return `<a href="${safe}" rel="noopener noreferrer">${text}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, '$1<em>$2</em>');

  const sentinelRe = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g');
  return out.replace(sentinelRe, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
}

/** Inline-only render: no wrapping `<p>`, so short question text has no stray margins. */
export function renderMarkdownInline(source: string): string {
  return renderInlineEscaped(escapeHtml(source));
}

/** Block render: blank-line paragraphs, `- ` bullet lists, single newlines become `<br>`. */
export function renderMarkdownBlock(source: string): string {
  const blocks = escapeHtml(source.replace(/\r\n/g, '\n')).split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';
      if (lines.every((l) => /^\s*-\s+/.test(l))) {
        const items = lines
          .map((l) => `<li>${renderInlineEscaped(l.replace(/^\s*-\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${renderInlineEscaped(lines.join('\n')).replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('');
}

export function renderMarkdown(source: string, mode: 'inline' | 'block' = 'inline'): string {
  return mode === 'block' ? renderMarkdownBlock(source) : renderMarkdownInline(source);
}
