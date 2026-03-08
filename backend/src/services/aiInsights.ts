import { SprintMetrics, SprintTrend } from './azDevops';
import { UserAISettings } from '../db/schema';
import { decrypt } from '../utils/crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { childLogger } from '../utils/logger';

const execAsync = promisify(exec);
const log = childLogger('ai');

export interface SprintInsights {
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

/**
 * Generate AI-powered insights for a sprint based on metrics and trends
 */
export async function generateSprintInsights(
  userId: string,
  currentMetrics: SprintMetrics,
  historicalTrends: SprintTrend[],
): Promise<SprintInsights> {
  // Get user's AI settings
  const aiSettings = await UserAISettings.findOne({
    where: { user_id: userId },
  });

  const settings = aiSettings?.get({ plain: true });

  // Build context for AI
  const context = buildMetricsContext(currentMetrics, historicalTrends);

  // Generate insights using configured AI provider
  let aiResponse: string;
  
  try {
    aiResponse = await callAIProvider(settings, context);
  } catch (err) {
    log.error({ err }, 'AI provider call failed, using fallback analysis');
    return generateFallbackInsights(currentMetrics, historicalTrends);
  }

  // Parse AI response into structured insights
  return parseAIInsights(aiResponse, currentMetrics, historicalTrends);
}

function buildMetricsContext(current: SprintMetrics, trends: SprintTrend[]): string {
  const trendSummary = trends.length > 0
    ? `Historical data from ${trends.length} previous sprints:\n` +
      trends.map((t, i) => 
        `Sprint ${i + 1} (${t.sprintName}): Velocity ${t.velocity}, Completion ${t.completionRate.toFixed(1)}%, Bugs ${t.bugCount}`
      ).join('\n')
    : 'No historical data available.';

  return `
You are analyzing a software development sprint. Provide executive-level insights.

CURRENT SPRINT: ${current.sprintName}
Sprint Duration: ${current.startDate} to ${current.endDate}

HEALTH METRICS:
- Health Score: ${current.health.score}/100
- Completion Rate: ${current.health.completionRate}%
- Velocity: ${current.velocity.completed} points (Planned: ${current.velocity.planned})
- Scope Change: ${current.health.scopeChange}%
- Risk Level: ${current.health.riskLevel}


FLOW METRICS:
- Average Cycle Time: ${current.flow.avgCycleTime} days
- Average Lead Time: ${current.flow.avgLeadTime} days
- Blocked Time: ${current.flow.avgBlockedTime} days


${trendSummary}

Provide a JSON response with:
{
  "summary": "2-3 sentence executive summary",
  "risks": ["risk1", "risk2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "strengths": ["strength1", "strength2", ...],
  "velocityTrend": "trend analysis",
  "qualityTrend": "quality analysis",
  "flowHealth": "flow analysis",
  "teamCapacity": "capacity analysis"
}
`;
}

async function callAIProvider(settings: any, context: string): Promise<string> {
  if (!settings?.provider || !settings?.enabled) {
    throw new Error('No AI provider configured');
  }

  const prompt = `${context}\n\nProvide insights in JSON format as specified.`;

  switch (settings.provider) {
    case 'claude':
      return await callClaudeCLI(prompt);
    
    case 'copilot':
      return await callCopilotCLI(prompt);
    
    case 'gemini':
      if (!settings.api_key) throw new Error('Gemini API key not configured');
      return await callGeminiAPI(decrypt(settings.api_key), prompt);
    
    case 'chatgpt':
      if (!settings.api_key) throw new Error('ChatGPT API key not configured');
      return await callChatGPTAPI(decrypt(settings.api_key), prompt);
    
    default:
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
  }
}

async function callClaudeCLI(prompt: string): Promise<string> {
  const { stdout } = await execAsync(`claude --text "${prompt.replace(/"/g, '\\"')}"`);
  return stdout.trim();
}

async function callCopilotCLI(prompt: string): Promise<string> {
  const { stdout } = await execAsync(`gh copilot suggest "${prompt.replace(/"/g, '\\"')}"`);
  return stdout.trim();
}

async function callGeminiAPI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callChatGPTAPI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`ChatGPT API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

function parseAIInsights(aiResponse: string, current: SprintMetrics, trends: SprintTrend[]): SprintInsights {
  try {
    // Try to extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || generateDefaultSummary(current),
        risks: parsed.risks || [],
        recommendations: parsed.recommendations || [],
        strengths: parsed.strengths || [],
        analysis: {
          velocityTrend: parsed.velocityTrend || 'Analysis unavailable',
          qualityTrend: parsed.qualityTrend || 'Analysis unavailable',
          flowHealth: parsed.flowHealth || 'Analysis unavailable',
          teamCapacity: parsed.teamCapacity || 'Analysis unavailable',
        },
      };
    }
  } catch (err) {
    log.error({ err }, 'Failed to parse AI response');
  }

  // Fallback to rule-based insights
  return generateFallbackInsights(current, trends);
}

function generateFallbackInsights(current: SprintMetrics, trends: SprintTrend[]): SprintInsights {
  const risks: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];

  // Analyze completion rate
  if (current.health.completionRate < 60) {
    risks.push(`Low completion rate (${current.health.completionRate.toFixed(1)}%) indicates sprint scope may be too aggressive`);
    recommendations.push('Consider reducing sprint scope or breaking down large work items');
  } else if (current.health.completionRate > 90) {
    strengths.push(`Excellent completion rate (${current.health.completionRate.toFixed(1)}%)`);
  }

  // Analyze velocity trends
  if (trends.length >= 3) {
    const recentVelocities = trends.slice(-3).map(t => t.velocity);
    const avgVelocity = recentVelocities.reduce((a, b) => a + b, 0) / recentVelocities.length;
    const velocityTrend = current.velocity.completed - avgVelocity;
    
    if (velocityTrend < -5) {
      risks.push('Velocity declining compared to recent sprints');
      recommendations.push('Review team capacity and potential blockers');
    } else if (velocityTrend > 5) {
      strengths.push('Velocity improving compared to recent sprints');
    }
  }

  // Analyze cycle time
  if (current.flow.avgCycleTime > 10) {
    risks.push(`High average cycle time (${current.flow.avgCycleTime.toFixed(1)} days) may indicate bottlenecks`);
    recommendations.push('Identify and remove bottlenecks in the development process');
  } else if (current.flow.avgCycleTime < 3) {
    strengths.push(`Fast cycle time (${current.flow.avgCycleTime.toFixed(1)} days) - efficient delivery`);
  }

  const summary = generateDefaultSummary(current);

  return {
    summary,
    risks,
    recommendations,
    strengths,
    analysis: {
      velocityTrend: analyzeVelocityTrend(current, trends),
      qualityTrend: analyzeQualityTrend(current, trends),
      flowHealth: analyzeFlowHealth(current),
      teamCapacity: analyzeTeamCapacity(current),
    },
  };
}

function generateDefaultSummary(current: SprintMetrics): string {
  const healthDesc = current.health.score >= 70 ? 'healthy' : current.health.score >= 50 ? 'moderate' : 'at risk';
  return `Sprint ${current.sprintName} is ${healthDesc} with ${current.health.completionRate.toFixed(1)}% completion rate and ${current.velocity.completed} story points delivered. ${current.health.riskLevel === 'high' ? 'Immediate attention recommended.' : ''}`;
}

function analyzeVelocityTrend(current: SprintMetrics, trends: SprintTrend[]): string {
  if (trends.length < 2) {
    return `Current velocity: ${current.velocity.completed} points. Insufficient historical data for trend analysis.`;
  }

  const recentAvg = trends.slice(-3).reduce((sum, t) => sum + t.velocity, 0) / Math.min(3, trends.length);
  const diff = current.velocity.completed - recentAvg;
  const diffPercent = (diff / recentAvg) * 100;

  if (Math.abs(diffPercent) < 10) {
    return `Velocity is stable around ${recentAvg.toFixed(1)} points (current: ${current.velocity.completed}).`;
  } else if (diffPercent > 0) {
    return `Velocity increased by ${diffPercent.toFixed(1)}% compared to recent average (${recentAvg.toFixed(1)} → ${current.velocity.completed}).`;
  } else {
    return `Velocity decreased by ${Math.abs(diffPercent).toFixed(1)}% compared to recent average (${recentAvg.toFixed(1)} → ${current.velocity.completed}).`;
  }
}

function analyzeQualityTrend(current: SprintMetrics, trends: SprintTrend[]): string {
  if (trends.length >= 2) {
    const avgBugCount = trends.reduce((sum, t) => sum + t.bugCount, 0) / trends.length;
    const currentBugCount = trends[trends.length - 1]?.bugCount || 0;
    if (currentBugCount > avgBugCount * 1.5) {
      return `Bug count trend is higher than average. Focus on quality improvements.`;
    } else if (currentBugCount < avgBugCount * 0.5) {
      return `Bug count trend is lower than average. Quality is improving.`;
    }
  }

  return `Quality metrics stable. Continue current practices.`;
}

function analyzeFlowHealth(current: SprintMetrics): string {
  const cycleTime = current.flow.avgCycleTime;
  const efficiency = cycleTime > 0 ? ((cycleTime - current.flow.avgBlockedTime) / cycleTime) * 100 : 0;
  
  let health = 'good';
  if (efficiency < 30 || cycleTime > 14) health = 'poor';
  else if (efficiency < 50 || cycleTime > 7) health = 'moderate';

  return `Flow health is ${health}. Average cycle time: ${cycleTime.toFixed(1)} days, flow efficiency: ${efficiency.toFixed(1)}%. ${
    current.flow.avgBlockedTime > 2 ? `Significant blocked time (${current.flow.avgBlockedTime.toFixed(1)} days) detected.` : ''
  }`;
}

function analyzeTeamCapacity(current: SprintMetrics): string {
  const utilizationRate = current.velocity.planned > 0 
    ? (current.velocity.completed / current.velocity.planned) * 100 
    : 0;

  if (utilizationRate > 90) {
    return `Team is at ${utilizationRate.toFixed(1)}% capacity utilization - excellent delivery. Consider slight scope increase if sustainable.`;
  } else if (utilizationRate > 70) {
    return `Team is at ${utilizationRate.toFixed(1)}% capacity utilization - healthy range. Current planning appears appropriate.`;
  } else if (utilizationRate > 50) {
    return `Team is at ${utilizationRate.toFixed(1)}% capacity utilization - moderate. Review blockers and scope accuracy.`;
  } else {
    return `Team is at ${utilizationRate.toFixed(1)}% capacity utilization - low. Investigate blockers, scope issues, or team availability.`;
  }
}
