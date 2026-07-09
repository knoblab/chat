import React from 'react';

const INLINE_REGEX = /(`([^`]+)`|\*\*\*([^*]+)\*\*\*|___([^_]+)___|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_|https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

export const parseInlineMarkdown = (text: string, isMe: boolean): React.ReactNode[] => {
  if (!text) return [];

  const matches = [...text.matchAll(INLINE_REGEX)];
  if (matches.length === 0) {
    return [text];
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    const full = match[0];
    const matchIndex = match.index!;

    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    if (match[1]?.startsWith('`') && match[2] !== undefined) {
      // Inline code
      elements.push(
        <code
          key={`code-${idx}`}
          style={{
            background: isMe ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.06)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em'
          }}
        >
          {match[2]}
        </code>
      );
    } else if (match[3] !== undefined || match[4] !== undefined) {
      // Bold-Italic ***...*** or ___...___
      const biText = match[3] !== undefined ? match[3] : match[4];
      elements.push(
        <strong key={`bolditalic-${idx}`} style={{ fontWeight: 800 }}>
          <em style={{ fontStyle: 'italic' }}>
            {parseInlineMarkdown(biText, isMe)}
          </em>
        </strong>
      );
    } else if (match[5] !== undefined) {
      // Bold **...**
      elements.push(
        <strong key={`bold-${idx}`} style={{ fontWeight: 800 }}>
          {parseInlineMarkdown(match[5], isMe)}
        </strong>
      );
    } else if (match[6] !== undefined) {
      // Strikethrough ~~...~~
      elements.push(
        <del key={`del-${idx}`} style={{ opacity: 0.75 }}>
          {parseInlineMarkdown(match[6], isMe)}
        </del>
      );
    } else if (match[7] !== undefined || match[8] !== undefined) {
      // Italic *...* or _..._
      const italicText = match[7] !== undefined ? match[7] : match[8];
      elements.push(
        <em key={`italic-${idx}`} style={{ fontStyle: 'italic' }}>
          {parseInlineMarkdown(italicText, isMe)}
        </em>
      );
    } else if (full.startsWith('http')) {
      // URL
      elements.push(
        <a
          key={`link-${idx}`}
          href={full}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: isMe ? '#ffffff' : 'var(--color-functional-red)',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            fontWeight: 600
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {full}
        </a>
      );
    } else {
      elements.push(full);
    }

    lastIndex = matchIndex + full.length;
  });

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
};

