'use client';

import { useEffect, useState, useCallback } from 'react';

interface SprintMetricsClientProps {
  projectId: string;
  sprintId: string;
  sprintName?: string;
  locale: string;
}

interface SprintMetrics {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  health: {
    score: number;
    completionRate: number;
    velocity: number;
    scopeChange: number;
    riskLevel: 'low' | 'medium' | 'high';
    bugCount: number;
    bugTrend: 'increasing' | 'stable' | 'decreasing';
  };
  workItems: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    removed: number;
    byType: Record<string, number>;
    byState: Record<string, number>;
    byTypePercentage: Record<string, number>;
  };
  velocity: {
    planned: number;
    completed: number;
    carried: number;
  };
  flow: {
    avgCycleTime: number;
    avgLeadTime: number;
    avgBlockedTime: number;
    wipCount: number;
    flowEfficiency: number;
  };
  bugs: {
    total: number;
    active: number;
    resolved: number;
    closed: number;
  };
  stateMetrics: {
    avgTimeInState: Record<string, number>;
    stateTransitions: Record<string, number>;
  };
}

interface SprintTrend {
  sprintId: string;
  sprintName: string;
  velocity: number;
  completionRate: number;
  scopeChange: number;
  bugCount: number;
  carryOver: number;
  startDate: string;
}

interface SprintInsights {
  summary: string;
  risks: string[];
  recommendations: string[];
  strengths: string[];
  analysis: {
    velocityTrend: string;
    qualityTrend: string;
    flowHealth: string;
    teamCapacity: string;
  };
}

interface ScoreRecord {
  work_item_id: number;
  ai_score: number;
  user_avg_score: number;
}

const DEV_DONE_OR_LATER_STATES = [
  'Development Done', 'Test', 'in UAT', 'UAT', 'Done', 'Closed', 'Resolved', 'Completed',
];

