import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { type WorkItem } from './WorkItemList';

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55];

function VoteDistributionBar({ votes }: { votes: VoteInfo[] }) {
  const scoreCounts: Record<number, number> = {};
  FIBONACCI.forEach((n) => (scoreCounts[n] = 0));
  votes.forEach((v) => {
    if (typeof v.score === 'number' && scoreCounts.hasOwnProperty(v.score)) {
      scoreCounts[v.score]! += 1;
    }
  });
  const maxCount = Math.max(...Object.values(scoreCounts));
  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex gap-1 justify-center">
        {FIBONACCI.map((n) => (
          <div key={n} className="flex flex-col items-center mx-0.5">
            {/* Kart puanı üstte */}
            <span className="text-[11px] font-bold text-gray-700 dark:text-slate-200 mb-1 font-mono">{n}</span>
            {/* Bar ortada */}
            <div
              className="transition-all"
              style={{
                width: '22px',
                height: `${maxCount > 0 ? (scoreCounts[n]! / maxCount) * 36 + 8 : 8}px`,
                background: scoreCounts[n]! > 0 ? 'linear-gradient(180deg, #06b6d4 60%, #818cf8 100%)' : '#e5e7eb',
                borderRadius: '6px 6px 4px 4px',
                marginBottom: '2px',
                border: scoreCounts[n]! > 0 ? '1.5px solid #06b6d4' : '1.5px solid #e5e7eb',
                transition: 'height 0.2s',
              }}
              title={`${n} SP: ${scoreCounts[n]} kişi`}
            />
            {/* Kişi sayısı barın altında ve daha belirgin */}
            {scoreCounts[n]! > 0 && (
              <span className="text-[11px] text-cyan-700 dark:text-indigo-300 font-semibold mt-1">{scoreCounts[n]}</span>
            )}
          </div>
        ))}
      </div>
      {/* Info text removed as requested */}
    </div>
  );
}

interface WorkItemComment {
  id: number;
  text: string;
  createdBy: string;
  createdDate: string;
}
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

export interface SimilarItemInfo {
  url: string;
  title: string;
  storyPoints: number;
  similarity: number;
}

export interface AIEstimateResult {
  'story-point': number;
  confidence: 'high' | 'medium' | 'low';
  analysis: string;
  'similar-items': SimilarItemInfo[];
}

