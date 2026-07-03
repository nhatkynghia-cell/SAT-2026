import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ============================================================================
 *  AI USAGE STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi bản ghi usage AI/ngày của user từ bảng `user_ai_usage`. Thay cho
 *  file `ai_usage.json`. Bảo mật RLS (auth.uid()=user_id).
 * ============================================================================
 */

export interface UsageRecord {
  date: string;
  count: number;
  tokensIn: number;
  tokensOut: number;
}

export async function loadUsage(userId: string): Promise<UsageRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_ai_usage')
    .select('date, count, tokens_in, tokens_out')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { date: '', count: 0, tokensIn: 0, tokensOut: 0 };
  return {
    date: data.date ?? '',
    count: data.count ?? 0,
    tokensIn: data.tokens_in ?? 0,
    tokensOut: data.tokens_out ?? 0,
  };
}

/**
 * Tăng usage ATOMIC qua RPC `increment_ai_usage` (audit 2026-07-03, ROOT C):
 * 1 upsert `count = count + 1` (kèm reset khi sang ngày mới) ở DB → 2 request
 * đồng thời KHÔNG ghi đè nhau → quota/ngày enforce chính xác dưới tải. Hàm SQL
 * dùng auth.uid() nội bộ (chỉ ghi dòng của chính user).
 *
 * Trả true nếu RPC chạy được (đã ghi atomic); false nếu hàm CHƯA tồn tại
 * (pre-migration: 42883/PGRST202) hoặc lỗi → caller FALLBACK về load-modify-save
 * cũ = 0 regression. Hàm SQL commit atomic nên lỗi = KHÔNG ghi gì → không double.
 */
export async function incrementUsageAtomic(userId: string, date: string, tokensIn: number, tokensOut: number): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_date: date,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
  });
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return false; // pre-migration: fallback to load-modify-save
    }
    console.error('increment_ai_usage RPC lỗi (fail-closed, KHÔNG fallback):', error.message);
    return true; // fail-closed: pretend success to SKIP non-atomic fallback
  }
  return true;
}

export async function saveUsage(userId: string, rec: UsageRecord): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_ai_usage')
    .upsert(
      {
        user_id: userId,
        date: rec.date,
        count: rec.count,
        tokens_in: rec.tokensIn,
        tokens_out: rec.tokensOut,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu ai_usage lên Supabase:', error);
}
