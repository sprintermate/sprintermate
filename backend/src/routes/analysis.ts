import { Router } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import requireAuth from '../middleware/requireAuth';
import { Project, AnalysisSession, AnalysisMessage } from '../db/schema';
import { listRepositories, getRepoFileTree, patAuthHeader } from '../services/azDevops';
import { runAnalysis, parsePDF, buildRepoContext } from '../services/analysisAgent';
import { decrypt } from '../utils/crypto';

const router = Router();
router.use(requireAuth);

// Multer config — memory storage, max 10MB, allowed file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|md|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, TXT, MD, CSV'));
    }
  },
});

// ─── Session CRUD ────────────────────────────────────────────────────────────

/** POST /api/analysis/sessions — create a new analysis session */
router.post('/sessions', async (req, res) => {
  const userId = req.user!.id;
  const { title, projectId } = req.body as { title?: string; projectId?: string };
  const now = new Date().toISOString();

  const session = await AnalysisSession.create({
    id: randomUUID(),
    user_id: userId,
    title: title ?? 'New Analysis',
    project_id: projectId ?? null,
    selected_repos: null,
    created_at: now,
    updated_at: now,
  });

  res.status(201).json(session.get({ plain: true }));
});

/** GET /api/analysis/sessions — list user's analysis sessions */
router.get('/sessions', async (req, res) => {
  const userId = req.user!.id;
  const sessions = await AnalysisSession.findAll({
    where: { user_id: userId },
    order: [['updated_at', 'DESC']],
  });
  res.json(sessions.map(s => s.get({ plain: true })));
});

