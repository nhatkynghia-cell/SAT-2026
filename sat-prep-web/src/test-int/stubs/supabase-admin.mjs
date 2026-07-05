/* Thay `@/lib/supabase/admin` — trả client fake in-memory (đường GHI/service-role). */
import { makeClient } from '../fake-db.mjs';

export function createAdminClient() {
  return makeClient();
}
