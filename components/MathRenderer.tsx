'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MathRendererProps {
  content: string;
}

const katexOptions = {
  strict: false,
  throwOnError: false,
  macros: {
    '\\tg': '\\operatorname{tg}',
    '\\ctg': '\\operatorname{ctg}',
    '\\arctg': '\\operatorname{arctg}',
    '\\arcctg': '\\operatorname{arcctg}',
  },
};

export function MathRenderer({ content }: MathRendererProps) {
  return (
    <div className="book-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