/** GET /api/analysis/sessions/:id — get session with messages */
router.get('/sessions/:id', async (req, res) => {
  const userId = req.user!.id;
  const session = await AnalysisSession.findOne({
    where: { id: req.params.id, user_id: userId },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const messages = await AnalysisMessage.findAll({
    where: { session_id: session.get('id') },
    order: [['created_at', 'ASC']],
  });

  res.json({
    ...session.get({ plain: true }),
    messages: messages.map(m => m.get({ plain: true })),
  });
});

/** PUT /api/analysis/sessions/:id — update session */
router.put('/sessions/:id', async (req, res) => {
  const userId = req.user!.id;
  const session = await AnalysisSession.findOne({
    where: { id: req.params.id, user_id: userId },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { title, projectId, selectedRepos } = req.body as {
    title?: string;
    projectId?: string | null;
    selectedRepos?: string[];
  };

  if (title !== undefined) session.set('title', title);
  if (projectId !== undefined) session.set('project_id', projectId);
  if (selectedRepos !== undefined) session.set('selected_repos', JSON.stringify(selectedRepos));
  session.set('updated_at', new Date().toISOString());

  await session.save();
  res.json(session.get({ plain: true }));
});

/** DELETE /api/analysis/sessions/:id — delete session and messages */
router.delete('/sessions/:id', async (req, res) => {
  const userId = req.user!.id;
  const session = await AnalysisSession.findOne({
    where: { id: req.params.id, user_id: userId },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await AnalysisMessage.destroy({ where: { session_id: session.get('id') } });
  await session.destroy();
  res.json({ success: true });
});

// ─── Repo Context ────────────────────────────────────────────────────────────

/** POST /api/analysis/repo-context — fetch repo file trees for selected repos */
router.post('/repo-context', async (req, res) => {
  const userId = req.user!.id;
  const { projectId, repoIds } = req.body as { projectId: string; repoIds: string[] };

  if (!projectId || !repoIds?.length) {
    res.status(400).json({ error: 'projectId and repoIds are required' });
    return;
  }

  const project = await Project.findOne({ where: { id: projectId, user_id: userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const plain = project.get({ plain: true }) as any;
  if (!plain.encrypted_pat) {
    res.status(400).json({ error: 'Project has no PAT configured' });
    return;
  }

  const pat = decrypt(plain.encrypted_pat);
  const authHeader = patAuthHeader(pat);

  try {
    // Resolve repo names from IDs
    const allRepos = await listRepositories(plain.organization, plain.name, authHeader);
    const repoNameMap = new Map(allRepos.map(r => [r.id, r.name]));

    const repoTrees: Array<{ repoName: string; items: Array<{ path: string; gitObjectType: string }> }> = [];

    for (const repoId of repoIds) {
      const items = await getRepoFileTree(
        plain.organization,
        plain.name,
        repoId,
        authHeader,
      );
      const repoName = repoNameMap.get(repoId) ?? repoId;
      repoTrees.push({ repoName, items });
    }

    const contextStr = buildRepoContext(repoTrees);
    res.json({ context: contextStr, repoTrees });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Failed to fetch repo context' });
  }
});

// ─── Chat Messages ───────────────────────────────────────────────────────────

/** POST /api/analysis/sessions/:id/messages — send a message + get AI response */
router.post('/sessions/:id/messages', upload.single('file'), async (req, res) => {
  const userId = req.user!.id;
  const session = await AnalysisSession.findOne({
    where: { id: req.params.id, user_id: userId },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { message, projectId, repoIds: repoIdsRaw, locale } = req.body as {
    message?: string;
    projectId?: string;
    repoIds?: string;
    locale?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const now = new Date().toISOString();

  // 1. Parse attached file if present
  let pdfText: string | undefined;
  let attachmentMeta: Array<{ name: string; type: string }> | undefined;

  if (req.file) {
    attachmentMeta = [{ name: req.file.originalname, type: req.file.mimetype }];

    if (req.file.mimetype === 'application/pdf') {
      pdfText = await parsePDF(req.file.buffer);
    } else {
      // Text-based files
      pdfText = req.file.buffer.toString('utf-8');
    }
  }

  // 2. Build repo context if repos selected
  let repoContext: string | undefined;
  const repoIds: string[] = repoIdsRaw ? JSON.parse(repoIdsRaw) : [];
  const effectiveProjectId = projectId || (session.get('project_id') as string | null);

  if (repoIds.length > 0 && effectiveProjectId) {
    try {
      const project = await Project.findOne({ where: { id: effectiveProjectId, user_id: userId } });
      if (project) {
        const plain = project.get({ plain: true }) as any;
        if (plain.encrypted_pat) {
          const pat = decrypt(plain.encrypted_pat);
          const authHeader = patAuthHeader(pat);

          // Resolve repo names from IDs
          const allRepos = await listRepositories(plain.organization, plain.name, authHeader);
          const repoNameMap = new Map(allRepos.map(r => [r.id, r.name]));

          const repoTrees: Array<{ repoName: string; items: Array<{ path: string; gitObjectType: string }> }> = [];
          for (const repoId of repoIds) {
            const items = await getRepoFileTree(plain.organization, plain.name, repoId, authHeader);
            repoTrees.push({ repoName: repoNameMap.get(repoId) ?? repoId, items });
          }
          repoContext = buildRepoContext(repoTrees);
        }
      }
    } catch {
      // Silently continue without repo context
    }
  }

  // 3. Save user message
  const userMsg = await AnalysisMessage.create({
    id: randomUUID(),
    session_id: session.get('id'),
    role: 'user',
    content: message,
    attachments: attachmentMeta ? JSON.stringify(attachmentMeta) : null,
    created_at: now,
  });

  // 4. Update session title if first message
  const msgCount = await AnalysisMessage.count({ where: { session_id: session.get('id') } });
  if (msgCount === 1) {
    const autoTitle = message.slice(0, 80) + (message.length > 80 ? '...' : '');
    session.set('title', autoTitle);
  }

  // Update session metadata
  if (effectiveProjectId) session.set('project_id', effectiveProjectId);
  if (repoIds.length > 0) session.set('selected_repos', JSON.stringify(repoIds));
  session.set('updated_at', new Date().toISOString());
  await session.save();

  // 5. Run AI analysis
  try {
    const aiResponse = await runAnalysis(userId, {
      userMessage: message,
      pdfText,
      repoContext,
      locale: locale ?? 'tr',
    });

    // 6. Save assistant message
    const assistantMsg = await AnalysisMessage.create({
      id: randomUUID(),
      session_id: session.get('id'),
      role: 'assistant',
      content: aiResponse,
      attachments: null,
      created_at: new Date().toISOString(),
    });

    res.json({
      userMessage: userMsg.get({ plain: true }),
      assistantMessage: assistantMsg.get({ plain: true }),
    });
  } catch (err: any) {
    // Save error as assistant message so user sees it
    const errorMsg = await AnalysisMessage.create({
      id: randomUUID(),
      session_id: session.get('id'),
      role: 'assistant',
      content: `<div class="analysis-output"><div class="analysis-section error"><h2>❌ Analysis Error</h2><p>${err.message ?? 'An unexpected error occurred'}</p></div></div>`,
      attachments: null,
      created_at: new Date().toISOString(),
    });

    res.status(500).json({
      userMessage: userMsg.get({ plain: true }),
      assistantMessage: errorMsg.get({ plain: true }),
      error: err.message,
    });
  }
});

export default router;