interface Props {
  workItem: WorkItem;
  roomCode: string;
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
  aiEstimate?: AIEstimateResult | null;
  aiLoading?: boolean;
  aiError?: string | null;
  onEstimateWithAI?: () => void;
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
  roomCode,
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
  aiEstimate,
  aiLoading,
  aiError,
  onEstimateWithAI,
}: Props) {
  const t = useTranslations('workItemDetail');
  const myVote = votes.find((v) => v.userId === userId);
    // Show VoteDistributionBar after reveal
    const showVoteDistribution = revealed && votes.length > 0;
  const votedCount = votes.filter((v) => v.hasVoted).length;

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateScore, setUpdateScore] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  // Comments state
  const [comments, setComments] = useState<WorkItemComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Fetch comments on mount
  useEffect(() => {
    async function fetchComments() {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        if (!roomCode || !workItem.id) return;
        const res = await fetch(`/api/rooms/${roomCode}/workitem/${workItem.id}/comments`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();
        setComments(data.comments ?? []);
      } catch (err: unknown) {
        setCommentsError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    }
    fetchComments();
  }, [workItem.id, roomCode]);

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
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToList')}
          </button>
        ) : (
          <div />
        )}

        {/* Moderator controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isModerator && onEstimateWithAI && (
            <button
              onClick={onEstimateWithAI}
              disabled={aiLoading}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-teal-600 via-green-600 to-cyan-600 hover:from-teal-500 hover:via-green-500 hover:to-cyan-500 dark:from-violet-600 dark:via-purple-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:via-purple-500 dark:hover:to-indigo-500 text-white border border-teal-400/30 dark:border-violet-400/30 shadow-lg shadow-teal-500/30 dark:shadow-violet-500/30 transition-all duration-200 hover:scale-105 hover:shadow-teal-500/50 dark:hover:shadow-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
            >
              {aiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  <span>{t('analyzing')}</span>
                </>
              ) : (
                <>
                  <span className="text-base leading-none">✨</span>
                  <span>{t('estimateWithAI')}</span>
                </>
              )}
            </button>
          )}
          {isModerator && !scoringActive && !revealed && (
            <button
              onClick={onStartScoring}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('startScoring')}
            </button>
          )}
          {isModerator && scoringActive && !revealed && (
            <button
              onClick={onReveal}
              disabled={votedCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {votedCount > 0 ? t('revealVotesWithCount', { count: votedCount }) : t('revealVotes')}
            </button>
          )}
          {isModerator && revealed && (
            <>
              {onUpdateWorkItem && (
                <button
                  onClick={handleOpenUpdateModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('updateWorkItem')}
                 </button>
              )}
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('resetRound')}
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
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <span className="font-mono text-gray-400 dark:text-slate-500 text-sm shrink-0 mt-0.5">#{workItem.id}</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{workItem.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-100/60 text-gray-600 border-gray-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700">
                    {workItem.workItemType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20">
                    {workItem.state}
                  </span>
                  {workItem.assignedTo && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-100/60 text-gray-500 border-gray-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700">
                      👤 {workItem.assignedTo}
                    </span>
                  )}
                  {workItem.storyPoints != null && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                      {workItem.storyPoints} SP
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">{t('sectionDescription')}</h3>
            {workItem.description ? (
              <div
                className="ado-content"
                dangerouslySetInnerHTML={{ __html: workItem.description }}
              />
            ) : (
              <p className="text-gray-400 dark:text-slate-600 text-sm italic">{t('emptyContent')}</p>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">{t('sectionAcceptanceCriteria')}</h3>
            {workItem.acceptanceCriteria ? (
              <div
                className="ado-content"
                dangerouslySetInnerHTML={{ __html: workItem.acceptanceCriteria }}
              />
            ) : (
              <p className="text-gray-400 dark:text-slate-600 text-sm italic">{t('emptyContent')}</p>
            )}
            </div>

            {/* Azure DevOps Comments */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">{t('sectionComments')}</h3>
              {commentsLoading ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm italic">{t('loadingComments')}</p>
              ) : commentsError ? (
                <p className="text-red-500 dark:text-red-400 text-sm italic">{commentsError}</p>
              ) : comments.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm italic">{t('noComments')}</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="border-b border-gray-200 dark:border-slate-700 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-cyan-700 dark:text-indigo-300">{c.createdBy}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(c.createdDate).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: c.text }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        {/* ── Right / Scoring Panel ────────────────────────────────────────── */}
        {scoringActive && (
          <div className="w-72 xl:w-80 flex flex-col gap-4 shrink-0">

            {/* Card selector – only shown before reveal */}
            {!revealed && (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
                  {myVote?.hasVoted ? t('yourVote') : t('pickScore')}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {FIBONACCI.map((n) => (
                    <button
                      key={n}
                      onClick={() => onCastVote(n)}
                      className={`h-12 rounded-lg text-sm font-bold transition-all border ${
                        myScore === n
                          ? 'bg-cyan-600 border-cyan-500 dark:bg-indigo-600 dark:border-indigo-500 text-white scale-105 shadow-lg shadow-cyan-500/20 dark:shadow-indigo-500/20'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-600 dark:hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats – shown after reveal */}

            {revealed && stats && (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">{t('sectionResults')}</p>
                {/* Vote distribution chart */}
                {showVoteDistribution && (
                  <div className="mb-3">
                    <VoteDistributionBar votes={votes} />
                  </div>
                )}
                <div className="flex gap-2 justify-center mb-2">
                  {[
                    { label: t('statAverage'), val: stats.average },
                    { label: t('statMedian'),  val: stats.median },
                    { label: t('statHighest'), val: stats.highest },
                    { label: t('statLowest'),  val: stats.lowest },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex flex-col items-center justify-center w-20 h-20 rounded-md bg-gray-100/60 border border-gray-300 dark:bg-slate-800/60 dark:border-slate-700">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1">{val}</span>
                      <span className="text-[12px] text-gray-400 dark:text-slate-500 text-center whitespace-nowrap">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI error */}
            {aiError && (
              <div className="rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 dark:text-red-400 text-xs">{aiError}</p>
              </div>
            )}

            {/* AI Estimate panel — shown only after reveal */}
            {aiEstimate && (
              <div className="rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 dark:from-violet-900/40 dark:to-indigo-900/20 dark:border-violet-500/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base leading-none">✨</span>
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-violet-300">{t('aiEstimate')}</p>
                </div>

                {/* SP Value */}
                <div className="flex items-baseline justify-center gap-1 mb-3">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{aiEstimate['story-point']}</span>
                  <span className="text-sm text-teal-700 dark:text-violet-300 font-medium">SP</span>
                </div>

                {/* Confidence Badge */}
                <div className="flex justify-center mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    aiEstimate.confidence === 'high'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                      : aiEstimate.confidence === 'medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      aiEstimate.confidence === 'high' ? 'bg-emerald-500 dark:bg-emerald-400'
                        : aiEstimate.confidence === 'medium' ? 'bg-amber-500 dark:bg-amber-400'
                          : 'bg-red-500 dark:bg-red-400'
                    }`} />
                    {t('confidence')}: {t(`confidence_${aiEstimate.confidence}`)}
                  </span>
                </div>

                {/* Analysis */}
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">{t('aiAnalysis')}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{aiEstimate.analysis}</p>
                </div>

                {/* Similar Items */}
                {aiEstimate['similar-items'].length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">{t('similarItems')}</p>
                    <ul className="space-y-1.5">
                      {aiEstimate['similar-items'].map((item, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-teal-600 hover:text-teal-500 dark:text-violet-400 dark:hover:text-violet-300 underline underline-offset-2 truncate flex-1 transition-colors"
                            title={item.title || item.url}
                          >
                            {item.title || item.url}
                          </a>
                          <span className="shrink-0 text-[10px] font-bold text-gray-500 dark:text-slate-400">
                            {item.storyPoints} SP
                          </span>
                          {item.similarity > 0 && (
                            <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              item.similarity >= 80
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : item.similarity >= 60
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              %{item.similarity}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Participant votes */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
                {votedCount > 0 ? t('votesWithCount', { voted: votedCount, total: votes.length }) : t('votes')}
              </p>
              {votes.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-xs text-center py-4">{t('noParticipants')}</p>
              ) : (
                <ul className="space-y-2">
                  {votes.map((v) => (
                    <li key={v.userId} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300 shrink-0">
                        {initials(v.displayName)}
                      </div>
                      <span className="flex-1 text-sm text-gray-700 dark:text-slate-300 truncate">{v.displayName}</span>
                      {revealed && v.score !== null ? (
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 font-bold text-sm">
                          {v.score}
                        </span>
                      ) : v.hasVoted ? (
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 border border-green-200 text-green-600 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-8 h-8 flex items-center justify-center text-gray-300 dark:text-slate-600 text-xs">…</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-gray-900 dark:text-white font-semibold text-base">{t('modalTitle')}</h3>
                <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-[18rem]">
                  #{workItem.id} · {workItem.title}
                </p>
              </div>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white transition-colors ml-3 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">{t('modalDesc')}</p>

            <div className="grid grid-cols-5 gap-2 mb-5">
              {FIBONACCI.map((n) => (
                <button
                  key={n}
                  onClick={() => setUpdateScore(n)}
                  className={`h-12 rounded-lg text-sm font-bold transition-all border ${
                    updateScore === n
                      ? 'bg-cyan-600 border-cyan-500 dark:bg-indigo-600 dark:border-indigo-500 text-white scale-105 shadow-lg shadow-cyan-500/20 dark:shadow-indigo-500/20'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-600 dark:hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {updateScore !== null && (
              <p className="text-xs text-cyan-600 dark:text-indigo-400 text-center mb-4">
                {t('modalSelected', { score: Number(updateScore) })}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleConfirmUpdate()}
                disabled={updateScore === null || updating}
                className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {updating ? t('savingToAdo') : t('saveToAdo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}