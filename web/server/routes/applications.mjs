import { Router } from 'express';
const router = Router();

// GET /api/v1/applications
router.get('/', async (req, res, next) => {
  try {
    if (!req.orgId) return res.json([]);

    let query = req.supabase
      .from('applications')
      .select('*')
      .eq('org_id', req.orgId)
      .order('entry_num', { ascending: false });

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// PUT /api/v1/applications/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await req.supabase
      .from('applications')
      .update(updates)
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
