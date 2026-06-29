import { createClient } from '@/lib/supabase/server';
import type { GoalData } from './score-prediction';

/**
 * ============================================================================
 *  GOALS STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi điểm mục tiêu của user từ bảng `user_goals`. Thay cho file
 *  `goals.json` cũ. Theo mẫu economy-store. Bảo mật bằng RLS (auth.uid()=user_id).
 * ============================================================================
 */

export async function loadGoal(userId: string): Promise<GoalData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_goals')
    .select('target_score, updated_at')
    .eq('user_id', userId)
    .single();

  if (error || !data || typeof data.target_score !== 'number') return null;
  return { targetScore: data.target_score, updatedAt: data.updated_at };
}

export async function saveGoal(userId: string, goal: GoalData): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_goals')
    .upsert(
      { user_id: userId, target_score: goal.targetScore, updated_at: goal.updatedAt },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu goal lên Supabase:', error);
}
