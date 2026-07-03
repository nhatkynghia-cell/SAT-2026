import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: ReturnType<typeof createSupabaseClient<any>> | null = null;

export function createAdminClient() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY hoặc NEXT_PUBLIC_SUPABASE_URL chưa set. ' +
      'Thêm SUPABASE_SERVICE_ROLE_KEY vào env (server-only, KHÔNG NEXT_PUBLIC_).'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _admin = createSupabaseClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
