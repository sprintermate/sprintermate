import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import requireAuth from '../middleware/requireAuth';
import { UserAISettings } from '../db/schema';
import RetroSession from '../db/models/RetroSession';
import RetroItem from '../db/models/RetroItem';
import RetroAction from '../db/models/RetroAction';
import { callAIText } from '../services/aiService';
import { decrypt } from '../utils/crypto';
import { getIO } from '../socket/ioInstance';

const router = Router();

function generateRetroCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

// ─── Build retro AI analysis prompt ──────────────────────────────────────────
function buildRetroPrompt(
  items: Array<{ category: string; content: string }>,
  previousActions: Array<{ content: string }>,
  locale: string,
): string {
  const language = locale === 'tr' ? 'Turkish' : 'English';
  const lines: string[] = [];

  lines.push('You are an enthusiastic, witty Agile coach who truly cares about the team. Your tone is warm, encouraging, and occasionally humorous — like a great coach who keeps the retrospective energetic and insightful.');
  lines.push('');

  const wellItems = items.filter(i => i.category === 'well');
  const improveItems = items.filter(i => i.category === 'improve');
  const ideasItems = items.filter(i => i.category === 'ideas');

  lines.push('## This Sprint\'s Retrospective Items');
  lines.push('');

  if (wellItems.length > 0) {
    lines.push('### 🎉 What Went Well');
    wellItems.forEach(i => lines.push(`- ${i.content}`));
    lines.push('');
  }

  if (improveItems.length > 0) {
    lines.push('### 🔧 What Could Be Improved');
    improveItems.forEach(i => lines.push(`- ${i.content}`));
    lines.push('');
  }

  if (ideasItems.length > 0) {
    lines.push('### 💡 Ideas for Next Sprint');
    ideasItems.forEach(i => lines.push(`- ${i.content}`));
    lines.push('');
  }

  if (previousActions.length > 0) {
    lines.push('## 📋 Actions the Team Committed to in Previous Sprints');
    lines.push('(Use these to identify what improved, what is still recurring, and what is brand new this sprint.)');
    previousActions.forEach((a, idx) => lines.push(`${idx + 1}. ${a.content}`));
    lines.push('');
    lines.push('**Trend Analysis Instructions:**');
    lines.push('- Identify which previous actions actually show up as "What Went Well" or are no longer problems (IMPROVED ✅)');
    lines.push('- Identify which problems from previous actions are STILL appearing in "What Could Be Improved" (RECURRING 🔁)');
    lines.push('- Flag completely new themes that were never mentioned before (NEW 🆕)');
    lines.push('');
  }

  lines.push('## Your Task');
  lines.push(`Write ALL output text in ${language}.`);
  lines.push('');
  lines.push('1. Write a **summary**: 2-3 fun, memorable sentences that capture this sprint\'s story. Celebrate wins. Be honest about struggles. Make it human.');
  lines.push('');
  lines.push('2. Write a **trend_analysis**: Compare this retro with the previous actions context. Mention specific recurring issues, genuine improvements, and fresh challenges. Use emoji labels: ✅ for improved, 🔁 for recurring, 🆕 for new. If no previous actions exist, comment on the team\'s first retro patterns. Make it insightful and slightly cheeky.');
  lines.push('');
  lines.push('3. Generate **3-7 action items**: Concrete, specific, and achievable. Each action should name the WHAT and ideally the HOW. Prioritize addressing recurring issues if any. At least one action should celebrate or reinforce what\'s working well.');
  lines.push('');
  lines.push('Respond ONLY with a valid JSON object (no markdown fences, no explanation):');
  lines.push('{');
  lines.push('  "summary": "<2-3 engaging sentences capturing the sprint story>",');
  lines.push('  "trend_analysis": "<2-4 insightful sentences with ✅ 🔁 🆕 labels comparing to previous retros>",');
  lines.push('  "actions": [');
  lines.push('    { "content": "<specific, actionable item — name what and how>" }');
  lines.push('  ]');
  lines.push('}');

  return lines.join('\n');
}

