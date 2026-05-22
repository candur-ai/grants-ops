import { Router } from 'express';
const router = Router();

// GET /api/v1/dashboard
router.get('/', async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.json({
        has_profile: false,
        counts: {},
        upcoming_deadlines: [],
        pipeline_pending: 0,
        recent: [],
        compliance_alerts: [],
      });
    }

    // Fetch all data in parallel
    const [appsResult, pipelineResult, orgResult] = await Promise.all([
      req.supabase
        .from('applications')
        .select('*')
        .eq('org_id', req.orgId),
      req.supabase
        .from('pipeline')
        .select('*')
        .eq('org_id', req.orgId)
        .eq('status', 'pending'),
      req.supabase
        .from('organizations')
        .select('ein, uei, sam_registration')
        .eq('id', req.orgId)
        .single(),
    ]);

    const apps = appsResult.data || [];
    const pipeline = pipelineResult.data || [];
    const org = orgResult.data;

    // Counts by status
    const counts = {};
    for (const app of apps) {
      counts[app.status] = (counts[app.status] || 0) + 1;
    }

    // Upcoming deadlines (next 30 days)
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = apps
      .filter(a => a.deadline && new Date(a.deadline) > now && new Date(a.deadline) <= thirtyDays)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 10)
      .map(a => ({
        program: a.program,
        agency: a.agency,
        deadline: a.deadline,
        status: a.status,
        days_left: Math.ceil((new Date(a.deadline) - now) / (24 * 60 * 60 * 1000)),
      }));

    // Recent entries
    const recent = apps
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Compliance alerts
    const alerts = [];
    if (!org?.uei) alerts.push({ type: 'danger', message: 'Missing UEI — required for all federal grants' });
    if (!org?.ein) alerts.push({ type: 'warning', message: 'Missing EIN — needed for most applications' });
    if (org?.sam_registration?.status !== 'active') {
      alerts.push({ type: 'danger', message: 'SAM.gov registration not active — required for federal grants' });
    }

    // Win rate
    const applied = apps.filter(a => ['Applied', 'Under Review', 'Awarded', 'Not Funded'].includes(a.status)).length;
    const awarded = apps.filter(a => a.status === 'Awarded').length;

    res.json({
      has_profile: true,
      counts,
      upcoming_deadlines: upcoming,
      pipeline_pending: pipeline.length,
      recent,
      compliance_alerts: alerts,
      win_rate: applied > 0 ? (awarded / applied * 100).toFixed(0) : null,
      total_applications: apps.length,
    });
  } catch (err) { next(err); }
});

export default router;
