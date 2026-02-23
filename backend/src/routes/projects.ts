import { Router } from 'express';
import { randomUUID } from 'crypto';
import requireAuth from '../middleware/requireAuth';
import { Project, Sprint, ReferenceScore } from '../db/schema';
import { parseSprintUrl, listSprints, validatePat, patAuthHeader } from '../services/azDevops';
import { encrypt, decrypt } from '../utils/crypto';

const router = Router();

// All project routes require authentication
router.use(requireAuth);

/** Strip sensitive fields before sending a project row to the client */
function sanitizeProject(row: any) {
  const plain = row.get ? row.get({ plain: true }) : row;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encrypted_pat, ...rest } = plain;
  return { ...rest, hasPat: !!plain.encrypted_pat };
}

/** GET /api/projects — list the authenticated user's saved projects */
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const rows = await Project.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });
  res.json(rows.map(sanitizeProject));
});

/** POST /api/projects/parse-url — parse an ADO board/sprint URL */
router.post('/parse-url', (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ valid: false, error: 'url is required' });
    return;
  }

  const parsed = parseSprintUrl(url);
  if (!parsed) {
    res.status(422).json({ valid: false, error: 'Could not parse Azure DevOps URL. Make sure it is a sprint backlog or board URL from dev.azure.com.' });
    return;
  }

  res.json({ valid: true, ...parsed });
});

/** POST /api/projects/validate-pat — validate an ADO Personal Access Token */
router.post('/validate-pat', async (req, res) => {
  const { pat } = req.body as { pat?: string };
  if (!pat) {
    res.status(400).json({ valid: false, error: 'pat is required' });
    return;
  }

  try {
    const valid = await validatePat(pat);
    res.json({ valid });
  } catch (err: any) {
    res.status(502).json({ valid: false, error: err.message ?? 'PAT validation failed' });
  }
});

/** POST /api/projects — save a project for the current user */
router.post('/', async (req, res) => {
  const { name, organization, team, adoUrl, pat } = req.body as {
    name?: string;
    organization?: string;
    team?: string;
    adoUrl?: string;
    pat?: string;
  };

  if (!name || !organization) {
    res.status(400).json({ error: 'name and organization are required' });
    return;
  }

  const userId = req.user!.id;
  const id = randomUUID();
  const now = new Date().toISOString();

  let encryptedPat: string | null = null;
  if (pat) {
    try {
      encryptedPat = encrypt(pat);
    } catch (err: any) {
      res.status(500).json({ error: `Failed to encrypt PAT: ${err.message}` });
      return;
    }
  }

  const project = await Project.create({
    id,
    user_id: userId,
    name,
    organization,
    team: team ?? null,
    ado_url: adoUrl ?? null,
    encrypted_pat: encryptedPat,
    created_at: now,
  });

  res.status(201).json(sanitizeProject(project));
});

/** PUT /api/projects/:id — update project details */
router.put('/:id', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { name, organization, team, adoUrl } = req.body as {
    name?: string;
    organization?: string;
    team?: string;
    adoUrl?: string;
  };

  if (name !== undefined) project.name = name;
  if (organization !== undefined) project.organization = organization;
  if (team !== undefined) project.team = team ?? null;
  if (adoUrl !== undefined) project.ado_url = adoUrl ?? null;

  await project.save();
  res.json(sanitizeProject(project));
});

/** DELETE /api/projects/:id — delete a project and all its related data */
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  await project.destroy();
  res.status(204).send();
});