function parseRetroAIResponse(raw: string): {
  actions: Array<{ content: string; category: string }>;
  trend_analysis: string;
  summary: string;
} {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response');
  cleaned = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(cleaned);
  return {
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    trend_analysis: String(parsed.trend_analysis ?? ''),
    summary: String(parsed.summary ?? ''),
  };
}

// ─── POST /api/retro — create a new retro session ────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { title, theme = 'dark', duration_minutes = 30, project_id = null } =
    req.body as { title?: string; theme?: string; duration_minutes?: number; project_id?: string | null };

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const id = randomUUID();
  const code = generateRetroCode();
  const now = new Date().toISOString();

  await RetroSession.create({
    id,
    code,
    title: title.trim(),
    created_by: req.user!.id,
    project_id: project_id ?? null,
    theme,
    status: 'writing',
    duration_minutes,
    created_at: now,
  } as any);

  res.status(201).json({ id, code });
});

// ─── GET /api/retro — list the user's retro sessions ─────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { projectId } = req.query as { projectId?: string };

  const where: Record<string, unknown> = { created_by: userId };
  if (projectId) where.project_id = projectId;

  const sessions = await RetroSession.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  res.json(sessions.map((s: any) => s.get({ plain: true })));
});

// ─── DELETE /api/retro/:code — delete a retro session ────────────────────────
router.delete('/:code', requireAuth, async (req, res) => {
  const { code } = req.params;

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Retro session not found' });
    return;
  }
  if ((session as any).get({ plain: true }).created_by !== req.user!.id) {
    res.status(403).json({ error: 'Only the moderator can delete this session' });
    return;
  }

  // Delete all related items and actions
  await RetroItem.destroy({ where: { session_code: code } });
  await RetroAction.destroy({ where: { session_code: code } });
  await session.destroy();

  res.json({ success: true });
});

// ─── GET /api/retro/:code — get session with items + actions ─────────────────
router.get('/:code', async (req, res) => {
  const { code } = req.params;

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Retro session not found' });
    return;
  }

  const [items, actions] = await Promise.all([
    RetroItem.findAll({ where: { session_code: code }, order: [['created_at', 'ASC']] }),
    RetroAction.findAll({ where: { session_code: code }, order: [['created_at', 'ASC']] }),
  ]);

  const sessionPlain = (session as any).get({ plain: true });
  const isModerator = req.user ? req.user.id === sessionPlain.created_by : false;

  res.json({
    ...sessionPlain,
    isModerator,
    items: items.map((i: any) => i.get({ plain: true })),
    actions: actions.map((a: any) => a.get({ plain: true })),
  });
});

// ─── POST /api/retro/:code/items — add a post-it ─────────────────────────────
router.post('/:code/items', async (req, res) => {
  const { code } = req.params;
  const { category, content, guestId, guestName } = req.body as {
    category?: string;
    content?: string;
    guestId?: string;
    guestName?: string;
  };

  if (!category || !['well', 'improve', 'ideas'].includes(category)) {
    res.status(400).json({ error: 'category must be well, improve, or ideas' });
    return;
  }
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  // Resolve author — authenticated session takes priority, otherwise guest fields
  let authorId: string;
  let authorName: string;
  if (req.user) {
    authorId = req.user.id;
    authorName = req.user.displayName;
  } else {
    if (!guestId || !guestName || !guestName.trim()) {
      res.status(401).json({ error: 'Authentication or guest name required' });
      return;
    }
    authorId = guestId;
    authorName = guestName.trim().slice(0, 64);
  }

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const item = await RetroItem.create({
    id,
    session_code: code,
    category,
    content: content.trim(),
    author_id: authorId,
    author_name: authorName,
    votes: 0,
    created_at: now,
  } as any);

  const plain = (item as any).get({ plain: true });

  // Broadcast to all session participants
  try {
    getIO().to(`retro:${code}`).emit('retro:item:added', plain);
  } catch (_) { /* IO may not be initialized in tests */ }

  res.status(201).json(plain);
});

