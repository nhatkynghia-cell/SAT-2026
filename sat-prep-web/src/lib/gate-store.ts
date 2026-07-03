import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GATES_KEY, type GateProgress, type GateResult } from './gate-exam';

/**
 * Gate progress storage — uses `__gates__` key inside `user_mastery.skills` JSONB.
 * No new table needed.
 *
 * ⚠️ Đếm câu đúng tích lũy (cooldown thi lại) KHÔNG ghi ở đây nữa — nó được gộp
 * vào chính lần ghi của `recordAnswer` (mastery.ts) qua `bumpDomainGateProgress`
 * để tránh race read-modify-write trên cùng dòng `user_mastery`.
 */

export async function loadGates(userId: string): Promise<Record<string, GateProgress>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  if (!data?.skills) return {};
  const gates = (data.skills as Record<string, unknown>)[GATES_KEY];
  if (!gates || typeof gates !== 'object') return {};
  return gates as Record<string, GateProgress>;
}

export async function saveGateResult(
  userId: string,
  domainId: string,
  result: GateResult
): Promise<void> {
  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  // ⚠️ Bảo vệ chống MẤT DỮ LIỆU: upsert thay TOÀN BỘ cột `skills`. Nếu read lỗi
  // (kể cả "no rows" PGRST116) mà ta vẫn ghi với skills={...} thì sẽ XÓA SẠCH
  // mastery thật. User đủ điều kiện thi cổng LUÔN đã có dòng mastery (avg>=40),
  // nên bất kỳ lỗi read nào → bail, KHÔNG ghi.
  if (readError) {
    console.error('saveGateResult: read lỗi, hủy ghi để tránh xóa mastery:', readError);
    return;
  }

  const skills = (data?.skills ?? {}) as Record<string, unknown>;
  const gates = ((skills[GATES_KEY] ?? {}) as Record<string, GateProgress>);

  gates[domainId] = {
    passed: result.passed,
    lastAttempt: new Date().toISOString(),
    score: result.score,
    correctSinceFail: 0,
  };

  skills[GATES_KEY] = gates;

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_mastery')
    .upsert(
      { user_id: userId, skills, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu gate result:', error);
}
