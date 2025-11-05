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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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

    // Try to create the Auth user
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (created.error) {
      const msg = (created.error.message || '').toLowerCase();
      const isDuplicate = msg.includes('already') && (msg.includes('registered') || msg.includes('exist'));
      if (!isDuplicate) {
        res.status(400).json({ error: created.error.message });
        return;
      }
      // User already exists — update password and confirm email instead
      // 1) Try to find user by email via admin.listUsers (iterate a few pages)
      let foundId: string | null = null;
      try {
        for (let page = 1; page <= 5 && !foundId; page++) {
          const { data: lu, error: le } = await (admin as any).auth.admin.listUsers({ page, perPage: 200 });
          if (le) break;
          const u = (lu?.users || []).find((x: any) => (x.email || '').toLowerCase() === (email || '').toLowerCase());
          if (u) foundId = u.id;
          if (!lu?.users?.length) break; // no more pages
        }
      } catch {}

      // Fallback: attempt to query auth.users via PostgREST (service role can read it)
      if (!foundId) {
        try {
          const { data: au } = await admin.from('auth.users' as any).select('id,email').eq('email', email).maybeSingle();
          if (au?.id) foundId = au.id as string;
        } catch {}
      }

      if (!foundId) {
        // As a last resort, send a recovery link so the user can set a password
        try {
          await (admin as any).auth.admin.generateLink({ type: 'recovery', email });
        } catch {}
        res.status(400).json({ error: 'A user with this email already exists. A password reset link has been sent.' });
        return;
      }

      const updated = await (admin as any).auth.admin.updateUserById(foundId, {
        password,
        email_confirm: true,
        user_metadata: { full_name, role }
      });
      if (updated.error) {
        res.status(400).json({ error: updated.error.message });
        return;
      }
      res.status(200).json({ id: updated.data.user?.id });
      return;
    }

    res.status(200).json({ id: created.data.user?.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}

