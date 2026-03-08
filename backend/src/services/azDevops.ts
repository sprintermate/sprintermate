import { childLogger } from '../utils/logger';

const log = childLogger('azDevops');

/**
 * Azure DevOps work item URL'sini organization, project ve workItemId'ye göre üretir.
 * dev.azure.com ve *.visualstudio.com formatlarını destekler.
 */
export function buildWorkItemUrl(
  organization: string,
  project: string,
  workItemId: number | string,
  opts?: { visualStudio?: boolean }
): string {
  if (opts?.visualStudio) {
    // https://{org}.visualstudio.com/{project}/_workitems/edit/{id}
    return `https://${organization}.visualstudio.com/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
  } else {
    // https://dev.azure.com/{org}/{project}/_workitems/edit/{id}
    return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
  }
}
export interface ParsedSprintUrl {
  organization: string;
  project: string;
  team: string;
  sprint: string;
}

/**
 * Parses an Azure DevOps sprint board or sprint backlog URL.
 *
 * Supported formats:
 *   _sprints: https://dev.azure.com/{org}/{project}/_sprints/{type}/{team}/.../{sprint}
 *   _boards:  https://dev.azure.com/{org}/{project}/_boards/board/t/{team}/Sprint/{sprint}
 */
export function parseSprintUrl(rawUrl: string): ParsedSprintUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  // dev.azure.com veya *.visualstudio.com destekle
  const isDevAzure = url.hostname === 'dev.azure.com';
  const isVisualStudio = url.hostname.endsWith('.visualstudio.com');
  if (!isDevAzure && !isVisualStudio) return null;

  const segments = url.pathname.split('/').map(s => decodeURIComponent(s));

  if (isDevAzure) {
    // dev.azure.com/{org}/{project}/...
    const org     = segments[1];
    const project = segments[2];
    const typeKey = segments[3]; // '_sprints' or '_boards'
    if (!org || !project) return null;

    if (typeKey === '_sprints') {
      // ['', org, project, '_sprints', type, team, ...rest, sprint]
      const team   = segments[5];
      const sprint = segments[segments.length - 1];
      if (!team || !sprint) return null;
      return { organization: org, project, team, sprint };
    }
    if (typeKey === '_boards') {
      // ['', org, project, '_boards', 'board', 't', team, ...]
      const tIdx = segments.indexOf('t', 4);
      if (tIdx === -1 || !segments[tIdx + 1]) return null;
      const team   = segments[tIdx + 1];
      const sprint = segments[segments.length - 1];
      return { organization: org, project, team, sprint };
    }
  }

  if (isVisualStudio) {
    // {org}.visualstudio.com/{project}/_sprints/backlog/{team}/{project}/{iterationPath...}/{sprint}
    // örnek: https://dtalm.visualstudio.com/VDF-FinanceWare/_sprints/backlog/Ninja%20Turtles%20Team/VDF-FinanceWare/Ninja%20Turtles%20Iteration/2026%20Ninja%20Turtles%20Sprints/Sprint_109
    const org = url.hostname.split('.')[0];
    // ['', project, '_sprints', 'backlog', team, ...iterationPath, sprint]
    const project = segments[1];
    const typeKey = segments[2];
    const backlogKey = segments[3];
    if (!org || !project || typeKey !== '_sprints' || backlogKey !== 'backlog') return null;
    const team = segments[4];
    const sprint = segments[segments.length - 1];
    if (!team || !sprint) return null;
    return { organization: org, project, team, sprint };
  }

  return null;
}

export interface AdoSprint {
  id: string;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
}

/**
 * Returns the Basic Authorization header value for a Personal Access Token.
 * ADO expects Basic base64(":{pat}") — the username is intentionally empty.
 */
export function patAuthHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
}

/**
 * Lists iterations (sprints) for a given team via the ADO REST API.
 *
 * @param authHeader - Full Authorization header value from {@link patAuthHeader}.
 */
export async function listSprints(
  organization: string,
  project: string,
  team: string,
  authHeader: string,
): Promise<AdoSprint[]> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/${encodeURIComponent(team)}` +
    `/_apis/work/teamsettings/iterations?api-version=7.1`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    // Do not follow redirects — ADO auth failures redirect to HTML login pages
    // which would otherwise produce confusing "Unexpected token '<'" parse errors.
    redirect: 'error',
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await res.json() as { message?: string; value?: string };
      const msg = body.message ?? body.value ?? JSON.stringify(body);
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Azure DevOps returned ${res.status}: ${msg}. ` +
          'Check that your credentials have the required permissions (vso.work scope).',
        );
      }
      throw new Error(`ADO API error ${res.status}: ${msg}`);
    }
    // Non-JSON error (e.g. plain-text or unexpected HTML)
    const text = (await res.text()).slice(0, 200);
    throw new Error(`ADO API error ${res.status} (non-JSON response): ${text}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // Received a 200 but the body is not JSON — most likely an auth redirect was followed
    throw new Error(
      'ADO API returned a non-JSON response. ' +
      'This usually means the access token is invalid or has insufficient scope. ' +
      'Try signing out and back in, or add a Personal Access Token for this project.',
    );
  }

  const data = await res.json() as { value?: any[] };
  const items: any[] = data.value ?? [];

  return items
    .map((item: any) => ({
      id:         item.id ?? '',
      name:       item.name ?? '',
      path:       item.path ?? '',
      startDate:  item.attributes?.startDate  ?? undefined,
      finishDate: item.attributes?.finishDate ?? undefined,
    }))
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
}

