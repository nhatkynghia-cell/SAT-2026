import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ONBOARDING_KEY, readOnboarding, setOnboardingFlag, type OnboardingState } from './onboarding';
import type { CEFRLevel } from './score-math';

/**
 * Onboarding storage — dùng key `__onboarding__` trong `user_mastery.skills`
 * JSONB. Không bảng mới. Mirror gate-store.ts.
 */

export async function loadOnboarding(userId: string): Promise<OnboardingState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  return readOnboarding((data?.skills ?? null) as Record<string, unknown> | null);
}

export async function saveOnboardingComplete(userId: string, targetLevel?: CEFRLevel): Promise<void> {
  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  // ⚠️ Bảo vệ chống MẤT DỮ LIỆU (giống saveGateResult): upsert thay TOÀN BỘ cột
  // `skills`. Nếu read lỗi (kể cả "no rows" PGRST116) mà vẫn ghi với skills={...}
  // thì sẽ XÓA SẠCH mastery + gates thật. User hoàn tất diagnostic LUÔN đã có dòng
  // mastery (các câu đã chấm qua /api/grade → saveMastery), nên lỗi read → bail.
  if (readError) {
    console.error('saveOnboardingComplete: read lỗi, hủy ghi để tránh xóa mastery:', readError);
    return;
  }

  const skills = (data?.skills ?? {}) as Record<string, unknown>;
  setOnboardingFlag(skills, {
    completedAt: new Date().toISOString(),
    ...(targetLevel ? { targetLevel } : {}),
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_mastery')
    .upsert(
      { user_id: userId, skills, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu onboarding:', error);
}

export { ONBOARDING_KEY };
