import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const JS_RULES = [
  { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
  { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g },
  { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|class|extends|new|this|typeof|instanceof|try|catch|finally|throw|async|await|yield|true|false|null|undefined)\b/g },
  { type: 'built-in', regex: /\b(console|window|document|Promise|Object|Array|String|Number|Boolean|Function|Error|JSON)\b/g },
  { type: 'number', regex: /\b\d+(?:\.\d+)?\b/g },
];

const PY_RULES = [
  { type: 'comment', regex: /#[^\n]*/g },
  { type: 'string', regex: /"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3}|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
  { type: 'decorator', regex: /@\w+/g },
  { type: 'keyword', regex: /\b(def|class|return|if|elif|else|for|while|break|continue|import|from|as|in|is|not|and|or|try|except|finally|raise|assert|pass|lambda|with|yield|global|nonlocal|True|False|None)\b/g },
  { type: 'number', regex: /\b\d+(?:\.\d+)?\b/g },
];

const C_RULES = [
  { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
  { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
  { type: 'preprocessor', regex: /^\s*#(?:include|define|undef|ifdef|ifndef|if|else|elif|endif)\b/gm },
  { type: 'keyword', regex: /\b(int|char|float|double|void|struct|union|enum|typedef|const|static|extern|register|volatile|auto|sizeof|if|else|for|while|do|switch|case|default|break|continue|return|goto)\b/g },
  { type: 'number', regex: /\b\d+(?:\.\d+)?\b/g },
];

const HTML_RULES = [
  { type: 'comment', regex: /<!--[\s\S]*?-->/g },
  { type: 'tag', regex: /<\/?[a-zA-Z0-9:-]+(?:\s[^>]*)?>/g },
];

const tokenize = (code: string, rules: { type: string; regex: RegExp }[]) => {
  let tokens: { type: string; value: string }[] = [{ type: 'text', value: code }];

  rules.forEach(rule => {
    let nextTokens: { type: string; value: string }[] = [];
    
    tokens.forEach(token => {
      if (token.type !== 'text') {
        nextTokens.push(token);
        return;
      }

      let lastIndex = 0;
      rule.regex.lastIndex = 0;
      const matches = [...token.value.matchAll(rule.regex)];

      matches.forEach(match => {
        const full = match[0];
        const matchIndex = match.index!;

        if (matchIndex > lastIndex) {
          nextTokens.push({ type: 'text', value: token.value.substring(lastIndex, matchIndex) });
        }

        nextTokens.push({ type: rule.type, value: full });
        lastIndex = matchIndex + full.length;
      });

      if (lastIndex < token.value.length) {
        nextTokens.push({ type: 'text', value: token.value.substring(lastIndex) });
      }
    });

    tokens = nextTokens;
  });

  return tokens;
};

const renderHtmlTag = (tag: string) => {
  const tagRegex = /^(<\/?)([a-zA-Z0-9:-]+)([\s\S]*?)(>?)$/;
  const match = tag.match(tagRegex);
  if (!match) return <span style={{ color: '#8ec07c' }}>{tag}</span>;

  const [_, openBracket, tagName, attrs, closeBracket] = match;
  
  const attrRegex = /(\s[a-zA-Z0-9:-]+=)(?:"([^"]*)"|'([^']*)')|(\s[a-zA-Z0-9:-]+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  const attrMatches = [...attrs.matchAll(attrRegex)];

  attrMatches.forEach((attrMatch, idx) => {
    const full = attrMatch[0];
    const matchIndex = attrMatch.index!;

    if (matchIndex > lastIndex) {
      elements.push(attrs.substring(lastIndex, matchIndex));
    }

    if (attrMatch[1]) {
      const attrName = attrMatch[1];
      const attrVal = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
      elements.push(
        <span key={`attr-${idx}`}>
          <span style={{ color: '#fabd2f' }}>{attrName}</span>
          <span style={{ color: '#b8bb26' }}>"{attrVal}"</span>
        </span>
      );
    } else if (attrMatch[4]) {
      elements.push(
        <span key={`attr-${idx}`} style={{ color: '#fabd2f' }}>
          {attrMatch[4]}
        </span>
      );
    }

    lastIndex = matchIndex + full.length;
  });

  if (lastIndex < attrs.length) {
    elements.push(attrs.substring(lastIndex));
  }

  return (
    <span style={{ color: '#8ec07c' }}>
      {openBracket}
      <span style={{ color: '#fe8019', fontWeight: 600 }}>{tagName}</span>
      {elements}
      {closeBracket}
    </span>
  );
};

const CodeBlock: React.FC<{ code: string; language?: string; isMe: boolean }> = ({ code, language, isMe }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const getTokens = () => {
    const lang = language?.toLowerCase();
    if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') {
      return tokenize(code, JS_RULES);
    }
    if (lang === 'py' || lang === 'python') {
      return tokenize(code, PY_RULES);
    }
    if (lang === 'c' || lang === 'cpp') {
      return tokenize(code, C_RULES);
    }
    if (lang === 'html' || lang === 'xml') {
      return tokenize(code, HTML_RULES);
    }
    return [{ type: 'text', value: code }];
  };

  const renderToken = (token: { type: string; value: string }, idx: number) => {
    const lang = language?.toLowerCase();
    if (token.type === 'text') {
      return token.value;
    }
    if (token.type === 'tag' && (lang === 'html' || lang === 'xml')) {
      return <span key={idx}>{renderHtmlTag(token.value)}</span>;
    }

    let color = '#d4d4d4';
    let fontWeight = 'normal';

    switch (token.type) {
      case 'comment':
        color = '#7c6f64';
        break;
      case 'string':
        color = '#b8bb26';
        break;
      case 'keyword':
        color = '#fb4934';
        fontWeight = 'bold';
        break;
      case 'built-in':
        color = '#83a598';
        break;
      case 'number':
        color = '#d3869b';
        break;
      case 'decorator':
        color = '#fabd2f';
        break;
      case 'preprocessor':
        color = '#8ec07c';
        fontWeight = 'bold';
        break;
    }

    return (
      <span key={idx} style={{ color, fontWeight }}>
        {token.value}
      </span>
    );
  };

  const tokens = getTokens();

  return (
    <div style={{ position: 'relative', width: '100%', margin: '8px 0' }}>
      <pre
        style={{
          background: '#000000',
          color: '#d4d4d4',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          paddingRight: '40px',
          lineHeight: 1.5
        }}
      >
        <code>{tokens.map((token, idx) => renderToken(token, idx))}</code>
      </pre>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          opacity: 0.6,
          transition: 'opacity 0.2s, background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        title="코드 복사"
      >
        {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

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
  let currentLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const codeBlockStartMatch = line.match(/^```([a-zA-Z0-9+#-]*)\s*$/);
    if (codeBlockStartMatch) {
      if (inCodeBlock) {
        // End code block
        result.push(
          <CodeBlock
            key={`cb-${codeBlockIndex++}`}
            code={codeBlockLines.join('\n')}
            language={currentLanguage}
            isMe={isMe}
          />
        );
        codeBlockLines = [];
        inCodeBlock = false;
        currentLanguage = '';
      } else {
        inCodeBlock = true;
        currentLanguage = codeBlockStartMatch[1];
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
      <CodeBlock
        key={`cb-${codeBlockIndex}`}
        code={codeBlockLines.join('\n')}
        language={currentLanguage}
        isMe={isMe}
      />
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
