import { Router } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
// Use pdfjs-dist for robust PDF parsing (text + images)

import requireAuth from '../middleware/requireAuth';
import { UserAISettings, Project } from '../db/schema';
import AnalysisDocument from '../db/models/AnalysisDocument';
import { callAIFreeform, getProductionAISettings } from '../services/aiService';
import { buildAnalysisPrompt, parseAnalysisResponse } from '../services/aiAnalysisService';
import { decrypt } from '../utils/crypto';
import { listRepos, patAuthHeader } from '../services/azDevops';
import { getIO } from '../socket/ioInstance';
import { childLogger } from '../utils/logger';

const log = childLogger('analysis');
const router = Router();

// Multer config: memory storage, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Helper: resolve AI provider ─────────────────────────────────────────────
async function resolveAIProvider(userId: string): Promise<{
  provider: string;
  apiKey: string | null;
  azureOptions?: import('../services/aiService').AzureAIOptions;
} | null> {
  const prodSettings = getProductionAISettings();
  if (prodSettings) return prodSettings;

  const aiSettings = await UserAISettings.findOne({ where: { user_id: userId } });
  if (!aiSettings) return null;

  const plain = (aiSettings as any).get({ plain: true });
  return {
    provider: plain.provider,
    apiKey: plain.encrypted_api_key ? decrypt(plain.encrypted_api_key) : null,
    azureOptions: plain.encrypted_endpoint
      ? {
          endpoint: decrypt(plain.encrypted_endpoint),
          deploymentName: plain.azure_deployment_name ?? '',
          apiVersion: plain.azure_api_version ?? '2024-02-01',
          organization: plain.azure_organization,
        }
      : undefined,
  };
}

// ─── Helper: emit progress event to user's private room ──────────────────────
function emitStep(userId: string, docId: string, step: string, message: string) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('analysis:step', { docId, step, message });
  } catch { /* socket not ready yet — ignore */ }
}

function emitComplete(userId: string, docId: string, mdOutput: string) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('analysis:complete', { docId, md_output: mdOutput });
  } catch { /* ignore */ }
}

function emitError(userId: string, docId: string, error: string) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('analysis:error', { docId, error });
  } catch { /* ignore */ }
}

// ─── Helper: run analysis async in background ───────────────────────────────
async function runAnalysisInBackground(
  docId: string,
  userId: string,
  pdfText: string,
  userMessage: string | null,
  azureRepos: string | null,
  mdContext: string | null,
  locale: string,
  aiConfig: { provider: string; apiKey: string | null; azureOptions?: import('../services/aiService').AzureAIOptions },
) {
  const doc = await AnalysisDocument.findByPk(docId);
  if (!doc) return;

  try {
    // Step 1: PDF parsed (already done by this point)
    emitStep(userId, docId, 'pdf_parsed', 'PDF text extracted successfully');

    // Step 2: Building prompt with context
    emitStep(userId, docId, 'building_prompt', 'Building analysis prompt with context...');
    const prompt = buildAnalysisPrompt(pdfText, userMessage, azureRepos, locale, mdContext);

    // Step 3: Calling AI
    emitStep(userId, docId, 'ai_calling', `Calling AI provider (${aiConfig.provider})...`);
    const raw = await callAIFreeform(aiConfig.provider, aiConfig.apiKey, prompt, aiConfig.azureOptions);

    // Step 4: Parsing response
    emitStep(userId, docId, 'generating_output', 'Generating analysis output...');
    const mdOutput = parseAnalysisResponse(raw);

    (doc as any).md_output = mdOutput;
    (doc as any).status = 'completed';
    (doc as any).updated_at = new Date().toISOString();
    await doc.save();

    emitComplete(userId, docId, mdOutput);
  } catch (err: any) {
    log.error('Background analysis failed', { err, docId });
    (doc as any).status = 'error';
    (doc as any).updated_at = new Date().toISOString();
    await doc.save();

    emitError(userId, docId, err.message ?? 'AI analysis failed');
  }
}

// ─── POST /api/analysis — upload PDF + optional MD files, start async analysis
const uploadFields = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'md_files', maxCount: 10 },
]);

