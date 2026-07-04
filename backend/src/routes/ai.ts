import { Router } from 'express';
import { randomUUID } from 'crypto';
import { UniqueConstraintError } from 'sequelize';
import { childLogger } from '../utils/logger';

const log = childLogger('ai');
import requireAuth from '../middleware/requireAuth';
import aiRateLimit from '../middleware/aiRateLimit';
import requireExternalApiKey from '../middleware/externalApiAuth';
import { UserAISettings, Room, Project, Sprint, ReferenceScore, WorkItemAIEstimate } from '../db/schema';
import { encrypt, decrypt } from '../utils/crypto';
import {
  callAI,
  testAIConnection,
  buildEstimationPrompt,
  extractJSON,
  getProductionAISettings,
  type AIEstimateResult,
  type AzureAIOptions,
  type ReferenceScoreItem,
  type PreviousSprintItem,
} from '../services/aiService';
import {
  listSprints,
  getWorkItemsForIteration,
  getWorkItemDetail,
  patAuthHeader,
  buildWorkItemUrl,
  type AdoWorkItem,
} from '../services/azDevops';
import { getIO } from '../socket/ioInstance';

const router = Router();

const CLI_PROVIDERS = new Set(['claude', 'copilot', 'codex']);
const API_PROVIDERS = new Set(['gemini', 'chatgpt', 'azure-openai']);
const ALL_PROVIDERS = new Set([...CLI_PROVIDERS, ...API_PROVIDERS]);

// ─── In-memory estimation lock ────────────────────────────────────────────────
// Prevents double-estimation: projectId → Set of workItemIds currently being estimated
const estimatingLock = new Map<string, Set<number>>();

// Rooms where estimate-all has been cancelled
const cancelledRooms = new Set<string>();

function lockItem(projectId: string, workItemId: number): void {
  if (!estimatingLock.has(projectId)) estimatingLock.set(projectId, new Set());
  estimatingLock.get(projectId)!.add(workItemId);
}

function unlockItem(projectId: string, workItemId: number): void {
  estimatingLock.get(projectId)?.delete(workItemId);
}

function isLocked(projectId: string, workItemId: number): boolean {
  return estimatingLock.get(projectId)?.has(workItemId) ?? false;
}

// ─── Helper: persist AI estimate result to DB (upsert) ───────────────────────
async function persistEstimate(projectId: string, workItemId: number, result: AIEstimateResult): Promise<void> {
  const now = new Date().toISOString();
  const fieldsToUpdate = {
    story_point: result['story-point'],
    confidence: result.confidence,
    analysis: result.analysis,
    similar_items: JSON.stringify(result['similar-items']),
    updated_at: now,
  };

  // UPDATE first (avoids full-model validation that save() triggers, and handles
  // the common case of re-estimating an existing item atomically).
  const [affectedRows] = await WorkItemAIEstimate.update(fieldsToUpdate as any, {
    where: { project_id: projectId, work_item_id: workItemId },
  });

  if (affectedRows === 0) {
    // No existing record – try to INSERT it.
    try {
      await WorkItemAIEstimate.create({
        id: randomUUID(),
        project_id: projectId,
        work_item_id: workItemId,
        ...fieldsToUpdate,
        created_at: now,
      } as any);
    } catch (err: any) {
      // Race condition: a concurrent request (e.g. estimate-all batch + single estimate)
      // inserted between our UPDATE and this INSERT. Retry the update.
      if (err instanceof UniqueConstraintError) {
        await WorkItemAIEstimate.update(fieldsToUpdate as any, {
          where: { project_id: projectId, work_item_id: workItemId },
        });
      } else {
        throw err;
      }
    }
  }
}