// ─── Work Items ──────────────────────────────────────────────────────────────

export interface AdoWorkItemSummary {
  id: number;
  title: string;
  state: string;
  storyPoints: number | null;
  workItemType: string;
  assignedTo: string | null;
}

export interface AdoWorkItem extends AdoWorkItemSummary {
  description: string;
  acceptanceCriteria: string | null;
}

export interface AdoWorkItemDetail extends AdoWorkItem {
  comments: AdoWorkItemComment[];
}

export interface AdoWorkItemComment {
  id: number;
  text: string;
  createdBy: string;
  createdDate: string;
}

/**
 * Strips inline color/background-color/font properties from ADO HTML so the
 * content renders correctly on a dark background without invisible text.
 * Also removes empty style="" attributes left over after stripping.
 * If roomCode is provided, proxies Azure DevOps image URLs through the backend.
 */
function sanitizeAdoHtml(html: string | null, roomCode?: string): string {
  if (!html) return '';
  
  let sanitized = html
    // Remove color, background-color, background, font-family, font-size inline props
    .replace(/\bcolor\s*:[^;"]*(;|(?="))/gi, '')
    .replace(/\bbackground(?:-color)?\s*:[^;"]*(;|(?="))/gi, '')
    .replace(/\bfont-family\s*:[^;"]*(;|(?="))/gi, '')
    .replace(/\bfont-size\s*:[^;"]*(;|(?="))/gi, '')
    // Drop style="" or style=" " that are now empty after stripping
    .replace(/\sstyle="\s*"/gi, '');

  // Proxy Azure DevOps images if roomCode is provided
  if (roomCode) {
    sanitized = sanitized.replace(
      /<img([^>]+)src=["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        // Check if the image URL is from Azure DevOps
        if (src.includes('dev.azure.com') || src.includes('visualstudio.com')) {
          const encodedUrl = encodeURIComponent(src);
          // Use relative path so it works with any backend URL (Docker, ngrok, localhost, etc.)
          const proxyUrl = `/api/rooms/${roomCode}/ado-image-proxy?url=${encodedUrl}`;
          return `<img${before}src="${proxyUrl}"${after}>`;
        }
        return match;
      }
    );
  }

  return sanitized;
}

/**
 * Returns all work items for a given team iteration (sprint).
 *
 * Two-step:
 *   1. Fetch work item relations for the iteration to get IDs.
 *   2. Batch-fetch work item fields.
 */
export async function getWorkItemsForIteration(
  organization: string,
  project: string,
  team: string,
  iterationId: string,
  authHeader: string,
  roomCode?: string,
): Promise<AdoWorkItem[]> {
  // Step 1: get work item IDs for the iteration
  const iterUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/${encodeURIComponent(team)}` +
    `/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/workitems?api-version=7.1`;

  const iterRes = await fetch(iterUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    redirect: 'error',
  });

  if (!iterRes.ok) {
    const text = (await iterRes.text()).slice(0, 200);
    throw new Error(`ADO iteration work items error ${iterRes.status}: ${text}`);
  }

  const iterData = await iterRes.json() as {
    workItemRelations?: Array<{ target?: { id: number } }>;
  };

  const ids = (iterData.workItemRelations ?? [])
    .map((r) => r.target?.id)
    .filter((id): id is number => id !== undefined);

  if (ids.length === 0) return [];

  // Step 2: batch fetch work item fields
  const batchUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/wit/workitemsbatch?api-version=7.1`;

  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ids,
      fields: [
        'System.Id',
        'System.Title',
        'System.Description',
        'System.State',
        'System.WorkItemType',
        'System.AssignedTo',
        'Microsoft.VSTS.Scheduling.StoryPoints',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
      ],
    }),
    redirect: 'error',
  });

  if (!batchRes.ok) {
    const text = (await batchRes.text()).slice(0, 200);
    throw new Error(`ADO batch work items error ${batchRes.status}: ${text}`);
  }

  const batchData = await batchRes.json() as { value?: any[] };
  // Re-order results to match the ADO iteration order captured in `ids`
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  const mapped = (batchData.value ?? []).map((wi: any): AdoWorkItem => ({
    id: wi.id as number,
    title: (wi.fields?.['System.Title'] as string) ?? '',
    description: sanitizeAdoHtml(wi.fields?.['System.Description'] as string | null, roomCode),
    state: (wi.fields?.['System.State'] as string) ?? '',
    storyPoints: (wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] as number | null) ?? null,
    workItemType: (wi.fields?.['System.WorkItemType'] as string) ?? '',
    assignedTo: (wi.fields?.['System.AssignedTo'] as { displayName?: string } | null)?.displayName ?? null,
    acceptanceCriteria: sanitizeAdoHtml(wi.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string | null, roomCode),
  }));
  mapped.sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0));
  return mapped;
}