// ─── PATCH /api/retro/:code/items/:id — update content / votes ───────────────
router.patch('/:code/items/:id', async (req, res) => {
  const { code, id } = req.params;
  const { content, vote, guestId } = req.body as { content?: string; vote?: number; guestId?: string };

  const item = await RetroItem.findOne({ where: { id, session_code: code } });
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const plain = (item as any).get({ plain: true });

  // Only author can edit content
  if (content !== undefined) {
    const callerId = req.user?.id ?? guestId;
    if (plain.author_id !== callerId) {
      res.status(403).json({ error: 'Only the author can edit this item' });
      return;
    }
    if (!content.trim()) {
      res.status(400).json({ error: 'content cannot be empty' });
      return;
    }
    (item as any).content = content.trim();
  }

  if (typeof vote === 'number' && Number.isInteger(vote) && vote !== 0) {
    const newVotes = Math.max(0, plain.votes + vote);
    (item as any).votes = newVotes;
  }

  await item.save();
  const updated = (item as any).get({ plain: true });

  try {
    getIO().to(`retro:${code}`).emit('retro:item:updated', updated);
  } catch (_) { /* IO not initialized */ }

  res.json(updated);
});

// ─── DELETE /api/retro/:code/items/:id ───────────────────────────────────────
router.delete('/:code/items/:id', async (req, res) => {
  const { code, id } = req.params;
  const { guestId } = req.body as { guestId?: string };

  const item = await RetroItem.findOne({ where: { id, session_code: code } });
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const plain = (item as any).get({ plain: true });

  // Only author or session moderator can delete
  const session = await RetroSession.findOne({ where: { code } });
  const isModerator = req.user && session && (session as any).get({ plain: true }).created_by === req.user.id;
  const callerId = req.user?.id ?? guestId;
  if (plain.author_id !== callerId && !isModerator) {
    res.status(403).json({ error: 'Only author or moderator can delete this item' });
    return;
  }

  await item.destroy();

  try {
    getIO().to(`retro:${code}`).emit('retro:item:deleted', { id });
  } catch (_) { /* IO not initialized */ }

  res.json({ success: true });
});

// ─── POST /api/retro/:code/analyze — trigger AI analysis ─────────────────────
router.post('/:code/analyze', requireAuth, async (req, res) => {
  const { code } = req.params;
  const { locale = 'en' } = req.body as { locale?: string };

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const sessionPlain = (session as any).get({ plain: true });
  if (sessionPlain.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Only the moderator can trigger AI analysis' });
    return;
  }

  // Load AI settings for this user; fall back to server-level GEMINI_API_KEY env var
  const aiSettings = await UserAISettings.findOne({ where: { user_id: req.user!.id } });

  let provider: string;
  let apiKey: string | null;

  if (aiSettings) {
    const aiPlain = (aiSettings as any).get({ plain: true });
    provider = aiPlain.provider;
    apiKey = aiPlain.encrypted_api_key ? decrypt(aiPlain.encrypted_api_key) : null;
  } else {
    const envKey = process.env.GEMINI_API_KEY ?? null;
    if (!envKey) {
      res.status(400).json({ error: 'No AI provider configured. Go to AI Settings first.' });
      return;
    }
    provider = 'gemini';
    apiKey = envKey;
  }

  // Gather items
  const items = await RetroItem.findAll({ where: { session_code: code } });
  if (items.length === 0) {
    res.status(400).json({ error: 'No items to analyze. Add some post-its first.' });
    return;
  }

  // Previous actions from last 3 sessions of this user for trend analysis
  const previousSessions = await RetroSession.findAll({
    where: { created_by: req.user!.id },
    order: [['created_at', 'DESC']],
    limit: 4,
  });
  const prevCodes = previousSessions
    .map((s: any) => s.get({ plain: true }).code)
    .filter((c: string) => c !== code)
    .slice(0, 3);

  let previousActions: Array<{ content: string }> = [];
  if (prevCodes.length > 0) {
    const prevActionRecords = await RetroAction.findAll({
      where: { session_code: prevCodes, is_accepted: true },
      order: [['created_at', 'DESC']],
      limit: 20,
    });
    previousActions = prevActionRecords.map((a: any) => ({ content: a.get({ plain: true }).content }));
  }

  const prompt = buildRetroPrompt(
    items.map((i: any) => i.get({ plain: true })),
    previousActions,
    locale,
  );

  try {
    const raw = await callAIText(provider, apiKey, prompt);
    const parsed = parseRetroAIResponse(raw);

    // Update session status
    (session as any).status = 'analyzing';
    await session.save();

    // Delete old AI-suggested actions for this session and replace them
    await RetroAction.destroy({ where: { session_code: code, ai_suggested: true } });

    const now = new Date().toISOString();
    const createdActions = await Promise.all(
      parsed.actions.map(a =>
        RetroAction.create({
          id: randomUUID(),
          session_code: code,
          content: a.content,
          ai_suggested: true,
          is_accepted: false,
          created_at: now,
        } as any),
      ),
    );

    const result = {
      summary: parsed.summary,
      trend_analysis: parsed.trend_analysis,
      actions: createdActions.map((a: any) => a.get({ plain: true })),
    };

    try {
      getIO().to(`retro:${code}`).emit('retro:analysis:done', result);
    } catch (_) { /* IO not initialized */ }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'AI analysis failed' });
  }
});

