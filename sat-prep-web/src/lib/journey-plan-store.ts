import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WeeklyPlan } from './journey-plan';

/**
 * ============================================================================
 *  JOURNEY PLAN STORE (Supabase Postgres) — Cụm A2 (LỘ TRÌNH CÁ NHÂN)
 * ============================================================================
 *  Đọc/ghi lộ trình luyện theo tuần của user từ bảng `user_plans`. Theo mẫu
 *  goals-store: đọc qua RLS session của user, ghi qua admin client (upsert).
 *  Fail-safe: bảng chưa tạo / lỗi → trả null (UI sẽ tự dựng lại từ mastery).
 * ============================================================================
 */

export async function loadPlan(userId: string): Promise<WeeklyPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('user_id', userId)
    .single();

  if (error || !data || !data.plan || typeof data.plan !== 'object') return null;
  const plan = data.plan as WeeklyPlan;
  // Bản ghi mặc định '{}' (chưa có lộ trình thật) → coi như chưa có.
  if (!Array.isArray(plan.weeks)) return null;
  return plan;
}

export async function savePlan(userId: string, plan: WeeklyPlan): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_plans')
    .upsert(
      { user_id: userId, plan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu lộ trình lên Supabase:', error);
}