/**
 * Returns lightweight work item summaries (no description/acceptanceCriteria) for a given
 * team iteration (sprint). Faster and smaller payload than getWorkItemsForIteration().
 */
export async function getWorkItemListForIteration(
  organization: string,
  project: string,
  team: string,
  iterationId: string,
  authHeader: string,
): Promise<AdoWorkItemSummary[]> {
  // Step 1: get work item IDs for the iteration
  const iterUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/${encodeURIComponent(team)}` +
    `/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/workitems?api-version=7.1`;

  const iterRes = await fetch(iterUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    redirect: 'error',
  });

  if (!iterRes.ok) {
    const text = (await iterRes.text()).slice(0, 200);
    throw new Error(`ADO iteration work items error ${iterRes.status}: ${text}`);
  }

  const iterData = await iterRes.json() as {
    workItemRelations?: Array<{ target?: { id: number } }>;
  };

  const ids = (iterData.workItemRelations ?? [])
    .map((r) => r.target?.id)
    .filter((id): id is number => id !== undefined);

  if (ids.length === 0) return [];

  // Step 2: batch fetch lightweight fields only
  const batchUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/wit/workitemsbatch?api-version=7.1`;

  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ids,
      fields: [
        'System.Id',
        'System.Title',
        'System.State',
        'System.WorkItemType',
        'System.AssignedTo',
        'Microsoft.VSTS.Scheduling.StoryPoints',
      ],
    }),
    redirect: 'error',
  });

  if (!batchRes.ok) {
    const text = (await batchRes.text()).slice(0, 200);
    throw new Error(`ADO batch work items error ${batchRes.status}: ${text}`);
  }

  const batchData = await batchRes.json() as { value?: any[] };
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  const mapped = (batchData.value ?? []).map((wi: any): AdoWorkItemSummary => ({
    id: wi.id as number,
    title: (wi.fields?.['System.Title'] as string) ?? '',
    state: (wi.fields?.['System.State'] as string) ?? '',
    storyPoints: (wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] as number | null) ?? null,
    workItemType: (wi.fields?.['System.WorkItemType'] as string) ?? '',
    assignedTo: (wi.fields?.['System.AssignedTo'] as { displayName?: string } | null)?.displayName ?? null,
  }));
  mapped.sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0));
  return mapped;
}

/**
 * Returns full details (description, acceptanceCriteria, comments) for a single ADO work item.
 */
