import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  // 1. Check for multiline code blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const preText = content.substring(lastIndex, match.index);
    if (preText) {
      parts.push(<span key={`text-${lastIndex}`}>{renderInlineMarkdown(preText)}</span>);
    }

    const language = match[1] || 'plaintext';
    const code = match[2];
    const blockIndex = match.index;

    parts.push(
      <CodeBlock key={`code-${blockIndex}`} language={language} code={code} />
    );

    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) {
    parts.push(<span key={`text-${lastIndex}`}>{renderInlineMarkdown(remainingText)}</span>);
  }

  return <div className="space-y-2 select-text">{parts}</div>;
};

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-xl bg-[#07090D] border border-gdisc-bg-hover/80 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gdisc-bg-card/90 border-b border-gdisc-bg-hover/60 text-gdisc-text-muted text-[11px]">
        <span className="uppercase font-semibold tracking-wider">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-gdisc-text-primary transition-colors p-1 rounded"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-gdisc-success" />
              <span className="text-gdisc-success font-semibold">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-gdisc-text-primary leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to split by inline code, bold, italic, and URLs
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+)/g);

  return tokens.map((token, index) => {
    if (!token) return null;

    // Inline Code
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-gdisc-bg-hover/80 text-gdisc-brand-secondary font-mono text-[13px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // Bold
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={index} className="font-bold text-gdisc-text-primary">
          {token.slice(2, -2)}
        </strong>
      );
    }

    // Italic
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    // URL Links
    if (token.startsWith('http://') || token.startsWith('https://')) {
      return (
        <a
          key={index}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gdisc-brand-secondary hover:underline break-all"
        >
          {token}
        </a>
      );
    }

    return token;
  });
}
