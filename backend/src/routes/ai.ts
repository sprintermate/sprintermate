import { Router } from 'express';
import { randomUUID } from 'crypto';
import requireAuth from '../middleware/requireAuth';
import { UserAISettings, Room, Project, Sprint, ReferenceScore } from '../db/schema';
import { encrypt, decrypt } from '../utils/crypto';
import {
  callAI,
  testAIConnection,
  buildEstimationPrompt,
  extractJSON,
  type ReferenceScoreItem,
  type PreviousSprintItem,
} from '../services/aiService';
import {
  listSprints,
  getWorkItemsForIteration,
  patAuthHeader,
} from '../services/azDevops';

const router = Router();

const CLI_PROVIDERS = new Set(['claude', 'copilot', 'codex']);
const API_PROVIDERS = new Set(['gemini', 'chatgpt']);
const ALL_PROVIDERS = new Set([...CLI_PROVIDERS, ...API_PROVIDERS]);

// ─── GET /api/ai/settings ─────────────────────────────────────────────────────
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const settings = await UserAISettings.findOne({ where: { user_id: userId } });

    if (!settings) {
      res.json({ provider: null, hasApiKey: false });
      return;
    }

    res.json({
      provider: settings.provider,
      hasApiKey: !!settings.encrypted_api_key,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to get AI settings' });
  }
});

// ─── PUT /api/ai/settings ─────────────────────────────────────────────────────
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };

    if (!provider || !ALL_PROVIDERS.has(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${[...ALL_PROVIDERS].join(', ')}` });
      return;
    }

    if (API_PROVIDERS.has(provider) && !apiKey) {
      res.status(400).json({ error: `An API key is required for provider: ${provider}` });
      return;
    }

    let encryptedApiKey: string | null = null;
    if (apiKey) {
      encryptedApiKey = encrypt(apiKey);
    }

    const existing = await UserAISettings.findOne({ where: { user_id: userId } });
    if (existing) {
      existing.provider = provider;
      existing.encrypted_api_key = encryptedApiKey;
      await existing.save();
    } else {
      await UserAISettings.create({
        id: randomUUID(),
        user_id: userId,
        provider,
        encrypted_api_key: encryptedApiKey,
        created_at: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to save AI settings' });
  }
});

// ─── POST /api/ai/test ────────────────────────────────────────────────────────
router.post('/test', requireAuth, async (req, res) => {
  try {
    const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };

    if (!provider || !ALL_PROVIDERS.has(provider)) {
      res.status(400).json({ success: false, error: 'Invalid provider' });
      return;
    }

    if (API_PROVIDERS.has(provider) && !apiKey) {
      res.status(400).json({ success: false, error: `API key required for ${provider}` });
      return;
    }

    await testAIConnection(provider, apiKey ?? null);
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message ?? 'AI test failed' });
  }
});

// ─── POST /api/ai/estimate ────────────────────────────────────────────────────
router.post('/estimate', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { roomCode, workItemId, locale } = req.body as { roomCode?: string; workItemId?: number; locale?: string };

    if (!roomCode || workItemId === undefined) {
      res.status(400).json({ error: 'roomCode and workItemId are required' });
      return;
    }

    // Load user AI settings
    const aiSettings = await UserAISettings.findOne({ where: { user_id: userId } });
    if (!aiSettings) {
      res.status(400).json({ error: 'No AI provider configured. Please configure AI settings first.' });
      return;
    }

    let apiKey: string | null = null;
    if (aiSettings.encrypted_api_key) {
      apiKey = decrypt(aiSettings.encrypted_api_key);
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

    // Load current sprint work items to find the work item to estimate
    const currentSprintItems = await getWorkItemsForIteration(
      project.organization,
      project.name,
      project.team ?? project.name,
      sprint.ado_sprint_id,
      authHeader,
    );

    const workItem = currentSprintItems.find((wi) => wi.id === Number(workItemId));
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

      // Find the sprint immediately before the current one
      const currentIdx = allSprints.findIndex((s) => s.id === sprint.ado_sprint_id);
      const prevSprint = currentIdx > 0 ? allSprints[currentIdx - 1] : null;

      if (prevSprint) {
        const prevItems = await getWorkItemsForIteration(
          project.organization,
          project.name,
          project.team ?? project.name,
          prevSprint.id,
          authHeader,
        );

        const adoBase = `https://dev.azure.com/${encodeURIComponent(project.organization)}/${encodeURIComponent(project.name)}/_workitems/edit`;

        for (const item of prevItems) {
          if (item.storyPoints !== null) {
            previousSprintItems.push({
              id: item.id,
              title: item.title,
              description: item.description,
              storyPoints: item.storyPoints,
              adoUrl: `${adoBase}/${item.id}`,
            });
          }
        }
      }
    } catch {
      // Previous sprint data is optional — estimation can proceed without it
    }

    // Build prompt and call AI
    const prompt = buildEstimationPrompt(workItem, referenceScores, previousSprintItems, locale);
    const raw = await callAI(aiSettings.provider, apiKey, prompt);
    const result = extractJSON(raw);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'AI estimation failed' });
  }
});

export default router;
