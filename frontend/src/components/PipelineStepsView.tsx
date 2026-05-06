'use client';

import { useState } from 'react';
import AnalysisMDOutput from './AnalysisMDOutput';

export interface PipelineStep {
  step: number;
  title: string;
  status: 'waiting' | 'running' | 'done' | 'error';
  output?: string;
  errorMessage?: string;
}

interface Props {
  steps: PipelineStep[];
  completed?: boolean;
  filename?: string;
}

const STEP_ICONS = ['📄', '🗄️', '📋'] as const;

function StepStatusIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'running') {
    return (
      <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
    );
  }
  if (status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // waiting
  return (
    <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center flex-shrink-0">
      <div className="w-2 h-2 rounded-full bg-slate-600" />
    </div>
  );
}

export default function PipelineStepsView({ steps, completed = false, filename = 'analysis' }: Props) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2 w-full">
      {/* Completion banner */}
      {completed && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-medium text-emerald-300">Analiz tamamlandı!</span>
        </div>
      )}

      {/* Step cards */}
      {steps.map((s, idx) => {
        const isExpanded = expandedSteps.has(s.step);
        const canExpand = s.status === 'done' && s.output;
        const icon = STEP_ICONS[idx] ?? '📌';

        return (
          <div
            key={s.step}
            className={`rounded-xl border transition-all ${
              s.status === 'running'
                ? 'border-violet-500/40 bg-violet-500/5'
                : s.status === 'done'
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : s.status === 'error'
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            {/* Step header */}
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                canExpand ? 'cursor-pointer hover:bg-white/[0.03]' : 'cursor-default'
              }`}
              onClick={() => canExpand && toggleStep(s.step)}
              disabled={!canExpand}
            >
              {/* Step number badge */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  s.status === 'done'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : s.status === 'running'
                    ? 'bg-violet-500/20 text-violet-300'
                    : s.status === 'error'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-white/[0.04] text-slate-500'
                }`}
              >
                {s.step}
              </div>

              {/* Icon + Title */}
              <span className="text-base mr-1">{icon}</span>
              <span
                className={`flex-1 text-sm font-medium ${
                  s.status === 'done'
                    ? 'text-slate-200'
                    : s.status === 'running'
                    ? 'text-violet-300'
                    : s.status === 'error'
                    ? 'text-red-300'
                    : 'text-slate-500'
                }`}
              >
                {s.title}
              </span>

              {/* Status label */}
              <span
                className={`text-xs flex-shrink-0 ${
                  s.status === 'running'
                    ? 'text-violet-400'
                    : s.status === 'done'
                    ? 'text-emerald-400'
                    : s.status === 'error'
                    ? 'text-red-400'
                    : 'text-slate-600'
                }`}
              >
                {s.status === 'running'
                  ? 'Çalışıyor…'
                  : s.status === 'done'
                  ? 'Tamamlandı'
                  : s.status === 'error'
                  ? 'Hata'
                  : 'Bekliyor'}
              </span>

              {/* Status icon */}
              <StepStatusIcon status={s.status} />

              {/* Chevron (only when expandable) */}
              {canExpand && (
                <svg
                  className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Error message */}
            {s.status === 'error' && s.errorMessage && (
              <div className="px-4 pb-3 text-xs text-red-400">{s.errorMessage}</div>
            )}

            {/* Expanded step output */}
            {isExpanded && s.output && (
              <div className="border-t border-white/[0.06] px-4 py-4">
                <AnalysisMDOutput
                  markdown={s.output}
                  filename={`${filename}-step${s.step}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
