import { Router } from 'express';
import { fetchOpportunity } from '../lib/grants-api.mjs';
import { buildBudget } from '../lib/claude.mjs';

const router = Router();

// POST /api/v1/budget
router.post('/', async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ error: 'Create an organization profile first' });
    }

    const { opportunity_id, parameters } = req.body;
    if (!opportunity_id) {
      return res.status(400).json({ error: 'opportunity_id is required' });
    }

    const opportunity = await fetchOpportunity(opportunity_id);

    const { data: org } = await req.supabase
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();

    const budgetText = await buildBudget(opportunity, org, parameters || {});

    // Parse JSON from response
    let budget;
    try {
      const jsonMatch = budgetText.match(/\{[\s\S]*\}/);
      budget = JSON.parse(jsonMatch ? jsonMatch[0] : budgetText);
    } catch {
      budget = { raw: budgetText };
    }

    res.json(budget);
  } catch (err) { next(err); }
});

export default router;
