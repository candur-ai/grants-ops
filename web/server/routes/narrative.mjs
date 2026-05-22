import { Router } from 'express';
import { fetchOpportunity } from '../lib/grants-api.mjs';
import { generateNarrative } from '../lib/claude.mjs';

const router = Router();

// POST /api/v1/narrative
router.post('/', async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ error: 'Create an organization profile first' });
    }

    const { opportunity_id, section, instructions } = req.body;
    if (!opportunity_id || !section) {
      return res.status(400).json({ error: 'opportunity_id and section are required' });
    }

    // Fetch opportunity
    const opportunity = await fetchOpportunity(opportunity_id);

    // Load org profile
    const { data: org } = await req.supabase
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();

    // Load evaluation report if available
    const { data: report } = await req.supabase
      .from('reports')
      .select('body_md')
      .eq('org_id', req.orgId)
      .eq('opportunity_id', opportunity_id)
      .single();

    const narrative = await generateNarrative(
      section,
      opportunity,
      org,
      report?.body_md || '',
      instructions || ''
    );

    res.json({ section, narrative });
  } catch (err) { next(err); }
});

export default router;
