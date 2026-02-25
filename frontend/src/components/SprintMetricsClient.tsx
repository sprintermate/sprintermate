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

export default function SprintMetricsClient({
  projectId,
  sprintId,
  locale,
}: SprintMetricsClientProps) {
  const [metrics, setMetrics] = useState<SprintMetrics | null>(null);
  const [trends, setTrends] = useState<SprintTrend[]>([]);
  const [insights, setInsights] = useState<SprintInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsRes, trendsRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/metrics/projects/${projectId}/sprints/${sprintId}`,
          { credentials: 'include' }
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/metrics/projects/${projectId}/trends?limit=6`,
          { credentials: 'include' }
        ),
      ]);

      if (!metricsRes.ok) {
        throw new Error('Failed to fetch sprint metrics');
      }

      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError((err as Error).message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId]);

  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/metrics/projects/${projectId}/sprints/${sprintId}/insights`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!res.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await res.json();
      setInsights(data);
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, [projectId, sprintId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

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
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
            Error Loading Metrics
          </h3>
          <p className="text-red-700 dark:text-red-400">{error || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  const healthScoreColor =
    metrics.health.score >= 70
      ? 'text-emerald-600 dark:text-emerald-400'
      : metrics.health.score >= 50
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  const riskColors = {
    low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      {/* Sprint Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {metrics.sprintName}
            </h1>
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
              <>
                <span>🤖</span>
                AI Insights
              </>
            )}
          </button>
        </div>
      </div>

      {/* Executive Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Health Score"
          value={metrics.health.score}
          suffix="/100"
          icon="🎯"
          color={healthScoreColor}
          trend={metrics.health.score >= 70 ? 'up' : metrics.health.score >= 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          title="Completion Rate"
          value={metrics.health.completionRate.toFixed(1)}
          suffix="%"
          icon="📊"
          color="text-blue-600 dark:text-blue-400"
          trend={metrics.health.completionRate >= 75 ? 'up' : 'neutral'}
        />
        <MetricCard
          title="Velocity"
          value={metrics.velocity.completed}
          suffix={` / ${metrics.velocity.planned} pts`}
          icon="⚡"
          color="text-indigo-600 dark:text-indigo-400"
        />
        <MetricCard
          title="Risk Level"
          value={metrics.health.riskLevel.toUpperCase()}
          icon="❗"
          badge={true}
          badgeColor={riskColors[metrics.health.riskLevel]}
        />
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
            {insights.strengths.length > 0 && (
              <InsightBox title="✅ Strengths" items={insights.strengths} color="emerald" />
            )}
            {insights.risks.length > 0 && (
              <InsightBox title="🔥 Risks" items={insights.risks} color="red" />
            )}
            {insights.recommendations.length > 0 && (
              <InsightBox title="💡 Recommendations" items={insights.recommendations} color="blue" />
            )}
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
            <TrendChart
              title="Velocity Trend"
              data={trends}
              dataKey="velocity"
              color="indigo"
            />
            <TrendChart
              title="Completion Rate"
              data={trends}
              dataKey="completionRate"
              color="blue"
              suffix="%"
            />
            {/* Bug Count and Scope Change charts removed as requested */}
          </div>
        </div>
      )}

      {/* Work Items Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Work Items by State</h3>
          <div className="space-y-3">
            <StateBar label="Completed" count={metrics.workItems.completed} total={metrics.workItems.total} color="emerald" />
            <StateBar label="In Progress" count={metrics.workItems.inProgress} total={metrics.workItems.total} color="blue" />
            <StateBar label="Not Started" count={metrics.workItems.notStarted} total={metrics.workItems.total} color="gray" />
            {metrics.workItems.removed > 0 && (
              <StateBar label="Removed" count={metrics.workItems.removed} total={metrics.workItems.total} color="red" />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🐞 Bug Status</h3>
          <div className="space-y-3">
            <StateBar label="Active" count={metrics.bugs.active} total={metrics.bugs.total} color="red" />
            <StateBar label="Resolved" count={metrics.bugs.resolved} total={metrics.bugs.total} color="yellow" />
            <StateBar label="Closed" count={metrics.bugs.closed} total={metrics.bugs.total} color="emerald" />
          </div>
          <div className="mt-4 text-sm text-gray-600 dark:text-slate-400">
            Total Bugs: <span className="font-semibold">{metrics.bugs.total}</span>
          </div>
        </div>
      </div>

      {/* Work Items by Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">⏳ Average Time in State</h3>
          <div className="space-y-3">
            {Object.entries(metrics.stateMetrics.avgTimeInState)
              .sort((a, b) => b[1] - a[1])
              .map(([state, days]) => (
                <div key={state} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{state}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {days.toFixed(1)} days
                  </span>
                </div>
              ))}
            {Object.keys(metrics.stateMetrics.avgTimeInState).length === 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                No state duration data available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Flow Metrics */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">⏱️ Flow & Cycle Time Metrics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FlowMetricCard
            title="Avg Cycle Time"
            value={metrics.flow.avgCycleTime.toFixed(1)}
            suffix=" days"
            description="Active → Done"
          />
          <FlowMetricCard
            title="Avg Lead Time"
            value={metrics.flow.avgLeadTime.toFixed(1)}
            suffix=" days"
            description="Created → Done"
          />
          <FlowMetricCard
            title="Flow Efficiency"
            value={metrics.flow.flowEfficiency.toFixed(1)}
            suffix="%"
            description="Value-adding time"
          />
          <FlowMetricCard
            title="WIP Count"
            value={metrics.flow.wipCount}
            description="Work in progress"
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components

function MetricCard({
  title,
  value,
  suffix,
  icon,
  color,
  trend,
  badge,
  badgeColor,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  icon: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  badge?: boolean;
  badgeColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-800/60 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-slate-400">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      
      {badge ? (
        <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${badgeColor}`}>
          {value}
        </div>
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
  const colors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color as keyof typeof colors]}`}>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
        {items.map((item, i) => (
          <li key={i} className="leading-snug">• {item}</li>
        ))}
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

function TrendChart({
  title,
  data,
  dataKey,
  color,
  suffix = '',
}: {
  title: string;
  data: SprintTrend[];
  dataKey: keyof SprintTrend;
  color: string;
  suffix?: string;
}) {
  const colors = {
    indigo: 'stroke-indigo-600 dark:stroke-indigo-400',
    blue: 'stroke-blue-600 dark:stroke-blue-400',
    red: 'stroke-red-600 dark:stroke-red-400',
    yellow: 'stroke-yellow-600 dark:stroke-yellow-400',
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
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className={colors[color as keyof typeof colors]}
            points={data
              .map((d, i) => {
                const x = (i / (data.length - 1 || 1)) * 380 + 10;
                const value = Number(d[dataKey]) || 0;
                const y = 170 - ((value - min) / range) * 160;
                return `${x},${y}`;
              })
              .join(' ')}
          />
          {data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 380 + 10;
            const value = Number(d[dataKey]) || 0;
            const y = 170 - ((value - min) / range) * 160;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="currentColor" className={colors[color as keyof typeof colors]} />
                <text x={x} y="175" fontSize="10" fill="currentColor" className="text-gray-600 dark:text-slate-400" textAnchor="middle">
                  S{data.length - i}
                </text>
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

function StateBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  const colors = {
    emerald: 'bg-emerald-500 dark:bg-emerald-600',
    blue: 'bg-blue-500 dark:bg-blue-600',
    gray: 'bg-gray-400 dark:bg-gray-600',
    red: 'bg-red-500 dark:bg-red-600',
    yellow: 'bg-yellow-500 dark:bg-yellow-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-slate-300 font-medium">{label}</span>
        <span className="text-gray-600 dark:text-slate-400">
          {count} <span className="text-xs">({percentage.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[color as keyof typeof colors]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function FlowMetricCard({
  title,
  value,
  suffix,
  description,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  description: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
      <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
        {suffix && <span className="text-sm text-gray-500 dark:text-slate-400">{suffix}</span>}
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{description}</div>
    </div>
  );
}
