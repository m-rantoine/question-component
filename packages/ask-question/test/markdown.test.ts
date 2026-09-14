import { describe, expect, it } from 'vitest';
import { renderMarkdownBlock, renderMarkdownInline } from '../src/markdown';

describe('markdown', () => {
  it('escapes html before producing any markup', () => {
    expect(renderMarkdownInline('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('renders bold, italic, code and strikethrough', () => {
    expect(renderMarkdownInline('What is **1 + 1**?')).toBe('What is <strong>1 + 1</strong>?');
    expect(renderMarkdownInline('an _apple_')).toBe('an <em>apple</em>');
    expect(renderMarkdownInline('use `let`')).toBe('use <code>let</code>');
    expect(renderMarkdownInline('~~no~~')).toBe('<del>no</del>');
  });

  it('does not re-process the inside of a code span', () => {
    expect(renderMarkdownInline('`**not bold**`')).toBe('<code>**not bold**</code>');
  });

  it('keeps safe links and drops dangerous ones', () => {
    expect(renderMarkdownInline('[docs](https://example.com)')).toContain(
      '<a href="https://example.com" rel="noopener noreferrer">docs</a>',
    );
    expect(renderMarkdownInline('[x](javascript:alert(1))')).toBe('x');
  });

  it('renders paragraphs and bullet lists in block mode', () => {
    expect(renderMarkdownBlock('one\n\ntwo')).toBe('<p>one</p><p>two</p>');
    expect(renderMarkdownBlock('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });
});
