import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MasteryStore } from './mastery';

/**
 * ============================================================================
 *  MASTERY STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi MasteryStore của user từ bảng `user_mastery`. Thay cho file
 *  `mastery.json` cũ (mất dữ liệu trên serverless). Theo đúng mẫu economy-store.
 *  Bảo mật bằng RLS của Supabase (auth.uid() = user_id).
 * ============================================================================
 */

export async function loadMastery(userId: string): Promise<MasteryStore> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { skills: {} };
  return { skills: data.skills ?? {} };
}

export async function saveMastery(userId: string, store: MasteryStore): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_mastery')
    .upsert(
      { user_id: userId, skills: store.skills, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu mastery lên Supabase:', error);
}
