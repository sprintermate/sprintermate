import { Router } from 'express';
import { randomUUID } from 'crypto';
import requireAuth from '../middleware/requireAuth';
import { UserAgentPrompt } from '../db/schema';

const router = Router();
router.use(requireAuth);

/** GET /api/agent-prompts — list the current user's agent prompts */
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const rows = await UserAgentPrompt.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    attributes: ['id', 'name', 'markdown', 'created_at', 'updated_at'],
  });
  res.json(rows.map(r => r.get({ plain: true })));
});

/** POST /api/agent-prompts — create a new agent prompt */
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { name, markdown } = req.body as { name?: string; markdown?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!markdown?.trim()) {
    res.status(400).json({ error: 'markdown is required' });
    return;
  }

  const now = new Date();
  const row = await UserAgentPrompt.create({
    id: randomUUID(),
    user_id: userId,
    name: name.trim(),
    markdown: markdown.trim(),
    created_at: now,
    updated_at: now,
  });

  res.status(201).json(row.get({ plain: true }));
});

/** PUT /api/agent-prompts/:id — update name and/or markdown */
router.put('/:id', async (req, res) => {
  const userId = req.user!.id;
  const row = await UserAgentPrompt.findOne({ where: { id: req.params.id, user_id: userId } });
  if (!row) {
    res.status(404).json({ error: 'Agent prompt not found' });
    return;
  }

  const { name, markdown } = req.body as { name?: string; markdown?: string };
  if (name !== undefined) row.set('name', name.trim());
  if (markdown !== undefined) row.set('markdown', markdown.trim());
  row.set('updated_at', new Date());
  await row.save();

  res.json(row.get({ plain: true }));
});

/** DELETE /api/agent-prompts/:id — delete an agent prompt */
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const row = await UserAgentPrompt.findOne({ where: { id: req.params.id, user_id: userId } });
  if (!row) {
    res.status(404).json({ error: 'Agent prompt not found' });
    return;
  }
  await row.destroy();
  res.json({ success: true });
});

export default router;
