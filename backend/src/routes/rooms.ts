import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import requireAuth from '../middleware/requireAuth';
import { Project, Sprint, Room } from '../db/schema';
import { getWorkItemsForIteration, patAuthHeader, updateWorkItemStoryPoints } from '../services/azDevops';
import { decrypt } from '../utils/crypto';

const router = Router();

function generateRoomCode(): string {
  return randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
}

/** POST /api/rooms — create a new room */
router.post('/', requireAuth, async (req, res) => {
  const { projectId, sprintId } = req.body as { projectId?: string; sprintId?: string };
  if (!projectId || !sprintId) {
    res.status(400).json({ error: 'projectId and sprintId are required' });
    return;
  }

  const userId = req.user!.id;

  // Verify project belongs to user
  const project = await Project.findOne({ where: { id: projectId, user_id: userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Verify sprint belongs to project
  const sprint = await Sprint.findOne({ where: { id: sprintId, project_id: projectId } });
  if (!sprint) {
    res.status(404).json({ error: 'Sprint not found' });
    return;
  }

  const id   = randomUUID();
  const code = generateRoomCode();
  const now  = new Date().toISOString();

  await Room.create({
    id,
    code,
    project_id: projectId,
    sprint_id: sprintId,
    moderator_id: userId,
    status: 'waiting',
    created_at: now,
  });

  res.status(201).json({ id, code });
});

/** GET /api/rooms — list the authenticated user's rooms */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const rooms = await Room.findAll({
    where: { moderator_id: userId },
    include: [
      { model: Project, attributes: ['name', 'organization'] },
      { model: Sprint, attributes: ['name'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const result = rooms.map((r: any) => {
    const plain = r.get({ plain: true });
    return {
      id: plain.id,
      code: plain.code,
      status: plain.status,
      created_at: plain.created_at,
      project_name: plain.project?.name ?? '',
      organization: plain.project?.organization ?? '',
      sprint_name: plain.sprint?.name ?? '',
    };
  });

  res.json(result);
});

/** DELETE /api/rooms/:id — delete a room (moderator only) */
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const room = await Room.findOne({ where: { id } });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.moderator_id !== userId) {
    res.status(403).json({ error: 'Only the moderator can delete this room' });
    return;
  }

  await room.destroy();
  res.status(204).end();
});

/** GET /api/rooms/:code — get a single room's details (public – guests allowed) */
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  const userId = req.user?.id ?? null;

  const room = await Room.findOne({ where: { code } });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const [project, sprint] = await Promise.all([
    Project.findOne({ where: { id: room.project_id } }),
    Sprint.findOne({ where: { id: room.sprint_id } }),
  ]);

  res.json({
    id: room.id,
    code: room.code,
    status: room.status,
    moderatorId: room.moderator_id,
    isModerator: userId !== null && room.moderator_id === userId,
    projectName: (project as any)?.name ?? '',
    organization: (project as any)?.organization ?? '',
    sprintName: (sprint as any)?.name ?? '',
    adoSprintId: (sprint as any)?.ado_sprint_id ?? null,
  });
});

/** GET /api/rooms/:code/work-items — fetch work items from ADO for the sprint */
router.get('/:code/work-items', async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({ where: { code } });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const [project, sprint] = await Promise.all([
    Project.findOne({ where: { id: room.project_id } }),
    Sprint.findOne({ where: { id: room.sprint_id } }),
  ]);

  if (!project) {
    res.status(422).json({ error: 'Room has no associated project' });
    return;
  }

  const sprintPlain = sprint?.get({ plain: true }) as any;

  if (!sprintPlain?.ado_sprint_id) {
    res.status(422).json({ error: 'Sprint has no ADO iteration ID — work items cannot be fetched' });
    return;
  }

  const projectPlain = project.get({ plain: true }) as any;

  let authHeader: string;
  if (projectPlain.encrypted_pat) {
    try {
      const pat = decrypt(projectPlain.encrypted_pat);
      authHeader = patAuthHeader(pat);
    } catch {
      res.status(500).json({ error: 'Failed to decrypt project credentials' });
      return;
    }
  } else {
    res.status(401).json({ error: 'No ADO credentials available. Add a Personal Access Token (PAT) to the project.' });
    return;
  }

  try {
    const items = await getWorkItemsForIteration(
      projectPlain.organization,
      projectPlain.name,
      projectPlain.team ?? projectPlain.name,
      sprintPlain.ado_sprint_id,
      authHeader,
    );
    res.json(items);
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Failed to fetch work items from Azure DevOps' });
  }
});

/** PATCH /api/rooms/:code/work-items/:workItemId — update story points (moderator only) */
router.patch('/:code/work-items/:workItemId', requireAuth, async (req, res) => {
  const { code, workItemId } = req.params;
  const { storyPoints } = req.body as { storyPoints?: number };

  if (storyPoints == null || !Number.isFinite(storyPoints) || storyPoints <= 0) {
    res.status(400).json({ error: 'storyPoints must be a positive number' });
    return;
  }

  const userId = req.user!.id;
  const room = await Room.findOne({ where: { code } });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.moderator_id !== userId) {
    res.status(403).json({ error: 'Only the moderator can update work items' });
    return;
  }

  const project = await Project.findOne({ where: { id: room.project_id } });

  if (!project) {
    res.status(422).json({ error: 'Room has no associated project' });
    return;
  }

  const projectPlain = project.get({ plain: true }) as any;

  let authHeader: string;
  if (projectPlain.encrypted_pat) {
    try {
      const pat = decrypt(projectPlain.encrypted_pat);
      authHeader = patAuthHeader(pat);
    } catch {
      res.status(500).json({ error: 'Failed to decrypt project credentials' });
      return;
    }
  } else {
    res.status(401).json({ error: 'No ADO credentials available. Add a Personal Access Token (PAT) to the project.' });
    return;
  }

  try {
    await updateWorkItemStoryPoints(
      projectPlain.organization,
      projectPlain.name,
      Number(workItemId),
      storyPoints,
      authHeader,
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Failed to update work item in Azure DevOps' });
  }
});

export default router;

