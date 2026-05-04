'use client';

import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  markdown: string;
  filename?: string;
}

export default function AnalysisMDOutput({ markdown, filename = 'analysis' }: Props) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [markdown, filename]);

  return (
    <div className="relative group">
      {/* Download button */}
      <button
        onClick={handleDownload}
        title="Download as .md"
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-violet-500
          text-xs font-medium transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        .md
      </button>

      {/* Markdown content */}
      <div className="prose prose-invert prose-sm max-w-none analysis-md-output">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-base font-bold text-white mt-5 mb-2 first:mt-0 flex items-center gap-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-sm font-semibold text-violet-300 mt-4 mb-1.5">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-3 mb-1">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-slate-300 leading-relaxed mb-2">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="my-1.5 ml-4 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-1.5 ml-4 space-y-1 list-decimal">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-slate-300 list-disc marker:text-violet-500">{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-amber-500 pl-3 my-2 text-xs text-amber-300/80 italic">
                {children}
              </blockquote>
            ),
            hr: () => (
              <hr className="border-slate-700 my-4" />
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              return isBlock ? (
                <code className="block bg-slate-900 rounded-lg p-3 text-xs text-emerald-300 font-mono overflow-x-auto my-2">
                  {children}
                </code>
              ) : (
                <code className="bg-slate-800 rounded px-1 py-0.5 text-xs text-emerald-300 font-mono">
                  {children}
                </code>
              );
            },
            strong: ({ children }) => (
              <strong className="font-semibold text-white">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-slate-400">{children}</em>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-3">
                <table className="w-full text-xs border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="bg-indigo-900/40 border border-slate-700 px-3 py-1.5 text-left text-xs font-semibold text-indigo-300">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-slate-800 px-3 py-1.5 text-xs text-slate-300">{children}</td>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