export default function SprintMetricsClient({
  projectId,
  sprintId,
  locale,
}: SprintMetricsClientProps) {
  const [metrics, setMetrics] = useState<SprintMetrics | null>(null);
  const [trends, setTrends] = useState<SprintTrend[]>([]);
  const [insights, setInsights] = useState<SprintInsights | null>(null);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Velocity & Capacity inputs
  const [teamSize, setTeamSize] = useState(3);
  const [sprintDays, setSprintDays] = useState(10);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsRes, trendsRes, scoreRes] = await Promise.all([
        fetch(`${BACKEND}/api/metrics/projects/${projectId}/sprints/${sprintId}`, { credentials: 'include' }),
        fetch(`${BACKEND}/api/metrics/projects/${projectId}/trends?limit=6`, { credentials: 'include' }),
        fetch(`${BACKEND}/api/metrics/projects/${projectId}/sprints/${sprintId}/score-records`, { credentials: 'include' }),
      ]);

      if (!metricsRes.ok) throw new Error('Failed to fetch sprint metrics');

      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (scoreRes.ok) setScoreRecords(await scoreRes.json());
    } catch (err) {
      setError((err as Error).message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId, BACKEND]);

  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      const res = await fetch(
        `${BACKEND}/api/metrics/projects/${projectId}/sprints/${sprintId}/insights`,
        { method: 'POST', credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to generate insights');
      setInsights(await res.json());
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, [projectId, sprintId, BACKEND]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">Loading sprint metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">Error Loading Metrics</h3>
          <p className="text-red-700 dark:text-red-400">{error || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  const healthScoreColor =
    metrics.health.score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
    : metrics.health.score >= 50 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  const riskColors = {
    low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  // Overall Completion Rate (Development Done or later)
  const devDoneOrLaterCount = DEV_DONE_OR_LATER_STATES.reduce(
    (acc, s) => acc + (metrics.workItems.byState[s] ?? 0), 0
  );
  const devDoneOrLaterRate = metrics.workItems.total > 0
    ? Math.round((devDoneOrLaterCount / metrics.workItems.total) * 100)
    : 0;

  // Velocity & Capacity
  const capacity = teamSize * sprintDays;
  const utilizationRate = capacity > 0
    ? Math.min(Math.round((metrics.velocity.completed / capacity) * 100), 999)
    : 0;
  const avgVelocityLast3 = trends.length > 0
    ? Math.round(trends.slice(0, 3).reduce((s, t) => s + t.velocity, 0) / Math.min(trends.length, 3))
    : metrics.velocity.completed;

  // AI vs Team stats
  const n = scoreRecords.length;
  const avgAI = n > 0 ? scoreRecords.reduce((s, r) => s + r.ai_score, 0) / n : 0;
  const avgUser = n > 0 ? scoreRecords.reduce((s, r) => s + r.user_avg_score, 0) / n : 0;
  const stdDev = n > 0
    ? Math.sqrt(scoreRecords.reduce((s, r) => s + (r.ai_score - r.user_avg_score) ** 2, 0) / n)
    : 0;

  return (
    <div className="space-y-6">
      {/* Sprint Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{metrics.sprintName}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {new Date(metrics.startDate).toLocaleDateString(locale)} —{' '}
              {new Date(metrics.endDate).toLocaleDateString(locale)}
            </p>
          </div>
          <button
            onClick={fetchInsights}
            disabled={insightsLoading}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {insightsLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <><span>🤖</span> AI Insights</>
            )}
          </button>
        </div>
      </div>

      {/* Executive Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Health Score" value={metrics.health.score} suffix="/100" icon="🎯" color={healthScoreColor} trend={metrics.health.score >= 70 ? 'up' : metrics.health.score >= 50 ? 'neutral' : 'down'} />
        <MetricCard title="Completion Rate" value={metrics.health.completionRate.toFixed(1)} suffix="%" icon="📊" color="text-blue-600 dark:text-blue-400" trend={metrics.health.completionRate >= 75 ? 'up' : 'neutral'} />
        <MetricCard title="Velocity" value={metrics.velocity.completed} suffix={` / ${metrics.velocity.planned} pts`} icon="⚡" color="text-indigo-600 dark:text-indigo-400" />
        <MetricCard title="Risk Level" value={metrics.health.riskLevel.toUpperCase()} icon="❗" badge={true} badgeColor={riskColors[metrics.health.riskLevel]} />
      </div>

      {/* AI Insights Panel */}
      {insights && (
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-2xl shadow-sm border border-violet-200/60 dark:border-violet-800/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Insights</h2>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/40 rounded-xl p-4 mb-4 backdrop-blur-sm">
            <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{insights.summary}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.strengths.length > 0 && <InsightBox title="✅ Strengths" items={insights.strengths} color="emerald" />}
            {insights.risks.length > 0 && <InsightBox title="🔥 Risks" items={insights.risks} color="red" />}
            {insights.recommendations.length > 0 && <InsightBox title="💡 Recommendations" items={insights.recommendations} color="blue" />}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnalysisCard title="Velocity Trend" content={insights.analysis.velocityTrend} />
            <AnalysisCard title="Quality Trend" content={insights.analysis.qualityTrend} />
            <AnalysisCard title="Flow Health" content={insights.analysis.flowHealth} />
            <AnalysisCard title="Team Capacity" content={insights.analysis.teamCapacity} />
          </div>
        </div>
      )}

      {/* Trend Charts */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">📈 Sprint Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart title="Velocity Trend" data={trends} dataKey="velocity" color="indigo" />
            <TrendChart title="Completion Rate" data={trends} dataKey="completionRate" color="blue" suffix="%" />
          </div>
        </div>
      )}

      {/* Overall Completion Rate */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">🎯 Genel Tamamlanma Oranı</h2>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <DonutChart rate={devDoneOrLaterRate} />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Sprintteki iş maddelerinin <span className="font-semibold text-gray-900 dark:text-white">Development Done</span> ve sonraki aşamalara geçiş oranı
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Development Done+</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{devDoneOrLaterCount} madde</div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Toplam</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{metrics.workItems.total} madde</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Velocity & Capacity Analysis */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">2️⃣ Velocity & Kapasite Analizi</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Takım üretkenliği ve kapasite kullanımı</p>

        {/* Inputs */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">Kişi Sayısı:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={teamSize}
              onChange={e => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">Sprint Günü (kişi başı):</label>
            <input
              type="number"
              min={1}
              max={30}
              value={sprintDays}
              onChange={e => setSprintDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <VelocityCard label="Planlanan SP" value={metrics.velocity.planned} color="blue" />
            <VelocityCard label="Gerçekleşen SP" value={metrics.velocity.completed} color="emerald" />
            <VelocityCard label="Carry Over SP" value={metrics.velocity.carried} color="yellow" />
            <VelocityCard label="Ort. Velocity (son 3)" value={avgVelocityLast3} color="indigo" />
            <VelocityCard label="Kapasite (kişi × gün)" value={capacity} color="purple" />
            <VelocityCard label="Kapasite Kullanımı" value={utilizationRate} suffix="%" color={utilizationRate > 100 ? 'red' : utilizationRate > 80 ? 'emerald' : 'gray'} />
          </div>

          {/* Gauge chart */}
          <GaugeChart value={utilizationRate} label="Kapasite Kullanım Oranı" />
        </div>
      </div>

      {/* AI vs Team Score Comparison */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">✨ AI Tahmini vs Takım Oylaması</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Azure DevOps&apos;a kaydedilen iş maddelerinde AI ve kullanıcı skorları karşılaştırması</p>

        {n === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-slate-400">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="font-medium">Henüz kayıtlı oylama skoru yok</p>
              <p className="text-sm mt-1">AI tahmini olan iş maddelerini Azure DevOps&apos;a kaydedin</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 text-center">
                <div className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wider mb-1">Ort. AI Skoru</div>
                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{avgAI.toFixed(1)}</div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-center">
                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider mb-1">Ort. Kullanıcı Skoru</div>
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{avgUser.toFixed(1)}</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-center">
                <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider mb-1">Standart Sapma</div>
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stdDev.toFixed(2)}</div>
              </div>
            </div>

            {/* Bar chart */}
            <ScoreComparisonChart records={scoreRecords} />

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-violet-500"></div>
                <span className="text-gray-600 dark:text-slate-400">AI Tahmini</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                <span className="text-gray-600 dark:text-slate-400">Kullanıcı Seçimi</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Work Items by Type */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 Work Items by Type</h3>
        <div className="space-y-3">
          {Object.entries(metrics.workItems.byTypePercentage)
            .sort((a, b) => b[1] - a[1])
            .map(([type, percentage]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{type}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {percentage.toFixed(1)}% ({metrics.workItems.byType[type]})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Flow & Cycle Time Metrics */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">⏱️ Flow & Cycle Time Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <FlowMetricCard title="Avg Cycle Time" value={metrics.flow.avgCycleTime.toFixed(1)} suffix=" days" description="Active → Done" />
          <FlowMetricCard title="Avg Lead Time" value={metrics.flow.avgLeadTime.toFixed(1)} suffix=" days" description="Created → Done" />
          <FlowMetricCard
            title="Dev → Dev Done"
            value={(metrics.stateMetrics.avgTimeInState['Development'] ?? 0).toFixed(1)}
            suffix=" gün"
            description="Geçiş süresi"
            highlight
          />
          <FlowMetricCard
            title="Dev Done → Test"
            value={(metrics.stateMetrics.avgTimeInState['Development Done'] ?? 0).toFixed(1)}
            suffix=" gün"
            description="Geçiş süresi"
            highlight
          />
          <FlowMetricCard
            title="Test → in UAT"
            value={(metrics.stateMetrics.avgTimeInState['Test'] ?? 0).toFixed(1)}
            suffix=" gün"
            description="Geçiş süresi"
            highlight
          />
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function MetricCard({
  title, value, suffix, icon, color, trend, badge, badgeColor,
}: {
  title: string; value: number | string; suffix?: string; icon: string;
  color?: string; trend?: 'up' | 'down' | 'neutral'; badge?: boolean; badgeColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-slate-400">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      {badge ? (
        <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${badgeColor}`}>{value}</div>
      ) : (
        <div className={`text-3xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>
          {value}
          {suffix && <span className="text-lg text-gray-500 dark:text-slate-400">{suffix}</span>}
        </div>
      )}
      {trend && (
        <div className="mt-2">
          {trend === 'up' && <span className="text-xs text-emerald-600 dark:text-emerald-400">↗ Trending up</span>}
          {trend === 'down' && <span className="text-xs text-red-600 dark:text-red-400">↘ Needs attention</span>}
          {trend === 'neutral' && <span className="text-xs text-gray-500 dark:text-slate-500">→ Stable</span>}
        </div>
      )}
    </div>
  );
}

function InsightBox({ title, items, color }: { title: string; items: string[]; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
        {items.map((item, i) => <li key={i} className="leading-snug">• {item}</li>)}
      </ul>
    </div>
  );
}

function AnalysisCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-white/40 dark:bg-slate-900/40 rounded-lg border border-violet-200/40 dark:border-violet-800/40 p-4 backdrop-blur-sm">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{content}</p>
    </div>
  );
}

function TrendChart({ title, data, dataKey, color, suffix = '' }: {
  title: string; data: SprintTrend[]; dataKey: keyof SprintTrend; color: string; suffix?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'stroke-indigo-600 dark:stroke-indigo-400',
    blue: 'stroke-blue-600 dark:stroke-blue-400',
  };
  const max = Math.max(...data.map(d => Number(d[dataKey]) || 0));
  const min = Math.min(...data.map(d => Number(d[dataKey]) || 0));
  const range = max - min || 1;

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 400 180">
          <polyline
            fill="none" stroke="currentColor" strokeWidth="3"
            className={colors[color]}
            points={data.map((d, i) => {
              const x = (i / (data.length - 1 || 1)) * 380 + 10;
              const value = Number(d[dataKey]) || 0;
              const y = 170 - ((value - min) / range) * 160;
              return `${x},${y}`;
            }).join(' ')}
          />
          {data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 380 + 10;
            const value = Number(d[dataKey]) || 0;
            const y = 170 - ((value - min) / range) * 160;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="currentColor" className={colors[color]} />
                <text x={x} y="175" fontSize="10" fill="currentColor" className="text-gray-600 dark:text-slate-400" textAnchor="middle">S{data.length - i}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 text-sm text-gray-600 dark:text-slate-400 text-center">
        Latest: <span className="font-semibold">{data[data.length - 1]?.[dataKey]}{suffix}</span>
      </div>
    </div>
  );
}

function FlowMetricCard({ title, value, suffix, description, highlight }: {
  title: string; value: number | string; suffix?: string; description: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
      <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
        {value}
        {suffix && <span className="text-sm text-gray-500 dark:text-slate-400">{suffix}</span>}
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{description}</div>
    </div>
  );
}

function DonutChart({ rate }: { rate: number }) {
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  const filled = (rate / 100) * circumference;

  return (
    <div className="flex flex-col items-center shrink-0">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="18" className="text-gray-200 dark:text-slate-700" />
        {/* Progress circle */}
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="18"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          className="text-emerald-500 dark:text-emerald-400"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="bold" fill="currentColor" className="text-gray-900 dark:text-white" style={{ fill: 'var(--tw-text-opacity, 1)' }}>
          {rate}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="currentColor" className="text-gray-500 dark:text-slate-400">
          tamamlandı
        </text>
      </svg>
    </div>
  );
}

function GaugeChart({ value, label }: { value: number; label: string }) {
  const capped = Math.min(value, 150);
  const percent = capped / 150;
  const startAngle = -180;
  const endAngle = 0;
  const angle = startAngle + percent * (endAngle - startAngle);

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cx = 100;
  const cy = 100;
  const r = 70;

  const arcPath = (start: number, end: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)), y: cy + r * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needleX = cx + (r - 10) * Math.cos(toRad(angle));
  const needleY = cy + (r - 10) * Math.sin(toRad(angle));

  const color = value > 100 ? '#ef4444' : value > 80 ? '#10b981' : '#6366f1';

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        {/* Background arc */}
        <path d={arcPath(-180, 0)} fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" className="dark:stroke-slate-700" />
        {/* Green zone 0-80% */}
        <path d={arcPath(-180, -180 + 0.8 * 180)} fill="none" stroke="#10b981" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
        {/* Red zone 100-150% */}
        <path d={arcPath(-180 + (100 / 150) * 180, 0)} fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
        {/* Progress arc */}
        <path d={arcPath(-180, angle)} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        {/* Value */}
        <text x={cx} y={cy + 25} textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>{value}%</text>
      </svg>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function VelocityCard({ label, value, suffix = '', color }: { label: string; value: number; suffix?: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    yellow: 'text-yellow-700 dark:text-yellow-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    purple: 'text-purple-700 dark:text-purple-300',
    red: 'text-red-700 dark:text-red-300',
    gray: 'text-gray-700 dark:text-slate-300',
  };
  const bgs: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
    gray: 'bg-gray-50 dark:bg-slate-800/50',
  };
  return (
    <div className={`rounded-xl p-4 ${bgs[color] || bgs.gray}`}>
      <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colors[color] || colors.gray}`}>{value}{suffix}</div>
    </div>
  );
}

function ScoreComparisonChart({ records }: { records: ScoreRecord[] }) {
  const maxScore = Math.max(...records.flatMap(r => [r.ai_score, r.user_avg_score]), 1);
  const barGroupWidth = 40;
  const barWidth = 14;
  const gap = 4;
  const chartHeight = 180;
  const labelHeight = 30;
  const totalWidth = Math.max(records.length * (barGroupWidth + gap) + 20, 300);

  return (
    <div className="overflow-x-auto">
      <svg width={totalWidth} height={chartHeight + labelHeight} className="min-w-full">
        {records.map((r, i) => {
          const x = i * (barGroupWidth + gap) + 10;
          const aiH = (r.ai_score / maxScore) * (chartHeight - 20);
          const userH = (r.user_avg_score / maxScore) * (chartHeight - 20);
          const aiY = chartHeight - aiH;
          const userY = chartHeight - userH;

          return (
            <g key={r.work_item_id}>
              {/* AI bar */}
              <rect x={x} y={aiY} width={barWidth} height={aiH} rx="3" fill="#8b5cf6" opacity="0.85" />
              <text x={x + barWidth / 2} y={aiY - 3} textAnchor="middle" fontSize="9" fill="#8b5cf6">{r.ai_score}</text>
              {/* User bar */}
              <rect x={x + barWidth + 4} y={userY} width={barWidth} height={userH} rx="3" fill="#6366f1" opacity="0.85" />
              <text x={x + barWidth + 4 + barWidth / 2} y={userY - 3} textAnchor="middle" fontSize="9" fill="#6366f1">{r.user_avg_score}</text>
              {/* Label */}
              <text x={x + barWidth + 2} y={chartHeight + 16} textAnchor="middle" fontSize="9" fill="#9ca3af">#{r.work_item_id}</text>
            </g>
          );
        })}
        {/* Baseline */}
        <line x1="0" y1={chartHeight} x2={totalWidth} y2={chartHeight} stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-slate-700" />
      </svg>
    </div>
  );
}