export const renderSimpleMarkdown = (text: string, isMe: boolean): React.ReactNode => {
  if (!text) return null;

  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        result.push(
          <pre
            key={`cb-${codeBlockIndex++}`}
            style={{
              background: isMe ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.08)',
              padding: '8px 10px',
              borderRadius: '6px',
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              margin: '4px 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Check headings: # to ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const fontSizes = ['1.3em', '1.18em', '1.08em', '1.0em', '0.92em', '0.85em'];
      const fontSize = fontSizes[level - 1] || '1em';
      result.push(
        <div
          key={`line-${i}`}
          style={{
            fontSize,
            fontWeight: 800,
            margin: i === 0 ? '0 0 4px 0' : '6px 0 3px 0',
            lineHeight: 1.3,
            opacity: level > 3 ? 0.85 : 1
          }}
        >
          {parseInlineMarkdown(content, isMe)}
        </div>
      );
      continue;
    }

    // Check blockquote: > text
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const content = quoteMatch[1];
      result.push(
        <blockquote
          key={`line-${i}`}
          style={{
            borderLeft: isMe ? '3px solid rgba(255, 255, 255, 0.8)' : '3px solid var(--color-functional-red)',
            paddingLeft: '10px',
            margin: '4px 0',
            fontStyle: 'italic',
            background: isMe ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.04)',
            borderRadius: '0 4px 4px 0',
            padding: '4px 8px 4px 10px'
          }}
        >
          {parseInlineMarkdown(content, isMe)}
        </blockquote>
      );
      continue;
    }

    // Check task list (checklist): - [ ] task or - [x] task
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      const content = taskMatch[2];
      result.push(
        <div 
          key={`line-${i}`} 
          style={{ 
            display: 'flex', 
            gap: '8px', 
            paddingLeft: '4px', 
            margin: '3px 0', 
            alignItems: 'center' 
          }}
        >
          <input 
            type="checkbox" 
            checked={checked} 
            readOnly 
            style={{ 
              accentColor: 'var(--color-functional-red)',
              cursor: 'default',
              margin: 0
            }} 
          />
          <div style={{ flex: 1, textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>
            {parseInlineMarkdown(content, isMe)}
          </div>
        </div>
      );
      continue;
    }

    // Check bullet list: - text or * text
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[1];
      result.push(
        <div key={`line-${i}`} style={{ display: 'flex', gap: '6px', paddingLeft: '4px', margin: '2px 0' }}>
          <span>•</span>
          <div style={{ flex: 1 }}>{parseInlineMarkdown(content, isMe)}</div>
        </div>
      );
      continue;
    }

    // Check numbered list: 1. text
    const numberMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberMatch) {
      const num = numberMatch[1];
      const content = numberMatch[2];
      result.push(
        <div key={`line-${i}`} style={{ display: 'flex', gap: '6px', paddingLeft: '4px', margin: '2px 0' }}>
          <span style={{ minWidth: '18px', textAlign: 'right', fontSize: '0.95em', opacity: 0.85 }}>{num}.</span>
          <div style={{ flex: 1 }}>{parseInlineMarkdown(content, isMe)}</div>
        </div>
      );
      continue;
    }

    // Check horizontal rule: ---, ***, ___ on a line by itself
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      result.push(
        <hr 
          key={`line-${i}`} 
          style={{ 
            border: 'none', 
            borderTop: isMe ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--color-border-default)', 
            margin: '8px 0' 
          }} 
        />
      );
      continue;
    }

    // Normal line
    result.push(
      <div key={`line-${i}`} style={{ minHeight: line.trim() === '' ? '0.75em' : 'auto', wordBreak: 'break-word' }}>
        {parseInlineMarkdown(line, isMe)}
      </div>
    );
  }

  if (inCodeBlock && codeBlockLines.length > 0) {
    result.push(
      <pre
        key={`cb-${codeBlockIndex}`}
        style={{
          background: isMe ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.08)',
          padding: '8px 10px',
          borderRadius: '6px',
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
          margin: '4px 0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{result}</div>;
};

export const hasMarkdown = (text: string): boolean => {
  if (!text) return false;
  return /(`|\*\*|~~|^\s*#|^\s*>|^\s*[-*]\s+|^\s*\d+\.\s+|^\s*[-*]\s+\[[ xX]\])/m.test(text);
};

export const markdownToHtml = (text: string): string => {
  if (!text) return '';

  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  escaped = escaped.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  escaped = escaped.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  escaped = escaped.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  escaped = escaped.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  escaped = escaped.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  escaped = escaped.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
  escaped = escaped.replace(/^[-*]\s+\[ \]\s+(.*)$/gm, '<ul><li><input type="checkbox" disabled /> $1</li></ul>');
  escaped = escaped.replace(/^[-*]\s+\[[xX]\]\s+(.*)$/gm, '<ul><li><input type="checkbox" checked disabled /> $1</li></ul>');
  escaped = escaped.replace(/^[-*]\s+(.*)$/gm, '<ul><li>$1</li></ul>');
  escaped = escaped.replace(/<\/ul>\n<ul>/g, '\n');
  escaped = escaped.replace(/^(\d+)\.\s+(.*)$/gm, '<ol><li value="$1">$2</li></ol>');
  escaped = escaped.replace(/<\/ol>\n<ol>/g, '\n');
  escaped = escaped.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, '<hr />');
  escaped = escaped.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  escaped = escaped.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
  escaped = escaped.replace(/\n/g, '<br />');

  return escaped;
};