router.post('/', uploadFields, async (req, res) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const pdfFile = files?.pdf?.[0];
    if (!pdfFile) {
      res.status(400).json({ error: 'PDF file is required' });
      return;
    }

    if (pdfFile.mimetype !== 'application/pdf') {
      res.status(400).json({ error: 'Only PDF files are allowed' });
      return;
    }

    const { title, user_message, azure_repos, project_id, locale = 'en' } = req.body as {
      title?: string;
      user_message?: string;
      azure_repos?: string;
      project_id?: string;
      locale?: string;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    // Extract text and images from PDF (never throw parse error)
    let pdfText = '';
    let imageCount = 0;
    try {
      // Dynamically import ESM-only pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({ data: pdfFile.buffer });
      const pdf = await loadingTask.promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        pdfText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        // Count images (XObject resources)
        const ops = await page.getOperatorList();
        imageCount += ops.fnArray.filter((fn: number) => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintXObject).length;
      }
    } catch (err: any) {
      log.error('PDF parsing failed, continuing with empty text', { err });
      pdfText = '';
    }
    // Always proceed, even if pdfText is empty
    // Optionally, you can add a marker for image-only PDFs
    if (!pdfText.trim() && imageCount > 0) {
      pdfText = `[PDF contains ${imageCount} images, no extractable text]`;
    }

    // Process MD files
    const mdFiles = files?.md_files ?? [];
    let mdContext: string | null = null;
    const mdFilenames: string[] = [];
    if (mdFiles.length > 0) {
      const parts: string[] = [];
      for (const mf of mdFiles) {
        const content = mf.buffer.toString('utf-8');
        mdFilenames.push(mf.originalname);
        parts.push(`### ${mf.originalname}\n\n${content}`);
      }
      mdContext = parts.join('\n\n---\n\n');
    }

    // Also accept md_context from body (from "select from previous" feature)
    const bodyMdContext = (req.body as { md_context?: string }).md_context;
    const bodyMdFilenames = (req.body as { md_filenames?: string }).md_filenames;
    if (bodyMdContext && bodyMdContext.trim()) {
      mdContext = mdContext ? mdContext + '\n\n---\n\n' + bodyMdContext : bodyMdContext;
    }
    if (bodyMdFilenames) {
      try {
        const parsed = JSON.parse(bodyMdFilenames) as string[];
        mdFilenames.push(...parsed);
      } catch { /* ignore invalid json */ }
    }

    // Build repo context: if project_id + azure_repos given, fetch real repo list from ADO
    let repoContextForAI: string | null = null;
    if (project_id && azure_repos && azure_repos.trim()) {
      try {
        const project = await Project.findByPk(project_id);
        if (project) {
          const p = (project as any).get({ plain: true });
          if (p.encrypted_pat) {
            const pat = decrypt(p.encrypted_pat);
            const allRepos = await listRepos(p.organization, p.name, patAuthHeader(pat));
            const selectedRepoNames = azure_repos.split(',').map((s: string) => s.trim()).filter(Boolean);
            const matchedRepos = allRepos.filter(r => selectedRepoNames.includes(r.name));
            if (matchedRepos.length > 0) {
              repoContextForAI = `Organization: ${p.organization}\nProject: ${p.name}\n\nSelected Repositories:\n` +
                matchedRepos.map(r => `- ${r.name} (${r.remoteUrl})`).join('\n');
            }
          }
        }
      } catch (repoErr: any) {
        log.warn('Failed to fetch repo context', { repoErr });
        // Fall back to just repo names
        repoContextForAI = `Selected Repositories: ${azure_repos}`;
      }
    } else if (azure_repos && azure_repos.trim()) {
      repoContextForAI = `Selected Repositories: ${azure_repos}`;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    // Determine userId: authenticated > client-provided guest id > new guest id
    let userId: string;
    const clientUserId = (req.body as { client_user_id?: string }).client_user_id;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else if (clientUserId && clientUserId.startsWith('guest:')) {
      userId = clientUserId;
    } else {
      userId = `guest:${Math.random().toString(36).slice(2, 10)}`;
    }

    const doc = await AnalysisDocument.create({
      id,
      user_id: userId,
      title: title.trim(),
      pdf_filename: pdfFile.originalname,
      pdf_text: pdfText,
      user_message: user_message?.trim() || null,
      azure_repos: azure_repos || null,
      md_context: mdContext,
      md_filenames: mdFilenames.length > 0 ? JSON.stringify(mdFilenames) : null,
      md_output: null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    } as any);

    // Resolve AI: try per-user settings first (works for both logged-in and guest if they set it up)
    // then fall back to production env keys
    const aiConfig = await resolveAIProvider(userId);
    if (!aiConfig) {
      res.status(201).json({
        ...(doc as any).get({ plain: true }),
        warning: 'No AI provider configured. Please log in and configure AI settings.',
      });
      return;
    }

    // Mark as analyzing, return immediately, run in background
    (doc as any).status = 'analyzing';
    (doc as any).updated_at = new Date().toISOString();
    await doc.save();

    emitStep(userId, id, 'pdf_parsing', 'Parsing PDF document...');

    // Return doc right away — progress comes via Socket.IO
    res.status(201).json((doc as any).get({ plain: true }));

    // Fire-and-forget background analysis
    if (aiConfig) {
      runAnalysisInBackground(
        id,
        userId,
        pdfText,
        user_message?.trim() || null,
        repoContextForAI,
        mdContext,
        locale,
        aiConfig,
      );
    }
  } catch (err: any) {
    log.error('POST /api/analysis failed', { err });
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ─── Helper: resolve userId from request (auth or guest) ───────────────────
function resolveUserId(req: import('express').Request): string | null {
  if (req.user && req.user.id) return req.user.id;
  const clientId = (req.query.client_user_id ?? (req.body as Record<string,string>)?.client_user_id) as string | undefined;
  if (clientId && clientId.startsWith('guest:')) return clientId;
  return null;
}

// ─── GET /api/analysis — list analyses for current user ─────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) { res.json([]); return; }
    const docs = await AnalysisDocument.findAll({
      where: { user_id: userId },
      attributes: ['id', 'title', 'pdf_filename', 'status', 'md_filenames', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
    });
    res.json(docs.map(d => (d as any).get({ plain: true })));
  } catch (err: any) {
    log.error('GET /api/analysis failed', { err });
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ─── GET /api/analysis/md-files — return distinct MD files from past analyses
router.get('/md-files', async (req, res) => {
  try {
  const userId = resolveUserId(req);
  if (!userId) { res.json([]); return; }
  const docs = await AnalysisDocument.findAll({
    where: { user_id: userId },
    attributes: ['id', 'title', 'md_filenames', 'md_context'],
    order: [['created_at', 'DESC']],
  });

  const mdFiles: { docId: string; docTitle: string; filename: string; content: string }[] = [];
  const seenFilenames = new Set<string>();

  for (const d of docs) {
    const plain = (d as any).get({ plain: true });
    if (!plain.md_filenames || !plain.md_context) continue;

    let filenames: string[];
    try { filenames = JSON.parse(plain.md_filenames); } catch { continue; }

    const sections = (plain.md_context as string).split('\n\n---\n\n');
    for (const section of sections) {
      const headerMatch = section.match(/^### (.+)\n\n([\s\S]*)$/);
      if (!headerMatch) continue;
      const [, fname, content] = headerMatch;
      if (filenames.includes(fname) && !seenFilenames.has(fname)) {
        seenFilenames.add(fname);
        mdFiles.push({ docId: plain.id, docTitle: plain.title, filename: fname, content });
      }
    }
  }

  res.json(mdFiles);
  } catch (err: any) {
    log.error('GET /api/analysis/md-files failed', { err });
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ─── GET /api/analysis/:id — get single analysis ────────────────────────────
router.get('/:id', async (req, res) => {
  const doc = await AnalysisDocument.findByPk(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const plain = (doc as any).get({ plain: true });
  const requestUserId = resolveUserId(req);
  // Allow access if owner or if doc is owned by a guest and requester matches
  if (requestUserId && plain.user_id !== requestUserId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(plain);
});

// ─── PUT /api/analysis/:id — update title or md_output ──────────────────────
router.put('/:id', async (req, res) => {
  const doc = await AnalysisDocument.findByPk(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const plain = (doc as any).get({ plain: true });
  const requestUserId = resolveUserId(req);
  if (!requestUserId || plain.user_id !== requestUserId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { title, md_output } = req.body as { title?: string; md_output?: string };

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400).json({ error: 'title cannot be empty' });
      return;
    }
    (doc as any).title = title.trim();
  }

  if (md_output !== undefined) {
    (doc as any).md_output = md_output;
  }

  (doc as any).updated_at = new Date().toISOString();
  await doc.save();

  res.json((doc as any).get({ plain: true }));
});

// ─── DELETE /api/analysis/:id — delete analysis ─────────────────────────────
router.delete('/:id', async (req, res) => {
  const doc = await AnalysisDocument.findByPk(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const plain = (doc as any).get({ plain: true });
  const requestUserId = resolveUserId(req);
  if (!requestUserId || plain.user_id !== requestUserId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  await doc.destroy();
  res.json({ success: true });
});

// ─── POST /api/analysis/:id/reanalyze — re-run AI analysis (async) ──────────
router.post('/:id/reanalyze', async (req, res) => {
  const doc = await AnalysisDocument.findByPk(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const plain = (doc as any).get({ plain: true });
  const requestUserId = resolveUserId(req);
  if (!requestUserId || plain.user_id !== requestUserId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const aiConfig = await resolveAIProvider(requestUserId);
  if (!aiConfig) {
    res.status(400).json({ error: 'No AI provider configured. Go to AI Settings first.' });
    return;
  }

  const { locale = 'en' } = req.body as { locale?: string };

  (doc as any).status = 'analyzing';
  (doc as any).updated_at = new Date().toISOString();
  await doc.save();

  emitStep(requestUserId, plain.id, 'pdf_parsing', 'Starting re-analysis...');

  // Return immediately
  res.json((doc as any).get({ plain: true }));

  // Run in background
  runAnalysisInBackground(
    plain.id,
    requestUserId,
    plain.pdf_text,
    plain.user_message,
    plain.azure_repos,
    plain.md_context,
    locale,
    aiConfig,
  ).catch(err => log.error('Unhandled re-analysis error', { err, docId: plain.id }));
});

export default router;
