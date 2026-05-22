import { Router } from 'express';
const router = Router();

// GET /api/v1/reports
router.get('/', async (req, res, next) => {
  try {
    if (!req.orgId) return res.json([]);

    const { data, error } = await req.supabase
      .from('reports')
      .select('id, entry_num, agency, program, opportunity_id, score, category, deadline, status, created_at')
      .eq('org_id', req.orgId)
      .order('entry_num', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// GET /api/v1/reports/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('reports')
      .select('*')
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/v1/reports/:id — remove an evaluation report and linked tracker entry
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.orgId) return res.status(404).json({ error: 'No organization profile found' });

    const { data: report, error: reportError } = await req.supabase
      .from('reports')
      .select('id, opportunity_id')
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .single();

    if (reportError) throw reportError;

    const { error: appError } = await req.supabase
      .from('applications')
      .delete()
      .eq('org_id', req.orgId)
      .eq('report_id', report.id);

    if (appError) throw appError;

    const { error: deleteError } = await req.supabase
      .from('reports')
      .delete()
      .eq('id', report.id)
      .eq('org_id', req.orgId);

    if (deleteError) throw deleteError;

    if (report.opportunity_id) {
      const { error: pipelineError } = await req.supabase
        .from('pipeline')
        .update({ status: 'pending' })
        .eq('org_id', req.orgId)
        .eq('opportunity_id', report.opportunity_id);

      if (pipelineError) throw pipelineError;
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
