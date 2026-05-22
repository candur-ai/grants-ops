import { Router } from 'express';
const router = Router();

// GET /api/v1/profile
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('organizations')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json(null); // No profile yet
    }
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/v1/profile (create)
router.post('/', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('organizations')
      .insert({ ...req.body, user_id: req.userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PUT /api/v1/profile (update)
router.put('/', async (req, res, next) => {
  try {
    const { user_id, id, created_at, ...updates } = req.body;
    let orgId = req.orgId;

    if (!orgId) {
      const { data: existing, error: lookupError } = await req.supabase
        .from('organizations')
        .select('id')
        .eq('user_id', req.userId)
        .single();

      if (lookupError && lookupError.code !== 'PGRST116') throw lookupError;
      orgId = existing?.id || null;
    }

    if (!orgId) {
      const { data, error } = await req.supabase
        .from('organizations')
        .insert({ ...updates, user_id: req.userId })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    const { data, error } = await req.supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
