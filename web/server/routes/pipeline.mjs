import { Router } from 'express';
const router = Router();

// GET /api/v1/pipeline
router.get('/', async (req, res, next) => {
  try {
    if (!req.orgId) return res.json([]);

    const { data, error } = await req.supabase
      .from('pipeline')
      .select('*')
      .eq('org_id', req.orgId)
      .order('deadline', { ascending: true, nullsFirst: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// POST /api/v1/pipeline
router.post('/', async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ error: 'Create an organization profile first' });
    }

    const { url, opportunity_id, agency, title, deadline, award_ceiling } = req.body;

    // Dedup check
    const { data: existing } = await req.supabase
      .from('pipeline')
      .select('id')
      .eq('org_id', req.orgId)
      .eq('opportunity_id', opportunity_id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Already in pipeline', existing: true });
    }

    // Also check applications
    const { data: tracked } = await req.supabase
      .from('applications')
      .select('id, status')
      .eq('org_id', req.orgId)
      .eq('opportunity_id', opportunity_id)
      .single();

    if (tracked) {
      return res.status(409).json({
        error: `Already tracked (status: ${tracked.status})`,
        existing: true
      });
    }

    const { data, error } = await req.supabase
      .from('pipeline')
      .insert({
        org_id: req.orgId,
        url,
        opportunity_id,
        agency: agency || '',
        title: title || '',
        deadline: deadline || null,
        award_ceiling: award_ceiling || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Also add to scan history
    await req.supabase.from('scan_history').upsert({
      org_id: req.orgId,
      opportunity_id,
      agency: agency || '',
      title: title || '',
      deadline: deadline || null,
      award_ceiling: award_ceiling || null,
      status: 'new',
    }, { onConflict: 'org_id,opportunity_id' });

    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PUT /api/v1/pipeline/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('pipeline')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/v1/pipeline/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await req.supabase
      .from('pipeline')
      .delete()
      .eq('id', req.params.id)
      .eq('org_id', req.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