// ─── GET /api/ai/settings ─────────────────────────────────────────────────────
router.get('/settings', requireAuth, async (req, res) => {
  try {
    // If server-level AI env vars are set, reflect them directly (works in any NODE_ENV)
    const serverSettings = getProductionAISettings();
    if (serverSettings) {
      res.json({
        provider: serverSettings.provider,
        hasApiKey: true,
        serverManaged: true,
        // Expose non-secret Azure fields so the UI can display them
        ...(serverSettings.azureOptions ? {
          hasEndpoint: true,
          azureOrganization: serverSettings.azureOptions.organization ?? null,
          azureApiVersion: serverSettings.azureOptions.apiVersion,
          azureDeploymentName: serverSettings.azureOptions.deploymentName,
        } : {}),
      });
      return;
    }

    const userId = req.user!.id;
    const settings = await UserAISettings.findOne({ where: { user_id: userId } });

    if (!settings) {
      res.json({ provider: null, hasApiKey: false });
      return;
    }

    res.json({
      provider: settings.provider,
      hasApiKey: !!settings.encrypted_api_key,
      // Azure-specific fields (endpoint is secret — only expose existence flag)
      hasEndpoint: !!settings.encrypted_endpoint,
      azureOrganization: settings.azure_organization ?? null,
      azureApiVersion: settings.azure_api_version ?? null,
      azureDeploymentName: settings.azure_deployment_name ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to get AI settings' });
  }
});

// ─── PUT /api/ai/settings ─────────────────────────────────────────────────────
router.put('/settings', requireAuth, async (req, res) => {
  if (getProductionAISettings()) {
    res.status(403).json({ error: 'AI provider configuration is managed by server environment variables.' });
    return;
  }
  try {
    const userId = req.user!.id;
    const {
      provider,
      apiKey,
      azureEndpoint,
      azureOrganization,
      azureApiVersion,
      azureDeploymentName,
    } = req.body as {
      provider?: string;
      apiKey?: string;
      azureEndpoint?: string;
      azureOrganization?: string;
      azureApiVersion?: string;
      azureDeploymentName?: string;
    };

    if (!provider || !ALL_PROVIDERS.has(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${[...ALL_PROVIDERS].join(', ')}` });
      return;
    }

    if (API_PROVIDERS.has(provider) && !apiKey) {
      res.status(400).json({ error: `An API key is required for provider: ${provider}` });
      return;
    }

    if (provider === 'azure-openai') {
      if (!azureEndpoint) {
        res.status(400).json({ error: 'Azure endpoint URL is required for Azure OpenAI' });
        return;
      }
      if (!azureDeploymentName) {
        res.status(400).json({ error: 'Azure deployment name is required for Azure OpenAI' });
        return;
      }
      if (!azureApiVersion) {
        res.status(400).json({ error: 'Azure API version is required for Azure OpenAI' });
        return;
      }
    }

    let encryptedApiKey: string | null = null;
    if (apiKey) {
      encryptedApiKey = encrypt(apiKey);
    }

    // Encrypt endpoint only for Azure; clear Azure columns for other providers
    let encryptedEndpoint: string | null = null;
    let orgValue: string | null = null;
    let apiVersionValue: string | null = null;
    let deploymentValue: string | null = null;
    if (provider === 'azure-openai') {
      encryptedEndpoint = azureEndpoint ? encrypt(azureEndpoint) : null;
      orgValue = azureOrganization ?? null;
      apiVersionValue = azureApiVersion ?? null;
      deploymentValue = azureDeploymentName ?? null;
    }

    const existing = await UserAISettings.findOne({ where: { user_id: userId } });
    if (existing) {
      existing.provider = provider;
      existing.encrypted_api_key = encryptedApiKey;
      existing.encrypted_endpoint = encryptedEndpoint;
      existing.azure_organization = orgValue;
      existing.azure_api_version = apiVersionValue;
      existing.azure_deployment_name = deploymentValue;
      await existing.save();
    } else {
      await UserAISettings.create({
        id: randomUUID(),
        user_id: userId,
        provider,
        encrypted_api_key: encryptedApiKey,
        encrypted_endpoint: encryptedEndpoint,
        azure_organization: orgValue,
        azure_api_version: apiVersionValue,
        azure_deployment_name: deploymentValue,
        created_at: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to save AI settings' });
  }
});

// ─── POST /api/ai/test ────────────────────────────────────────────────────────
router.post('/test', requireAuth, aiRateLimit, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ success: false, error: 'AI provider testing is not available in production.' });
    return;
  }  try {
    const {
      provider,
      apiKey,
      azureEndpoint,
      azureOrganization,
      azureApiVersion,
      azureDeploymentName,
    } = req.body as {
      provider?: string;
      apiKey?: string;
      azureEndpoint?: string;
      azureOrganization?: string;
      azureApiVersion?: string;
      azureDeploymentName?: string;
    };

    if (!provider || !ALL_PROVIDERS.has(provider)) {
      res.status(400).json({ success: false, error: 'Invalid provider' });
      return;
    }

    if (API_PROVIDERS.has(provider) && !apiKey) {
      res.status(400).json({ success: false, error: `API key required for ${provider}` });
      return;
    }

    let azureOptions: AzureAIOptions | undefined;
    if (provider === 'azure-openai') {
      if (!azureEndpoint || !azureDeploymentName || !azureApiVersion) {
        res.status(400).json({ success: false, error: 'Azure endpoint, deployment name, and API version are required' });
        return;
      }
      azureOptions = {
        endpoint: azureEndpoint,
        deploymentName: azureDeploymentName,
        apiVersion: azureApiVersion,
        organization: azureOrganization,
      };
    }

    await testAIConnection(provider, apiKey ?? null, azureOptions);
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message ?? 'AI test failed' });
  }
});

// ─── POST /api/ai/estimate ────────────────────────────────────────────────────
// No requireAuth — guest delegated moderators call this using the room owner's AI settings.
router.post('/estimate', aiRateLimit, async (req, res) => {
  let projectId: string | null = null;
  let workItemIdNum: number | null = null;

  try {
    const userId = req.user?.id ?? null;
    const { roomCode, workItemId, locale } = req.body as { roomCode?: string; workItemId?: number; locale?: string };

    if (!roomCode || workItemId === undefined) {
      res.status(400).json({ error: 'roomCode and workItemId are required' });
      return;
    }

    // Resolve AI provider and key (production: use env; dev: use user or room-owner settings)
    let provider: string;
    let apiKey: string | null;
    let azureOptions: AzureAIOptions | undefined;

    const prodSettings = getProductionAISettings();
    if (prodSettings) {
      provider = prodSettings.provider;
      apiKey = prodSettings.apiKey;
      azureOptions = prodSettings.azureOptions;
    } else {
      // First try the logged-in user's settings, then fall back to the room owner's settings
      // (needed when a guest delegated moderator calls this endpoint).
      let aiSettings = userId
        ? await UserAISettings.findOne({ where: { user_id: userId } })
        : null;

      if (!aiSettings) {
        // Fetch the room to find the original owner
        const roomForOwner = await Room.findOne({ where: { code: roomCode } });
        if (roomForOwner) {
          aiSettings = await UserAISettings.findOne({ where: { user_id: roomForOwner.moderator_id } });
        }
      }

      if (!aiSettings) {
        res.status(400).json({ error: 'No AI provider configured. Please configure AI settings first.' });
        return;
      }
      provider = aiSettings.provider;
      apiKey = aiSettings.encrypted_api_key ? decrypt(aiSettings.encrypted_api_key) : null;

      if (provider === 'azure-openai') {
        if (!aiSettings.encrypted_endpoint || !aiSettings.azure_deployment_name || !aiSettings.azure_api_version) {
          res.status(400).json({ error: 'Azure OpenAI settings are incomplete. Please reconfigure AI settings.' });
          return;
        }
        azureOptions = {
          endpoint: decrypt(aiSettings.encrypted_endpoint),
          deploymentName: aiSettings.azure_deployment_name,
          apiVersion: aiSettings.azure_api_version,
          organization: aiSettings.azure_organization ?? undefined,
        };
      }
    }

    // Load room, then its associated project and sprint
    const room = await Room.findOne({ where: { code: roomCode } });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const [projectRow, sprintRow] = await Promise.all([
      Project.findOne({ where: { id: room.project_id } }),
      Sprint.findOne({ where: { id: room.sprint_id } }),
    ]);

    if (!projectRow || !sprintRow) {
      res.status(400).json({ error: 'Room has no associated project or sprint' });
      return;
    }

    const project = projectRow.get({ plain: true }) as any;
    const sprint = sprintRow.get({ plain: true }) as any;

    projectId = project.id;
    workItemIdNum = Number(workItemId);

    if (!sprint.ado_sprint_id) {
      res.status(422).json({ error: 'Sprint has no ADO iteration ID — cannot fetch work items for estimation' });
      return;
    }

    // Get project ADO auth
    let authHeader: string;
    if (project.encrypted_pat) {
      try {
        const pat = decrypt(project.encrypted_pat);
        authHeader = patAuthHeader(pat);
      } catch {
        res.status(500).json({ error: 'Failed to decrypt project credentials' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Project has no Azure DevOps credentials (PAT required for AI estimation)' });
      return;
    }

    // Lock this item so batch estimation skips it
    lockItem(project.id, workItemIdNum);

    // Load current sprint work items to find the work item to estimate
    const currentSprintItems = await getWorkItemsForIteration(
      project.organization,
      project.name,
      project.team ?? project.name,
      sprint.ado_sprint_id,
      authHeader,
      roomCode,
    );

    const workItem = currentSprintItems.find((wi) => wi.id === workItemIdNum);
    if (!workItem) {
      res.status(404).json({ error: `Work item ${workItemId} not found in current sprint` });
      return;
    }

    // Load reference scores for the project
    const refScoreRows = await ReferenceScore.findAll({
      where: { project_id: room.project_id },
      order: [['story_points', 'ASC']],
    });
    const referenceScores: ReferenceScoreItem[] = refScoreRows.map((r: any) => ({
      title: r.title,
      description: r.description,
      story_points: r.story_points,
    }));

    // Fetch previous sprint work items for context
    const previousSprintItems: PreviousSprintItem[] = [];
    try {
      const allSprints = await listSprints(
        project.organization,
        project.name,
        project.team ?? project.name,
        authHeader,
      );

      // Find the index of the current sprint
      const currentIdx = allSprints.findIndex((s) => s.id === sprint.ado_sprint_id);
      // Get previous sprints (limit depends on environment)
      const sprintHistoryLimit = process.env.NODE_ENV === 'production' ? 5 : 10;
      const prevSprints = (currentIdx > 0)
        ? allSprints.slice(Math.max(0, currentIdx - sprintHistoryLimit), currentIdx)
        : [];

      const isVisualStudio = req.headers['referer']?.includes('.visualstudio.com') || project.ado_url?.includes('.visualstudio.com');

      for (const prevSprint of prevSprints) {
        const prevItems = await getWorkItemsForIteration(
          project.organization,
          project.name,
          project.team ?? project.name,
          prevSprint.id,
          authHeader,
          roomCode,
        );
        for (const item of prevItems) {
          if (item.storyPoints !== null) {
            previousSprintItems.push({
              id: item.id,
              title: item.title,
              description: item.description,
              storyPoints: item.storyPoints,
              adoUrl: buildWorkItemUrl(
                project.organization,
                project.name,
                item.id,
                { visualStudio: !!isVisualStudio }
              ),
            });
          }
        }
      }
    } catch {
      // Previous sprint data is optional — estimation can proceed without it
    }

    // Build prompt and call AI
    const prompt = buildEstimationPrompt(workItem, referenceScores, previousSprintItems, locale);
    const raw = await callAI(provider, apiKey, prompt, azureOptions);
    const result = extractJSON(raw);

    // Persist result to DB
    await persistEstimate(project.id, workItemIdNum, result);

    res.json(result);
  } catch (err: any) {
    log.error('estimate error', { err, name: err?.name, errors: err?.errors });
    res.status(500).json({ error: err.message ?? 'AI estimation failed' });
  } finally {
    if (projectId !== null && workItemIdNum !== null) {
      unlockItem(projectId, workItemIdNum);
    }
  }
});

// ─── POST /api/ai/estimate/external ──────────────────────────────────────────
// Headless endpoint gated by a shared secret (X-Api-Key header — see
// middleware/externalApiAuth.ts) instead of a Sprintermate login. Lets an
// external caller supply an ADO PAT + organization + project + work item id
// directly and receive the same AIEstimateResult JSON shape produced by the
// in-app estimation flow above.
router.post('/estimate/external', requireExternalApiKey, aiRateLimit, async (req, res) => {
  let lockedProjectId: string | null = null;
  let workItemIdNum: number | null = null;

  try {
    const { pat, organization, project, workItemId, locale } = req.body as {
      pat?: string;
      organization?: string;
      project?: string;
      workItemId?: number;
      locale?: string;
    };

    if (!pat || !organization || !project || workItemId === undefined) {
      res.status(400).json({ error: 'pat, organization, project, and workItemId are required' });
      return;
    }

    workItemIdNum = Number(workItemId);
    if (!Number.isFinite(workItemIdNum) || workItemIdNum <= 0) {
      res.status(400).json({ error: 'Invalid work item id' });
      return;
    }

    // The provided PAT is used only in-memory for this request — never logged or persisted.
    const authHeader = patAuthHeader(pat);

    // Fetch the work item directly — no sprint/iteration lookup needed.
    let workItem: AdoWorkItem;
    try {
      workItem = await getWorkItemDetail(organization, project, workItemIdNum, authHeader);
    } catch (err: any) {
      res.status(502).json({ error: err.message ?? 'Failed to fetch work item from Azure DevOps' });
      return;
    }

    // Best-effort match against an existing Sprintermate project, to reuse its
    // reference-score calibration anchors and (if no server AI is configured)
    // its owner's AI provider settings. Previous-sprint history is intentionally
    // skipped here — there's no bound Sprint to know which sprints precede this
    // work item.
    const matchedProjectRow = await Project.findOne({ where: { organization, name: project } });
    const matchedProject = matchedProjectRow ? (matchedProjectRow.get({ plain: true }) as any) : null;

    if (matchedProject) {
      lockedProjectId = matchedProject.id;
      lockItem(matchedProject.id, workItemIdNum);
    }

    // Resolve AI provider and key: server env first, else the matched project owner's settings.
    let provider: string;
    let apiKey: string | null;
    let azureOptions: AzureAIOptions | undefined;

    const prodSettings = getProductionAISettings();
    if (prodSettings) {
      provider = prodSettings.provider;
      apiKey = prodSettings.apiKey;
      azureOptions = prodSettings.azureOptions;
    } else if (matchedProject) {
      const aiSettings = await UserAISettings.findOne({ where: { user_id: matchedProject.user_id } });
      if (!aiSettings) {
        res.status(400).json({ error: 'No AI provider configured for the matched Sprintermate project owner, and no server-wide provider is set.' });
        return;
      }
      provider = aiSettings.provider;
      apiKey = aiSettings.encrypted_api_key ? decrypt(aiSettings.encrypted_api_key) : null;

      if (provider === 'azure-openai') {
        if (!aiSettings.encrypted_endpoint || !aiSettings.azure_deployment_name || !aiSettings.azure_api_version) {
          res.status(400).json({ error: 'Azure OpenAI settings are incomplete for the matched project owner.' });
          return;
        }
        azureOptions = {
          endpoint: decrypt(aiSettings.encrypted_endpoint),
          deploymentName: aiSettings.azure_deployment_name,
          apiVersion: aiSettings.azure_api_version,
          organization: aiSettings.azure_organization ?? undefined,
        };
      }
    } else {
      res.status(400).json({ error: 'No AI provider configured on the server, and no matching Sprintermate project was found to source AI settings from.' });
      return;
    }

    // Reference scores (calibration anchors) — only available when a matching project exists.
    let referenceScores: ReferenceScoreItem[] = [];
    if (matchedProject) {
      const refScoreRows = await ReferenceScore.findAll({
        where: { project_id: matchedProject.id },
        order: [['story_points', 'ASC']],
      });
      referenceScores = refScoreRows.map((r: any) => ({
        title: r.title,
        description: r.description,
        story_points: r.story_points,
      }));
    }

    // Build prompt and call AI (no previous-sprint history for this endpoint — see comment above).
    const prompt = buildEstimationPrompt(workItem, referenceScores, [], locale);
    const raw = await callAI(provider, apiKey, prompt, azureOptions);
    const result = extractJSON(raw);

    // Persist only when we found a real Sprintermate project to associate it with.
    if (matchedProject) {
      await persistEstimate(matchedProject.id, workItemIdNum, result);
    }

    res.json(result);
  } catch (err: any) {
    log.error('estimate external error', { err, name: err?.name, errors: err?.errors });
    res.status(500).json({ error: err.message ?? 'AI estimation failed' });
  } finally {
    if (lockedProjectId !== null && workItemIdNum !== null) {
      unlockItem(lockedProjectId, workItemIdNum);
    }
  }
});

// ─── GET /api/ai/estimates ────────────────────────────────────────────────────
router.get('/estimates', requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { roomCode } = req.query as { roomCode?: string };
    if (!roomCode) {
      res.status(400).json({ error: 'roomCode is required' });
      return;
    }

    const room = await Room.findOne({ where: { code: roomCode } });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const rows = await WorkItemAIEstimate.findAll({
      where: { project_id: room.project_id },
    });

    const estimates = rows.map((r: any) => {
      const plain = r.get({ plain: true });
      return {
        workItemId: plain.work_item_id,
        estimate: {
          'story-point': plain.story_point,
          confidence: plain.confidence,
          analysis: plain.analysis,
          'similar-items': JSON.parse(plain.similar_items ?? '[]'),
        } as AIEstimateResult,
      };
    });

    res.json(estimates);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to load estimates' });
  }
});

// ─── POST /api/ai/estimate-all ────────────────────────────────────────────────
router.post('/estimate-all', requireAuth, aiRateLimit, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { roomCode, locale } = req.body as { roomCode?: string; locale?: string };

    if (!roomCode) {
      res.status(400).json({ error: 'roomCode is required' });
      return;
    }

    // Resolve AI provider and key (production: use env; dev: use user settings)
    let provider: string;
    let apiKey: string | null;
    let azureOptions: AzureAIOptions | undefined;

    const prodSettings = getProductionAISettings();
    if (prodSettings) {
      provider = prodSettings.provider;
      apiKey = prodSettings.apiKey;
      azureOptions = prodSettings.azureOptions;
    } else {
      const aiSettings = await UserAISettings.findOne({ where: { user_id: userId } });
      if (!aiSettings) {
        res.status(400).json({ error: 'No AI provider configured. Please configure AI settings first.' });
        return;
      }
      provider = aiSettings.provider;
      apiKey = aiSettings.encrypted_api_key ? decrypt(aiSettings.encrypted_api_key) : null;

      if (provider === 'azure-openai') {
        if (!aiSettings.encrypted_endpoint || !aiSettings.azure_deployment_name || !aiSettings.azure_api_version) {
          res.status(400).json({ error: 'Azure OpenAI settings are incomplete. Please reconfigure AI settings.' });
          return;
        }
        azureOptions = {
          endpoint: decrypt(aiSettings.encrypted_endpoint),
          deploymentName: aiSettings.azure_deployment_name,
          apiVersion: aiSettings.azure_api_version,
          organization: aiSettings.azure_organization ?? undefined,
        };
      }
    }

    const room = await Room.findOne({ where: { code: roomCode } });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const [projectRow, sprintRow] = await Promise.all([
      Project.findOne({ where: { id: room.project_id } }),
      Sprint.findOne({ where: { id: room.sprint_id } }),
    ]);

    if (!projectRow || !sprintRow) {
      res.status(400).json({ error: 'Room has no associated project or sprint' });
      return;
    }

    const project = projectRow.get({ plain: true }) as any;
    const sprint = sprintRow.get({ plain: true }) as any;

    if (!sprint.ado_sprint_id) {
      res.status(422).json({ error: 'Sprint has no ADO iteration ID' });
      return;
    }

    if (!project.encrypted_pat) {
      res.status(400).json({ error: 'Project has no Azure DevOps credentials (PAT required)' });
      return;
    }

    let authHeader: string;
    try {
      authHeader = patAuthHeader(decrypt(project.encrypted_pat));
    } catch {
      res.status(500).json({ error: 'Failed to decrypt project credentials' });
      return;
    }

    // Fetch all work items for this sprint
    const allItems = await getWorkItemsForIteration(
      project.organization,
      project.name,
      project.team ?? project.name,
      sprint.ado_sprint_id,
      authHeader,
    );

    // Get already-estimated work item IDs from DB
    const existingRows = await WorkItemAIEstimate.findAll({
      where: { project_id: project.id },
      attributes: ['work_item_id'],
    });
    const estimatedIds = new Set(
      existingRows.map((r: any) => r.get({ plain: true }).work_item_id as number)
    );

    // Filter: skip already estimated and currently locked items
    const toEstimate = allItems.filter(
      (wi) => !estimatedIds.has(wi.id) && !isLocked(project.id, wi.id)
    );

    const skipped = allItems.length - toEstimate.length;

    // Respond immediately — batch runs in background
    res.json({ queued: toEstimate.length, skipped });

    cancelledRooms.delete(roomCode); // clear any stale cancel from previous run

    if (toEstimate.length > 0) {
      void runBatchEstimation({
        items: toEstimate,
        project,
        sprint,
        roomCode,
        provider,
        apiKey,
        azureOptions,
        authHeader,
        locale,
      });
    } else {
      // Nothing to do — emit complete immediately
      try {
        getIO().to(roomCode).emit('ai:estimate_all_complete', {});
      } catch {
        // socket may not be ready in tests
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to start batch estimation' });
  }
});

// ─── POST /api/ai/estimate-all/cancel ────────────────────────────────────────
router.post('/estimate-all/cancel', requireAuth, aiRateLimit, async (req, res) => {
  const { roomCode } = req.body as { roomCode?: string };
  if (!roomCode) {
    res.status(400).json({ error: 'roomCode is required' });
    return;
  }
  cancelledRooms.add(roomCode);
  try {
    getIO().to(roomCode).emit('ai:estimate_all_complete', {});
  } catch { /* socket may not be ready in tests */ }
  res.json({ cancelled: true });
});

// ─── Batch estimation runner ──────────────────────────────────────────────────
interface BatchEstimationOpts {
  items: AdoWorkItem[];
  project: any;
  sprint: any;
  roomCode: string;
  provider: string;
  apiKey: string | null;
  azureOptions?: AzureAIOptions;
  authHeader: string;
  locale?: string;
}

async function runBatchEstimation(opts: BatchEstimationOpts): Promise<void> {
  const { items, project, sprint, roomCode, provider, apiKey, azureOptions, authHeader, locale } = opts;
  const io = getIO();
  const BATCH_SIZE = 3;

  // Fetch previous sprint context once for the whole batch (performance optimisation)
  const previousSprintItems: PreviousSprintItem[] = [];
  try {
    const allSprints = await listSprints(
      project.organization,
      project.name,
      project.team ?? project.name,
      authHeader,
    );
    const currentIdx = allSprints.findIndex((s) => s.id === sprint.ado_sprint_id);
    const prevSprints = currentIdx > 0
      ? allSprints.slice(Math.max(0, currentIdx - 10), currentIdx)
      : [];

    for (const prevSprint of prevSprints) {
      const prevItems = await getWorkItemsForIteration(
        project.organization,
        project.name,
        project.team ?? project.name,
        prevSprint.id,
        authHeader,
      );
      for (const item of prevItems) {
        if (item.storyPoints !== null) {
          previousSprintItems.push({
            id: item.id,
            title: item.title,
            description: item.description,
            storyPoints: item.storyPoints,
            adoUrl: buildWorkItemUrl(project.organization, project.name, item.id, { visualStudio: false }),
          });
        }
      }
    }
  } catch {
    // Previous sprint data is optional
  }

  // Fetch reference scores once
  const refScoreRows = await ReferenceScore.findAll({
    where: { project_id: project.id },
    order: [['story_points', 'ASC']],
  });
  const referenceScores: ReferenceScoreItem[] = refScoreRows.map((r: any) => ({
    title: r.title,
    description: r.description,
    story_points: r.story_points,
  }));

  // Process in chunks of BATCH_SIZE
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    if (cancelledRooms.has(roomCode)) {
      cancelledRooms.delete(roomCode); // clean up
      return; // stop processing — cancel endpoint already emitted complete
    }
    const batch = items.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (workItem) => {
      // Skip if it got individually locked or already estimated since we queued it
      if (isLocked(project.id, workItem.id)) return;
      const alreadyDone = await WorkItemAIEstimate.findOne({
        where: { project_id: project.id, work_item_id: workItem.id },
      });
      if (alreadyDone) return;

      lockItem(project.id, workItem.id);
      io.to(roomCode).emit('ai:estimate_start', { workItemId: workItem.id });

      try {
        const prompt = buildEstimationPrompt(workItem, referenceScores, previousSprintItems, locale);
        const raw = await callAI(provider, apiKey, prompt, azureOptions);
        const result = extractJSON(raw);

        await persistEstimate(project.id, workItem.id, result);
        io.to(roomCode).emit('ai:estimate_complete', { workItemId: workItem.id, estimate: result });
      } catch (err) {
        io.to(roomCode).emit('ai:estimate_error', { workItemId: workItem.id, error: String(err) });
      } finally {
        unlockItem(project.id, workItem.id);
      }
    }));
  }

  cancelledRooms.delete(roomCode); // clean up on normal completion
  io.to(roomCode).emit('ai:estimate_all_complete', {});
}

export default router;
