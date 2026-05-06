import { Router } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import requireAuth from '../middleware/requireAuth';
import { Project, AnalysisSession, AnalysisMessage, UserAgentPrompt } from '../db/schema';
import { listRepositories, getRepoFileTree, patAuthHeader } from '../services/azDevops';
import { runAnalysis, parsePDF, buildRepoContext, runPipelineAnalysis, type PipelineInput } from '../services/analysisAgent';
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

  const { message, projectId, repoIds: repoIdsRaw, locale, agentPromptId } = req.body as {
    message?: string;
    projectId?: string;
    repoIds?: string;
    locale?: string;
    agentPromptId?: string;
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
    // Resolve custom agent markdown if provided
    let agentMarkdown: string | undefined;
    if (agentPromptId) {
      const agentRow = await UserAgentPrompt.findOne({
        where: { id: agentPromptId, user_id: userId },
      });
      if (agentRow) {
        agentMarkdown = agentRow.get('markdown') as string;
      }
    }

    const aiResponse = await runAnalysis(userId, {
      userMessage: message,
      pdfText,
      repoContext,
      locale: locale ?? 'tr',
      agentMarkdown,
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

// ─── Pipeline SSE ─────────────────────────────────────────────────────────────

const pipelineUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|md|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, TXT, MD, CSV'));
    }
  },
});

/**
 * POST /api/analysis/sessions/:id/pipeline
 * Streams a 3-step pipeline analysis via SSE.
 * Fields: message (optional if PDF attached), locale, projectId?, repoIds? (JSON), file? (PDF)
 */
router.post(
  '/sessions/:id/pipeline',
  pipelineUpload.fields([
    { name: 'file', maxCount: 1 },
  ]),
  async (req, res) => {
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

    // ── Parse uploaded files ──────────────────────────────────────────────────
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    let pdfText: string | undefined;
    let pdfAttachment: { name: string; type: string } | undefined;
    const pdfFile = files?.file?.[0];
    if (pdfFile) {
      pdfAttachment = { name: pdfFile.originalname, type: pdfFile.mimetype };
      if (pdfFile.mimetype === 'application/pdf') {
        pdfText = await parsePDF(pdfFile.buffer);
      } else {
        pdfText = pdfFile.buffer.toString('utf-8');
      }
    }

    // Require at least a message or a PDF file
    if (!message?.trim() && !pdfFile) {
      res.status(400).json({ error: 'message or PDF file is required' });
      return;
    }

    // ── SSE headers ───────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data: object) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // ── Build repo context ────────────────────────────────────────────────────
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
      } catch { /* continue without repo context */ }
    }

    // ── Save user message ─────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const attachmentMeta: Array<{ name: string; type: string }> = [];
    if (pdfAttachment) attachmentMeta.push(pdfAttachment);

    const effectiveMessage = message?.trim() || (pdfFile ? `[PDF: ${pdfFile.originalname}]` : '');

    const userMsg = await AnalysisMessage.create({
      id: randomUUID(),
      session_id: session.get('id'),
      role: 'user',
      content: effectiveMessage,
      attachments: attachmentMeta.length > 0 ? JSON.stringify(attachmentMeta) : null,
      created_at: now,
    });

    // Update session title + metadata
    const msgCount = await AnalysisMessage.count({ where: { session_id: session.get('id') } });
    if (msgCount === 1) {
      const autoTitle = effectiveMessage.slice(0, 80) + (effectiveMessage.length > 80 ? '…' : '');
      session.set('title', autoTitle);
    }
    if (effectiveProjectId) session.set('project_id', effectiveProjectId);
    if (repoIds.length > 0) session.set('selected_repos', JSON.stringify(repoIds));
    session.set('updated_at', new Date().toISOString());
    await session.save();

    // ── Stream pipeline ───────────────────────────────────────────────────────
    const pipelineInput: PipelineInput = {
      userMessage: message?.trim() || '',
      pdfText,
      repoContext,
      locale: locale ?? 'tr',
    };

    try {
      const completedSteps: Array<{ step: number; title: string; output: string }> = [];

      for await (const event of runPipelineAnalysis(userId, pipelineInput)) {
        sendEvent(event);

        if (event.type === 'step_done') {
          completedSteps.push({ step: event.step, title: event.title, output: event.output });
        }

        if (event.type === 'complete') {
          // Save assistant message: content = step 3 output, attachments = full pipeline data
          const step3Output = completedSteps.find(s => s.step === 3)?.output ?? '';
          const pipelineMeta = JSON.stringify({
            pipeline: true,
            steps: event.steps,
          });

          const assistantMsg = await AnalysisMessage.create({
            id: randomUUID(),
            session_id: session.get('id'),
            role: 'assistant',
            content: step3Output,
            attachments: pipelineMeta,
            created_at: new Date().toISOString(),
          });

          sendEvent({ type: 'saved', messageId: assistantMsg.get('id') });
        }

        if (event.type === 'error') {
          const errorContent = `# ❌ Analiz Hatası\n\nAdım ${event.step} (${event.title}) sırasında hata oluştu:\n\n${event.message}`;
          await AnalysisMessage.create({
            id: randomUUID(),
            session_id: session.get('id'),
            role: 'assistant',
            content: errorContent,
            attachments: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      sendEvent({ type: 'error', step: 0, title: 'Pipeline', message: err.message ?? 'Unexpected error' });
    } finally {
      if (!res.writableEnded) res.end();
    }
  },
);

export default router;
