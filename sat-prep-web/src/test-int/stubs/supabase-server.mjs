/* Thay `@/lib/supabase/server` — trả client fake in-memory (đường ĐỌC/anon). */
import { makeClient } from '../fake-db.mjs';

export async function createClient() {
  return makeClient();
}
