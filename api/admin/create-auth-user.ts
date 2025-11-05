import { createClient } from '@supabase/supabase-js';

// Vercel serverless function to securely create a Supabase Auth user
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, password, full_name, role } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ error: 'Server is not configured for admin operations. Expected SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).' });
      return;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify that this email exists in the application users table (bypasses RLS with service role)
    const { data: exists, error: existsErr } = await admin
      .from('dashboard_users')
      .select('email, status')
      .eq('email', email)
      .maybeSingle();

    if (existsErr) {
      res.status(500).json({ error: `Failed to verify application user: ${existsErr.message}` });
      return;
    }
    if (!exists) {
      res.status(403).json({ error: 'Email is not registered in application users' });
      return;
    }

    // Create or ensure the Auth user exists with confirmed email
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ id: data.user?.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}