export async function getWorkItemDetail(
  organization: string,
  project: string,
  workItemId: number,
  authHeader: string,
  roomCode?: string,
): Promise<AdoWorkItemDetail> {
  const fields = [
    'System.Id',
    'System.Title',
    'System.Description',
    'System.State',
    'System.WorkItemType',
    'System.AssignedTo',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'Microsoft.VSTS.Common.AcceptanceCriteria',
  ].join(',');

  const itemUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}?fields=${encodeURIComponent(fields)}&api-version=7.1`;

  const [itemRes, comments] = await Promise.all([
    fetch(itemUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      redirect: 'error',
    }),
    getWorkItemComments(organization, project, workItemId, authHeader, roomCode),
  ]);

  if (!itemRes.ok) {
    const text = (await itemRes.text()).slice(0, 200);
    throw new Error(`ADO work item detail error ${itemRes.status}: ${text}`);
  }

  const wi = await itemRes.json() as any;
  return {
    id: wi.id as number,
    title: (wi.fields?.['System.Title'] as string) ?? '',
    description: sanitizeAdoHtml(wi.fields?.['System.Description'] as string | null, roomCode),
    state: (wi.fields?.['System.State'] as string) ?? '',
    storyPoints: (wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] as number | null) ?? null,
    workItemType: (wi.fields?.['System.WorkItemType'] as string) ?? '',
    assignedTo: (wi.fields?.['System.AssignedTo'] as { displayName?: string } | null)?.displayName ?? null,
    acceptanceCriteria: sanitizeAdoHtml(wi.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string | null, roomCode) || null,
    comments,
  };
}

/**
 * Returns comments for a specific ADO work item.
 */
export async function getWorkItemComments(
  organization: string,
  project: string,
  workItemId: number,
  authHeader: string,
  roomCode?: string,
): Promise<AdoWorkItemComment[]> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    redirect: 'error',
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new Error(`ADO work item comments error ${res.status}: ${text}`);
  }

  const data = await res.json() as { comments?: any[] };
  const comments = data.comments ?? [];

  return comments
    .filter((comment: any) => !comment?.isDeleted)
    .map((comment: any): AdoWorkItemComment => ({
      id: comment.id as number,
      text: sanitizeAdoHtml((comment.text as string) ?? '', roomCode),
      createdBy: (comment.createdBy?.displayName as string) ?? 'Unknown',
      createdDate: (comment.createdDate as string) ?? '',
    }));
}

/**
 * Updates the Story Points field of a single ADO work item.
 */
export async function updateWorkItemStoryPoints(
  organization: string,
  project: string,
  workItemId: number,
  storyPoints: number,
  authHeader: string,
): Promise<void> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}?api-version=7.1`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json-patch+json',
      Accept: 'application/json',
    },
    body: JSON.stringify([
      {
        op: 'replace',
        path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
        value: storyPoints,
      },
    ]),
    redirect: 'error',
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new Error(`ADO update work item error ${res.status}: ${text}`);
  }
}

// ─── Sprint Metrics ───────────────────────────────────────────────────────────

export interface SprintMetrics {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  health: {
    score: number; // 0-100
    completionRate: number; // 0-100
    velocity: number;
    scopeChange: number; // percentage
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
    byStateSP: Record<string, number>;
    byTypePercentage: Record<string, number>;
  };
  velocity: {
    planned: number;
    completed: number;
    carried: number;
  };
  flow: {
    avgCycleTime: number; // days
    avgLeadTime: number; // days
    avgBlockedTime: number; // days
    wipCount: number;
    flowEfficiency: number; // 0-100
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
    avgTransitionTimes: Record<string, number>;
  };
}

export interface SprintTrend {
  sprintId: string;
  sprintName: string;
  velocity: number;
  completionRate: number;
  scopeChange: number;
  bugCount: number;
  carryOver: number;
  startDate: string;
}

/**
 * Calculate comprehensive metrics for a sprint
 */
