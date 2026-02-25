import { Router } from 'express';
import requireAuth from '../middleware/requireAuth';
import { Project, Sprint } from '../db/schema';
import { patAuthHeader, calculateSprintMetrics, calculateSprintTrends, SprintTrend } from '../services/azDevops';
import { decrypt } from '../utils/crypto';
import { generateSprintInsights } from '../services/aiInsights';

const router = Router();

// All metrics routes require authentication
router.use(requireAuth);

/**
 * GET /api/metrics/projects/:projectId/sprints/:sprintId
 * Get detailed metrics for a specific sprint
 */
router.get('/projects/:projectId/sprints/:sprintId', async (req, res) => {
  const { projectId, sprintId } = req.params;
  const userId = req.user!.id;

  try {
    // Verify project ownership
    const project = await Project.findOne({
      where: { id: projectId, user_id: userId },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const projectPlain = project.get({ plain: true });

    if (!projectPlain.encrypted_pat) {
      res.status(400).json({ error: 'Project does not have Azure DevOps credentials configured' });
      return;
    }

    // Decrypt PAT
    const pat = decrypt(projectPlain.encrypted_pat);
    const authHeader = patAuthHeader(pat);

    // Fetch sprint info
    const sprint = await Sprint.findOne({
      where: { id: sprintId, project_id: projectId },
    });

    if (!sprint) {
      res.status(404).json({ error: 'Sprint not found' });
      return;
    }

    const sprintPlain = sprint.get({ plain: true });

    if (!sprintPlain.ado_sprint_id) {
      res.status(400).json({ error: 'Sprint is not linked to Azure DevOps' });
      return;
    }

    // Calculate metrics
    const metrics = await calculateSprintMetrics(
      projectPlain.organization,
      projectPlain.name,
      projectPlain.team ?? projectPlain.name,
      sprintPlain.ado_sprint_id,
      authHeader,
    );

    res.json(metrics);
  } catch (err: any) {
    console.error('Error fetching sprint metrics:', err);
    res.status(500).json({ error: err.message ?? 'Failed to fetch sprint metrics' });
  }
});

/**
 * GET /api/metrics/projects/:projectId/trends
 * Get trend data for recent sprints
 */
router.get('/projects/:projectId/trends', async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    // Verify project ownership
    const project = await Project.findOne({
      where: { id: projectId, user_id: userId },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const projectPlain = project.get({ plain: true });

    if (!projectPlain.encrypted_pat) {
      res.status(400).json({ error: 'Project does not have Azure DevOps credentials configured' });
      return;
    }

    // Get recent sprints
    const sprints = await Sprint.findAll({
      where: { project_id: projectId },
      order: [['start_date', 'DESC']],
      limit,
    });

    const sprintIds = sprints
      .map(s => s.get({ plain: true }))
      .filter(s => s.ado_sprint_id)
      .map(s => s.ado_sprint_id!);

    if (sprintIds.length === 0) {
      res.json([]);
      return;
    }

    // Decrypt PAT
    const pat = decrypt(projectPlain.encrypted_pat);
    const authHeader = patAuthHeader(pat);

    // Calculate trends
    const trends = await calculateSprintTrends(
      projectPlain.organization,
      projectPlain.name,
      projectPlain.team ?? projectPlain.name,
      sprintIds,
      authHeader,
    );

    res.json(trends);
  } catch (err: any) {
    console.error('Error fetching sprint trends:', err);
    res.status(500).json({ error: err.message ?? 'Failed to fetch sprint trends' });
  }
});

/**
 * POST /api/metrics/projects/:projectId/sprints/:sprintId/insights
 * Generate AI insights for a sprint
 */
router.post('/projects/:projectId/sprints/:sprintId/insights', async (req, res) => {
  const { projectId, sprintId } = req.params;
  const userId = req.user!.id;

  try {
    // Verify project ownership
    const project = await Project.findOne({
      where: { id: projectId, user_id: userId },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const projectPlain = project.get({ plain: true });

    if (!projectPlain.encrypted_pat) {
      res.status(400).json({ error: 'Project does not have Azure DevOps credentials configured' });
      return;
    }

    // Decrypt PAT
    const pat = decrypt(projectPlain.encrypted_pat);
    const authHeader = patAuthHeader(pat);

    // Fetch sprint info
    const sprint = await Sprint.findOne({
      where: { id: sprintId, project_id: projectId },
    });

    if (!sprint) {
      res.status(404).json({ error: 'Sprint not found' });
      return;
    }

    const sprintPlain = sprint.get({ plain: true });

    if (!sprintPlain.ado_sprint_id) {
      res.status(400).json({ error: 'Sprint is not linked to Azure DevOps' });
      return;
    }

    // Get current sprint metrics
    const currentMetrics = await calculateSprintMetrics(
      projectPlain.organization,
      projectPlain.name,
      projectPlain.team ?? projectPlain.name,
      sprintPlain.ado_sprint_id,
      authHeader,
    );

    // Get recent sprints for trend analysis
    const recentSprints = await Sprint.findAll({
      where: { project_id: projectId },
      order: [['start_date', 'DESC']],
      limit: 5,
    });

    const trendSprintIds = recentSprints
      .map(s => s.get({ plain: true }))
      .filter(s => s.ado_sprint_id && s.id !== sprintId)
      .map(s => s.ado_sprint_id!);

    let trends: SprintTrend[] = [];
    if (trendSprintIds.length > 0) {
      trends = await calculateSprintTrends(
        projectPlain.organization,
        projectPlain.name,
        projectPlain.team ?? projectPlain.name,
        trendSprintIds,
        authHeader,
      );
    }

    // Generate AI insights
    const insights = await generateSprintInsights(userId, currentMetrics, trends);

    res.json(insights);
  } catch (err: any) {
    console.error('Error generating sprint insights:', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate insights' });
  }
});

export default router;
