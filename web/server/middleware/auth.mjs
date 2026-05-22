import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

let supabase = null;

function getSupabase() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }
  if (!key || key.includes('your-')) {
    return null;
  }
  if (!supabase) {
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function authMiddleware(req, res, next) {
  const client = getSupabase();
  if (!client) {
    return res.status(503).json({ error: 'Supabase is not configured for authenticated grant tools' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    req.userId = user.id;

    // Fetch org for this user
    const { data: org } = await client
      .from('organizations')
      .select('id')
      .eq('user_id', user.id)
      .single();

    req.orgId = org?.id || null;
    req.supabase = client;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