/** PUT /api/projects/:id/pat — set or update the PAT for an existing project */
router.put('/:id/pat', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { pat } = req.body as { pat?: string };

  if (!pat) {
    project.encrypted_pat = null;
    await project.save();
    res.json({ message: 'PAT removed' });
    return;
  }

  let encryptedPat: string;
  try {
    encryptedPat = encrypt(pat);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to encrypt PAT: ${err.message}` });
    return;
  }

  project.encrypted_pat = encryptedPat;
  await project.save();
  res.json({ message: 'PAT updated', hasPat: true });
});

/** GET /api/projects/:id/sprints — fetch sprints via ADO REST API, cache in DB */
router.get('/:id/sprints', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Return cached sprints if available
  const cached = await Sprint.findAll({
    where: { project_id: project.id },
    order: [['name', 'ASC']],
  });

  if (cached.length > 0) {
    res.json(cached.map(s => s.get({ plain: true })));
    return;
  }

  if (!project.team) {
    res.status(422).json({ error: 'Project has no team; cannot fetch sprints' });
    return;
  }

  const authResult = await resolveAdoAuthHeader(project);
  if ('error' in authResult) {
    res.status(authResult.status).json({ error: authResult.error, code: authResult.code });
    return;
  }

  try {
    const sprints = await listSprints(project.organization, project.name, project.team, authResult.header);

    const now = new Date().toISOString();
    await Sprint.bulkCreate(
      sprints.map(s => ({
        id: randomUUID(),
        ado_sprint_id: s.id,
        project_id: project.id,
        name: s.name,
        path: s.path ?? null,
        start_date: s.startDate ?? null,
        finish_date: s.finishDate ?? null,
        created_at: now,
      })),
    );

    const rows = await Sprint.findAll({
      where: { project_id: project.id },
      order: [['name', 'ASC']],
    });

    res.json(rows.map(s => s.get({ plain: true })));
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    const isAuthErr =
      err instanceof TypeError ||
      msg.includes('redirect') ||
      msg.includes('non-JSON response') ||
      msg.includes('fetch failed') ||
      msg.includes('401') ||
      msg.includes('403');

    if (isAuthErr) {
      res.status(502).json({
        error:
          'Azure DevOps rejected the credentials. ' +
          'Please provide a Personal Access Token (PAT) with vso.work scope.',
        code: 'ADO_AUTH_REQUIRED',
      });
    } else {
      res.status(502).json({ error: msg || 'Failed to fetch sprints from Azure DevOps' });
    }
  }
});

/** GET /api/projects/:id/reference-scores — get reference scores for a project */
router.get('/:id/reference-scores', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const scores = await ReferenceScore.findAll({
    where: { project_id: project.id },
    order: [['story_points', 'ASC']],
  });

  res.json(scores.map(s => s.get({ plain: true })));
});

/** POST /api/projects/:id/reference-scores — replace all reference scores for a project */
router.post('/:id/reference-scores', async (req, res) => {
  const userId = req.user!.id;
  const project = await Project.findOne({ where: { id: req.params.id, user_id: userId } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const scores = req.body as Array<{ title: string; description?: string; story_points: number }>;
  if (!Array.isArray(scores)) {
    res.status(400).json({ error: 'Body must be an array of reference scores' });
    return;
  }

  const now = new Date().toISOString();

  // Replace all existing scores for this project
  await ReferenceScore.destroy({ where: { project_id: project.id } });

  const created = await ReferenceScore.bulkCreate(
    scores.map(s => ({
      id: randomUUID(),
      project_id: project.id,
      title: s.title,
      description: s.description ?? null,
      story_points: s.story_points,
      created_at: now,
    })),
  );

  res.status(201).json(created.map(s => s.get({ plain: true })));
});

export default router;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveAdoAuthHeader(
  project: Project,
): Promise<{ header: string } | { error: string; status: number; code?: string }> {
  if (project.encrypted_pat) {
    let pat: string;
    try {
      pat = decrypt(project.encrypted_pat as string);
    } catch (err: any) {
      return { error: `Failed to decrypt PAT: ${err.message}`, status: 500 };
    }
    return { header: patAuthHeader(pat) };
  }

  return {
    error:
      'No ADO credentials available for this project. ' +
      'Please provide a Personal Access Token (PAT) with vso.work scope.',
    status: 422,
    code: 'ADO_AUTH_REQUIRED',
  };
}
