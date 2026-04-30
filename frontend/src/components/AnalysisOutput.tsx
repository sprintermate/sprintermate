'use client';

import { useEffect, useRef } from 'react';

interface AnalysisOutputProps {
  html: string;
}

/** Renders AI analysis HTML output with styled sections and sanitization. */
export default function AnalysisOutput({ html }: AnalysisOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Basic sanitization: remove script tags, event handlers
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
    containerRef.current.innerHTML = cleaned;
  }, [html]);

  return (
    <div className="analysis-output-wrapper">
      <div ref={containerRef} className="analysis-rendered" />
      <style jsx global>{`
        .analysis-rendered .analysis-output {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .analysis-rendered .analysis-section {
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 0.75rem;
          padding: 1.25rem;
          transition: border-color 0.2s;
        }

        .analysis-rendered .analysis-section:hover {
          border-color: rgba(99, 102, 241, 0.35);
        }

        .analysis-rendered .analysis-section.error {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .analysis-rendered .analysis-section h2 {
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: #c7d2fe;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .analysis-rendered .analysis-section h3 {
          font-size: 0.9rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.4rem;
          color: #a5b4fc;
        }

        .analysis-rendered .analysis-section p {
          font-size: 0.875rem;
          line-height: 1.6;
          color: #cbd5e1;
          margin-bottom: 0.5rem;
        }

        .analysis-rendered .analysis-section ul {
          list-style: none;
          padding: 0;
          margin: 0.25rem 0;
        }

        .analysis-rendered .analysis-section ul li {
          font-size: 0.85rem;
          padding: 0.35rem 0 0.35rem 1.25rem;
          position: relative;
          color: #cbd5e1;
          line-height: 1.5;
        }

        .analysis-rendered .analysis-section ul li::before {
          content: '•';
          position: absolute;
          left: 0.25rem;
          color: #818cf8;
          font-weight: bold;
        }

        .analysis-rendered .analysis-section ul.positive li::before {
          content: '✓';
          color: #34d399;
        }

        .analysis-rendered .analysis-section ul.negative li::before {
          content: '✗';
          color: #f87171;
        }

        .analysis-rendered .analysis-section ul.edge li::before {
          content: '⚡';
          color: #fbbf24;
        }

        .analysis-rendered .analysis-section .warning {
          font-size: 0.8rem;
          color: #f59e0b;
          margin-top: 0.75rem;
          font-style: italic;
        }

        .analysis-rendered .analysis-section table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
          font-size: 0.85rem;
        }

        .analysis-rendered .analysis-section table th {
          background: rgba(99, 102, 241, 0.1);
          padding: 0.5rem 0.75rem;
          text-align: left;
          font-weight: 600;
          color: #a5b4fc;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
        }

        .analysis-rendered .analysis-section table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          color: #cbd5e1;
        }

        .analysis-rendered .test-cases {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Light mode overrides */
        @media (prefers-color-scheme: light) {
          .analysis-rendered .analysis-section {
            background: rgba(99, 102, 241, 0.04);
            border-color: rgba(99, 102, 241, 0.12);
          }
          .analysis-rendered .analysis-section h2 {
            color: #4338ca;
          }
          .analysis-rendered .analysis-section h3 {
            color: #4f46e5;
          }
          .analysis-rendered .analysis-section p,
          .analysis-rendered .analysis-section ul li {
            color: #334155;
          }
          .analysis-rendered .analysis-section table th {
            color: #4338ca;
          }
          .analysis-rendered .analysis-section table td {
            color: #334155;
          }
        }

        /* Tailwind dark class overrides for light mode */
        :root:not(.dark) .analysis-rendered .analysis-section {
          background: rgba(99, 102, 241, 0.04);
          border-color: rgba(99, 102, 241, 0.12);
        }
        :root:not(.dark) .analysis-rendered .analysis-section h2 {
          color: #4338ca;
        }
        :root:not(.dark) .analysis-rendered .analysis-section h3 {
          color: #4f46e5;
        }
        :root:not(.dark) .analysis-rendered .analysis-section p,
        :root:not(.dark) .analysis-rendered .analysis-section ul li,
        :root:not(.dark) .analysis-rendered .analysis-section table td {
          color: #334155;
        }
        :root:not(.dark) .analysis-rendered .analysis-section table th {
          color: #4338ca;
          background: rgba(99, 102, 241, 0.06);
        }
      `}</style>
    </div>
  );
}