export async function calculateSprintMetrics(
  organization: string,
  project: string,
  team: string,
  iterationId: string,
  authHeader: string,
): Promise<SprintMetrics> {
  // Fetch sprint info
  const sprintsUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}?api-version=7.1`;
  const sprintRes = await fetch(sprintsUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    redirect: 'error',
  });

  if (!sprintRes.ok) {
    throw new Error(`Failed to fetch sprint info: ${sprintRes.status}`);
  }

  const sprintData = await sprintRes.json() as any;
  const sprintName = sprintData.name ?? 'Unknown Sprint';
  const startDate = sprintData.attributes?.startDate ?? '';
  const endDate = sprintData.attributes?.finishDate ?? '';

  // Fetch work items for this sprint with revision history
  const workItems = await getWorkItemsWithHistory(
    organization,
    project,
    team,
    iterationId,
    authHeader,
  );

  // Calculate metrics
  const total = workItems.length;
  const completed = workItems.filter(w => isCompletedState(w.state)).length;
  const inProgress = workItems.filter(w => isInProgressState(w.state)).length;
  const notStarted = workItems.filter(w => isNotStartedState(w.state)).length;
  const removed = workItems.filter(w => isRemovedState(w.state)).length;

  const byType: Record<string, number> = {};
  const byState: Record<string, number> = {};
  const byStateSP: Record<string, number> = {};
  
  let totalPlannedPoints = 0;
  let totalCompletedPoints = 0;
  let totalCarriedPoints = 0;
  let bugCount = 0;
  let activeBugs = 0;
  let resolvedBugs = 0;
  let closedBugs = 0;

  let totalCycleTime = 0;
  let totalLeadTime = 0;
  let totalBlockedTime = 0;
  let itemsWithCycleTime = 0;
  let itemsWithLeadTime = 0;
  let itemsWithBlockedTime = 0;

  workItems.forEach(wi => {
    // Count by type
    byType[wi.workItemType] = (byType[wi.workItemType] || 0) + 1;
    byState[wi.state] = (byState[wi.state] || 0) + 1;
    byStateSP[wi.state] = (byStateSP[wi.state] || 0) + (wi.storyPoints || 0);

    // Story points - only count non-removed items
    const points = wi.storyPoints || 0;
    if (!isRemovedState(wi.state)) {
      totalPlannedPoints += points;
    }
    
    if (isCompletedState(wi.state)) {
      totalCompletedPoints += points;
    } else if (!isRemovedState(wi.state)) {
      // Not completed and not removed = carried over
      totalCarriedPoints += points;
    }

    // Bugs
    if (wi.workItemType === 'Bug') {
      bugCount++;
      if (wi.state === 'Active' || wi.state === 'New') activeBugs++;
      else if (wi.state === 'Resolved') resolvedBugs++;
      else if (wi.state === 'Closed') closedBugs++;
    }

    // Flow metrics from history (if available)
    if (wi.history) {
      if (wi.history.cycleTime !== null && wi.history.cycleTime !== undefined) {
        totalCycleTime += wi.history.cycleTime;
        itemsWithCycleTime++;
      }
      if (wi.history.leadTime !== null && wi.history.leadTime !== undefined) {
        totalLeadTime += wi.history.leadTime;
        itemsWithLeadTime++;
      }
      if (wi.history.blockedTime !== null && wi.history.blockedTime !== undefined) {
        totalBlockedTime += wi.history.blockedTime;
        itemsWithBlockedTime++;
      }
    }
  });

  const avgCycleTime = itemsWithCycleTime > 0 ? totalCycleTime / itemsWithCycleTime : 0;
  const avgLeadTime = itemsWithLeadTime > 0 ? totalLeadTime / itemsWithLeadTime : 0;
  const avgBlockedTime = itemsWithBlockedTime > 0 ? totalBlockedTime / itemsWithBlockedTime : 0;
  
  // Flow efficiency = (value-adding time / total lead time) * 100
  // Value-adding time ≈ cycle time - blocked time
  const valueAddingTime = Math.max(0, avgCycleTime - avgBlockedTime);
  const flowEfficiency = avgLeadTime > 0 ? (valueAddingTime / avgLeadTime) * 100 : 
    (avgCycleTime > 0 ? 100 : 0); // If no lead time but has cycle time, assume 100% efficiency

  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  const velocity = totalCompletedPoints;

  // Calculate scope change (simplified - would need sprint start snapshot in real implementation)
  const scopeChange = 0; // Placeholder - requires historical data

  // Calculate health score (weighted average)
  const healthScore = Math.round(
    completionRate * 0.4 +
    (velocity / (totalPlannedPoints || 1)) * 100 * 0.3 +
    (100 - Math.min(bugCount * 10, 100)) * 0.2 +
    flowEfficiency * 0.1
  );

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (healthScore < 50 || completionRate < 60) riskLevel = 'high';
  else if (healthScore < 70 || completionRate < 75) riskLevel = 'medium';

  // Calculate state duration metrics
  const workItemIds = workItems.map(wi => wi.id);
  const stateMetricsResult = await calculateStateDurations(
    organization,
    project,
    workItemIds,
    authHeader,
  );

  // Use revision-based cycle/lead times when available (more accurate)
  const finalCycleTime = stateMetricsResult.revisedCycleTime > 0 ? stateMetricsResult.revisedCycleTime : avgCycleTime;
  const finalLeadTime = stateMetricsResult.revisedLeadTime > 0 ? stateMetricsResult.revisedLeadTime : avgLeadTime;

  // Calculate percentage distribution by type
  const byTypePercentage: Record<string, number> = {};
  if (total > 0) {
    for (const type in byType) {
      byTypePercentage[type] = Math.round((byType[type] / total) * 1000) / 10; // Round to 1 decimal
    }
  }

  return {
    sprintId: iterationId,
    sprintName,
    startDate,
    endDate,
    health: {
      score: healthScore,
      completionRate: Math.round(completionRate * 10) / 10,
      velocity,
      scopeChange,
      riskLevel,
      bugCount,
      bugTrend: 'stable', // Placeholder - requires historical comparison
    },
    workItems: {
      total,
      completed,
      inProgress,
      notStarted,
      removed,
      byType,
      byState,
      byStateSP,
      byTypePercentage,
    },
    velocity: {
      planned: totalPlannedPoints,
      completed: totalCompletedPoints,
      carried: totalCarriedPoints,
    },
    flow: {
      avgCycleTime: Math.round(finalCycleTime * 10) / 10,
      avgLeadTime: Math.round(finalLeadTime * 10) / 10,
      avgBlockedTime: Math.round(avgBlockedTime * 10) / 10,
      wipCount: inProgress,
      flowEfficiency: Math.round(flowEfficiency * 10) / 10,
    },
    bugs: {
      total: bugCount,
      active: activeBugs,
      resolved: resolvedBugs,
      closed: closedBugs,
    },
    stateMetrics: {
      avgTimeInState: stateMetricsResult.avgTimeInState,
      stateTransitions: stateMetricsResult.stateTransitions,
      avgTransitionTimes: stateMetricsResult.avgTransitionTimes,
    },
  };
}

/**
 * Get work items with revision history for flow metrics
 */
async function getWorkItemsWithHistory(
  organization: string,
  project: string,
  team: string,
  iterationId: string,
  authHeader: string,
): Promise<any[]> {
  // First get work item IDs
  const iterUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/workitems?api-version=7.1`;
  
  const iterRes = await fetch(iterUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    redirect: 'error',
  });

  if (!iterRes.ok) {
    throw new Error(`Failed to fetch work items: ${iterRes.status}`);
  }

  const iterData = await iterRes.json() as any;
  const ids = (iterData.workItemRelations ?? [])
    .map((r: any) => r.target?.id)
    .filter((id: any): id is number => id !== undefined);

  if (ids.length === 0) return [];

  // Azure DevOps has a limit of 200 items per batch request - split into chunks
  const BATCH_SIZE = 200;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    chunks.push(ids.slice(i, i + BATCH_SIZE));
  }

  const batchUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=7.1`;
  const allItems: any[] = [];

  // Fetch each chunk
  for (const chunk of chunks) {
    try {
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ids: chunk,
          fields: [
            'System.Id',
            'System.Title',
            'System.State',
            'System.WorkItemType',
            'Microsoft.VSTS.Scheduling.StoryPoints',
            'System.AssignedTo',
            'System.CreatedDate',
            'Microsoft.VSTS.Common.StateChangeDate',
            'Microsoft.VSTS.Common.ActivatedDate',
            'Microsoft.VSTS.Common.ResolvedDate',
            'Microsoft.VSTS.Common.ClosedDate',
          ],
        }),
      });

      if (!batchRes.ok) {
        const text = (await batchRes.text()).slice(0, 200);
        log.error('Failed to batch fetch work items chunk', { status: batchRes.status, body: text });
        continue; // Skip this chunk but continue with others
      }

      const batchData = await batchRes.json() as any;
      allItems.push(...(batchData.value ?? []));
    } catch (err) {
      log.error('Batch fetch work items chunk failed', { err });
      // Continue with next chunk
    }
  }

  const items = allItems;

  return items.map((item: any) => {
    const fields = item.fields ?? {};
    const createdDate = fields['System.CreatedDate'];
    const closedDate = fields['Microsoft.VSTS.Common.ClosedDate'] || fields['Microsoft.VSTS.Common.ResolvedDate'];
    const activatedDate = fields['Microsoft.VSTS.Common.ActivatedDate'];
    const state = fields['System.State'] ?? '';

    let cycleTime: number | null = null;
    let leadTime: number | null = null;
    // Only calculate lead time for completed items
    if (createdDate && closedDate) {
      leadTime = daysBetween(createdDate, closedDate);
    }
    // Only calculate cycle time for items that were activated and completed
    if (activatedDate && closedDate) {
      cycleTime = daysBetween(activatedDate, closedDate);
    }
    return {
      id: item.id,
      title: fields['System.Title'] ?? '',
      state,
      workItemType: fields['System.WorkItemType'] ?? '',
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] ?? null,
      assignedTo: fields['System.AssignedTo']?.displayName ?? null,
      history: {
        cycleTime,
        leadTime,
        blockedTime: 0, // Would require parsing state history
      },
    };
  });
}

/**
 * Get state duration metrics by fetching work item revisions.
 * Calculates:
 * - Average time in each state
 * - State transition counts
 * - Average transition times between specific state pairs (e.g., Development → Development Done)
 * - Revised cycle time (first active state → first done state) from revisions
 * - Revised lead time (created → first done state) from revisions
 */
async function calculateStateDurations(
  organization: string,
  project: string,
  workItemIds: number[],
  authHeader: string,
): Promise<{
  avgTimeInState: Record<string, number>;
  stateTransitions: Record<string, number>;
  avgTransitionTimes: Record<string, number>;
  revisedCycleTime: number;
  revisedLeadTime: number;
}> {
  // Target state pairs for transition time measurement
  const targetTransitions: [string, string][] = [
    ['Development', 'Development Done'],
    ['Development Done', 'Test'],
    ['Test', 'in UAT'],
  ];

  const transitionTimesMap: Record<string, number[]> = {};
  for (const [from, to] of targetTransitions) {
    transitionTimesMap[`${from}->${to}`] = [];
  }

  const stateDurationsMap: Record<string, number[]> = {};
  const stateTransitions: Record<string, number> = {};
  const cycleTimesArr: number[] = [];
  const leadTimesArr: number[] = [];

  const ACTIVE_STATES = ['Active', 'Development', 'In Progress', 'Committed'];
  const DONE_STATES = ['Done', 'Closed', 'Resolved', 'Completed'];

  // Limit to first 50 items to avoid too many API calls
  const idsToProcess = workItemIds.slice(0, 50);

  for (const id of idsToProcess) {
    try {
      const revisionsUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
      const res = await fetch(revisionsUrl, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });

      if (!res.ok) continue;

      const data = await res.json() as any;
      const revisions: any[] = data.value ?? [];
      if (revisions.length === 0) continue;

      // Extract state change events (deduplicate consecutive same-state revisions)
      const stateEvents: Array<{ state: string; date: Date }> = [];
      let createdDate: Date | null = null;

      for (let i = 0; i < revisions.length; i++) {
        const rev = revisions[i];
        const state = rev.fields?.['System.State'];
        const changedDate = rev.fields?.['System.ChangedDate'] || rev.fields?.['System.CreatedDate'];

        if (i === 0 && rev.fields?.['System.CreatedDate']) {
          createdDate = new Date(rev.fields['System.CreatedDate']);
        }

        if (state && changedDate) {
          const date = new Date(changedDate);
          // Only add if this is a new state (different from the last one)
          if (stateEvents.length === 0 || stateEvents[stateEvents.length - 1].state !== state) {
            stateEvents.push({ state, date });
          }
        }
      }

      // Count state transitions
      for (const event of stateEvents) {
        stateTransitions[event.state] = (stateTransitions[event.state] || 0) + 1;
      }

      // Calculate time spent in each state
      for (let i = 0; i < stateEvents.length; i++) {
        const current = stateEvents[i];
        const next = stateEvents[i + 1];
        if (next) {
          const durationDays = (next.date.getTime() - current.date.getTime()) / (1000 * 60 * 60 * 24);
          if (!stateDurationsMap[current.state]) stateDurationsMap[current.state] = [];
          stateDurationsMap[current.state].push(durationDays);
        }
      }

      // For specific transitions, find the FIRST time the item entered each target state
      const firstStateDate: Record<string, Date> = {};
      for (const event of stateEvents) {
        if (!firstStateDate[event.state]) {
          firstStateDate[event.state] = event.date;
        }
      }

      // Measure targeted transition times
      for (const [from, to] of targetTransitions) {
        const fromDate = firstStateDate[from];
        const toDate = firstStateDate[to];
        // Only include if both dates exist and toDate is after fromDate
        if (fromDate && toDate && toDate.getTime() > fromDate.getTime()) {
          const days = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
          transitionTimesMap[`${from}->${to}`].push(days);
        }
      }

      // Cycle time: first active state → first done state
      let firstActiveDate: Date | null = null;
      for (const activeState of ACTIVE_STATES) {
        const d = firstStateDate[activeState];
        if (d && (!firstActiveDate || d < firstActiveDate)) {
          firstActiveDate = d;
        }
      }

      let firstDoneDate: Date | null = null;
      for (const doneState of DONE_STATES) {
        const d = firstStateDate[doneState];
        if (d && (!firstDoneDate || d < firstDoneDate)) {
          firstDoneDate = d;
        }
      }

      if (firstActiveDate && firstDoneDate && firstDoneDate.getTime() > firstActiveDate.getTime()) {
        cycleTimesArr.push((firstDoneDate.getTime() - firstActiveDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Lead time: created → first done state
      if (createdDate && firstDoneDate && firstDoneDate.getTime() > createdDate.getTime()) {
        leadTimesArr.push((firstDoneDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    } catch (err) {
      log.error('Failed to fetch revisions for work item', { err, workItemId: id });
    }
  }

  // Calculate averages for time in state
  const avgTimeInState: Record<string, number> = {};
  for (const [state, durations] of Object.entries(stateDurationsMap)) {
    if (durations.length > 0) {
      avgTimeInState[state] = Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10;
    }
  }

  // Calculate averages for targeted transitions
  const avgTransitionTimes: Record<string, number> = {};
  for (const [key, times] of Object.entries(transitionTimesMap)) {
    if (times.length > 0) {
      avgTransitionTimes[key] = Math.round((times.reduce((s, d) => s + d, 0) / times.length) * 10) / 10;
    }
  }

  const revisedCycleTime = cycleTimesArr.length > 0
    ? Math.round((cycleTimesArr.reduce((s, d) => s + d, 0) / cycleTimesArr.length) * 10) / 10
    : 0;

  const revisedLeadTime = leadTimesArr.length > 0
    ? Math.round((leadTimesArr.reduce((s, d) => s + d, 0) / leadTimesArr.length) * 10) / 10
    : 0;

  return { avgTimeInState, stateTransitions, avgTransitionTimes, revisedCycleTime, revisedLeadTime };
}

/**
 * Calculate trend data for multiple sprints
 */
export async function calculateSprintTrends(
  organization: string,
  project: string,
  team: string,
  sprintIds: string[],
  authHeader: string,
): Promise<SprintTrend[]> {
  const trends: SprintTrend[] = [];

  for (const sprintId of sprintIds) {
    try {
      const metrics = await calculateSprintMetrics(organization, project, team, sprintId, authHeader);
      trends.push({
        sprintId: metrics.sprintId,
        sprintName: metrics.sprintName,
        velocity: metrics.velocity.completed,
        completionRate: metrics.health.completionRate,
        scopeChange: metrics.health.scopeChange,
        bugCount: metrics.health.bugCount,
        carryOver: metrics.velocity.carried,
        startDate: metrics.startDate,
      });
    } catch (err) {
      log.error('Failed to calculate metrics for sprint', { err, sprintId });
    }
  }

  return trends.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

// Helper functions for state classification
function isCompletedState(state: string): boolean {
  // Includes standard ADO states AND common custom workflow states
  // (Development Done, Test, in UAT, UAT are treated as "done" for velocity purposes)
  const completed = [
    'Done', 'Closed', 'Resolved', 'Completed',
    'Development Done', 'Test', 'in UAT', 'UAT',
    'Deployed', 'Released', 'Accepted',
  ];
  return completed.some(s => s.toLowerCase() === state.toLowerCase());
}

function isInProgressState(state: string): boolean {
  const inProgress = [
    'Active', 'In Progress', 'Committed', 'Doing',
    'Development', 'In Development', 'Code Review', 'Testing',
  ];
  return inProgress.some(s => s.toLowerCase() === state.toLowerCase());
}

function isNotStartedState(state: string): boolean {
  const notStarted = ['New', 'To Do', 'Proposed', 'Approved', 'Ready', 'Backlog', 'Open'];
  return notStarted.some(s => s.toLowerCase() === state.toLowerCase());
}

function isRemovedState(state: string): boolean {
  const removed = ['Removed', 'Cancelled', 'Cut'];
  return removed.includes(state);
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

// ─── Velocity History ─────────────────────────────────────────────────────────

/**
 * Get velocity (completed SP) history for the last N sprints up to and including
 * the given iteration. Fetches data directly from ADO iterations.
 */
export async function getVelocityHistory(
  organization: string,
  project: string,
  team: string,
  currentIterationId: string,
  authHeader: string,
  count: number = 5,
): Promise<Array<{ sprintId: string; sprintName: string; velocity: number; plannedSP: number; startDate: string; isCurrent: boolean }>> {
  // List all iterations
  const allSprints = await listSprints(organization, project, team, authHeader);

  // Find the current sprint's index
  const currentIndex = allSprints.findIndex(s => s.id === currentIterationId);
  if (currentIndex === -1) return [];

  // Get the previous (count-1) sprints + current
  const start = Math.max(0, currentIndex - (count - 1));
  const selectedSprints = allSprints.slice(start, currentIndex + 1);

  const results: Array<{ sprintId: string; sprintName: string; velocity: number; plannedSP: number; startDate: string; isCurrent: boolean }> = [];

  for (const sprint of selectedSprints) {
    try {
      const items = await getWorkItemListForIteration(organization, project, team, sprint.id, authHeader);
      let plannedSP = 0;
      let completedSP = 0;

      for (const item of items) {
        const sp = item.storyPoints || 0;
        if (!isRemovedState(item.state)) {
          plannedSP += sp;
        }
        if (isCompletedState(item.state)) {
          completedSP += sp;
        }
      }

      results.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        velocity: completedSP,
        plannedSP,
        startDate: sprint.startDate || '',
        isCurrent: sprint.id === currentIterationId,
      });
    } catch (err) {
      log.error('Failed to fetch velocity for sprint', { err, sprintName: sprint.name });
    }
  }

  return results;
}

// ─── PAT Validation ───────────────────────────────────────────────────────────

/**
 * Validates a PAT by calling the ADO profile endpoint.
 * Returns `true` if the token is accepted, `false` otherwise.
 */
export async function validatePat(pat: string): Promise<boolean> {
  const res = await fetch(
    'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
    {
      headers: {
        Authorization: patAuthHeader(pat),
        Accept: 'application/json',
      },
    },
  );
  return res.ok;
}
