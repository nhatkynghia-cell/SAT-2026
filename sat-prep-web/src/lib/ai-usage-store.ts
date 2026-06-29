import { createClient } from '@/lib/supabase/server';

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

export async function saveUsage(userId: string, rec: UsageRecord): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
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
