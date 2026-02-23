'use client';

import { useState } from 'react';
import { type WorkItem } from './WorkItemList';

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55];

export interface VoteInfo {
  userId: string;
  displayName: string;
  hasVoted: boolean;
  score: number | null;
}

export interface VoteStats {
  average: number;
  median: number;
  highest: number;
  lowest: number;
}

interface Props {
  workItem: WorkItem;
  isModerator: boolean;
  userId: string;
  scoringActive: boolean;
  revealed: boolean;
  votes: VoteInfo[];
  stats: VoteStats | null;
  myScore: number | null;
  onStartScoring: () => void;
  onCastVote: (score: number) => void;
  onReveal: () => void;
  onReset: () => void;
  onBack: () => void;
  onUpdateWorkItem?: (score: number) => void;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function WorkItemDetail({
  workItem,
  isModerator,
  userId,
  scoringActive,
  revealed,
  votes,
  stats,
  myScore,
  onStartScoring,
  onCastVote,
  onReveal,
  onReset,
  onBack,
  onUpdateWorkItem,
}: Props) {
  const myVote = votes.find((v) => v.userId === userId);
  const votedCount = votes.filter((v) => v.hasVoted).length;

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateScore, setUpdateScore] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  function handleOpenUpdateModal() {
    setUpdateScore(null);
    setShowUpdateModal(true);
  }

  async function handleConfirmUpdate() {
    if (updateScore === null || !onUpdateWorkItem) return;
    setUpdating(true);
    try {
      await onUpdateWorkItem(updateScore);
      setShowUpdateModal(false);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex flex-col gap-0 flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        {isModerator ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to list
          </button>
        ) : (
          <div />
        )}

        {/* Moderator controls */}
        <div className="flex items-center gap-2">
          {isModerator && !scoringActive && !revealed && (
            <button
              onClick={onStartScoring}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Scoring
            </button>
          )}
          {isModerator && scoringActive && !revealed && (
            <button
              onClick={onReveal}
              disabled={votedCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Reveal Votes{votedCount > 0 ? ` (${votedCount})` : ''}
            </button>
          )}
          {isModerator && revealed && (
            <>
              {onUpdateWorkItem && (
                <button
                  onClick={handleOpenUpdateModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Update Work Item
                </button>
              )}
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Round
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main: left detail + optional right scoring panel */}
      <div className={`flex gap-6 flex-1 min-h-0 ${scoringActive ? 'flex-row' : 'flex-col'}`}>

        {/* ── Left / Detail ────────────────────────────────────────────────── */}
        <div className={`flex flex-col gap-5 overflow-y-auto min-h-0 ${scoringActive ? 'flex-1' : 'w-full'}`}>

          {/* Header */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <span className="font-mono text-slate-500 text-sm shrink-0 mt-0.5">#{workItem.id}</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white leading-snug">{workItem.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-slate-800/60 text-slate-300 border-slate-700">
                    {workItem.workItemType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/10 text-blue-300 border-blue-500/20">
                    {workItem.state}
                  </span>
                  {workItem.assignedTo && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-slate-800/60 text-slate-400 border-slate-700">
                      👤 {workItem.assignedTo}
                    </span>
                  )}
                  {workItem.storyPoints != null && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                      {workItem.storyPoints} SP
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Description</h3>
            {workItem.description ? (
              <div
                className="ado-content"
                dangerouslySetInnerHTML={{ __html: workItem.description }}
              />
            ) : (
              <p className="text-slate-600 text-sm italic">Please give some content before planning.</p>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Acceptance Criteria</h3>
            {workItem.acceptanceCriteria ? (
              <div
                className="ado-content"
                dangerouslySetInnerHTML={{ __html: workItem.acceptanceCriteria }}
              />
            ) : (
              <p className="text-slate-600 text-sm italic">Please give some content before planning.</p>
            )}
          </div>
        </div>

        {/* ── Right / Scoring Panel ────────────────────────────────────────── */}
        {scoringActive && (
          <div className="w-72 xl:w-80 flex flex-col gap-4 shrink-0">

            {/* Card selector – only shown before reveal */}
            {!revealed && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  {myVote?.hasVoted ? 'Your vote ✓' : 'Pick your score'}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {FIBONACCI.map((n) => (
                    <button
                      key={n}
                      onClick={() => onCastVote(n)}
                      className={`h-12 rounded-lg text-sm font-bold transition-all border ${
                        myScore === n
                          ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-lg shadow-indigo-500/20'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {myScore !== null && (
                  <p className="text-xs text-indigo-400 mt-2 text-center">You selected <strong>{myScore}</strong></p>
                )}
              </div>
            )}

            {/* Stats – shown after reveal */}
            {revealed && stats && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Results</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Average', val: stats.average },
                    { label: 'Median',  val: stats.median },
                    { label: 'Highest', val: stats.highest },
                    { label: 'Lowest',  val: stats.lowest },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-center">
                      <div className="text-xl font-bold text-white">{val}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participant votes */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Votes {votedCount > 0 && <span className="text-indigo-400">({votedCount}/{votes.length})</span>}
              </p>
              {votes.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-4">No participants yet</p>
              ) : (
                <ul className="space-y-2">
                  {votes.map((v) => (
                    <li key={v.userId} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {initials(v.displayName)}
                      </div>
                      <span className="flex-1 text-sm text-slate-300 truncate">{v.displayName}</span>
                      {revealed && v.score !== null ? (
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm">
                          {v.score}
                        </span>
                      ) : v.hasVoted ? (
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-8 h-8 flex items-center justify-center text-slate-600 text-xs">…</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Update Work Item Modal ── */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-base">Update Work Item</h3>
                <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[18rem]">
                  #{workItem.id} · {workItem.title}
                </p>
              </div>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-slate-500 hover:text-white transition-colors ml-3 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">Select the final story points to save to Azure DevOps:</p>

            <div className="grid grid-cols-5 gap-2 mb-5">
              {FIBONACCI.map((n) => (
                <button
                  key={n}
                  onClick={() => setUpdateScore(n)}
                  className={`h-12 rounded-lg text-sm font-bold transition-all border ${
                    updateScore === n
                      ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {updateScore !== null && (
              <p className="text-xs text-indigo-400 text-center mb-4">
                Selected: <strong>{updateScore}</strong> story points
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmUpdate()}
                disabled={updateScore === null || updating}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {updating ? 'Saving…' : 'Save to Azure DevOps'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