// ─── PATCH /api/retro/:code/actions — accept/reject/add actions ──────────────
router.patch('/:code/actions', requireAuth, async (req, res) => {
  const { code } = req.params;
  const { accepted_ids, new_actions } =
    req.body as { accepted_ids?: string[]; new_actions?: string[] };

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if ((session as any).get({ plain: true }).created_by !== req.user!.id) {
    res.status(403).json({ error: 'Only the moderator can save actions' });
    return;
  }

  // Mark accepted AI actions
  if (Array.isArray(accepted_ids)) {
    await RetroAction.update(
      { is_accepted: false } as any,
      { where: { session_code: code, ai_suggested: true } },
    );
    if (accepted_ids.length > 0) {
      await RetroAction.update(
        { is_accepted: true } as any,
        { where: { id: accepted_ids, session_code: code } },
      );
    }
  }

  // Add manual actions
  if (Array.isArray(new_actions) && new_actions.length > 0) {
    const now = new Date().toISOString();
    await Promise.all(
      new_actions
        .filter(c => c.trim())
        .map(c =>
          RetroAction.create({
            id: randomUUID(),
            session_code: code,
            content: c.trim(),
            ai_suggested: false,
            is_accepted: true,
            created_at: now,
          } as any),
        ),
    );
  }

  // Close session
  (session as any).status = 'closed';
  await session.save();

  const finalActions = await RetroAction.findAll({
    where: { session_code: code },
    order: [['created_at', 'ASC']],
  });

  const result = { actions: finalActions.map((a: any) => a.get({ plain: true })) };

  try {
    getIO().to(`retro:${code}`).emit('retro:actions:saved', result);
  } catch (_) { /* IO not initialized */ }

  res.json(result);
});

// ─── GET /api/retro/:code/history — trend data for moderator ─────────────────
router.get('/:code/history', requireAuth, async (req, res) => {
  const { code } = req.params;
  const userId = req.user!.id;

  const session = await RetroSession.findOne({ where: { code } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if ((session as any).get({ plain: true }).created_by !== userId) {
    res.status(403).json({ error: 'Only the moderator can view history' });
    return;
  }

  const sessions = await RetroSession.findAll({
    where: { created_by: userId },
    order: [['created_at', 'DESC']],
    limit: 6,
  });

  const history = await Promise.all(
    sessions.map(async (s: any) => {
      const sp = s.get({ plain: true });
      const [items, acceptedActions] = await Promise.all([
        RetroItem.findAll({ where: { session_code: sp.code } }),
        RetroAction.findAll({ where: { session_code: sp.code, is_accepted: true } }),
      ]);
      return {
        code: sp.code,
        title: sp.title,
        created_at: sp.created_at,
        status: sp.status,
        well_count: items.filter((i: any) => i.get({ plain: true }).category === 'well').length,
        improve_count: items.filter((i: any) => i.get({ plain: true }).category === 'improve').length,
        ideas_count: items.filter((i: any) => i.get({ plain: true }).category === 'ideas').length,
        actions_count: acceptedActions.length,
      };
    }),
  );

  res.json(history);
});

export default router;
