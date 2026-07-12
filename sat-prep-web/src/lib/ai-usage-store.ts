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
  count: number;       // vestigial (counter chung cũ) — giữ để không phá chỗ khác
  genCount: number;    // lượt SINH CÂU (generate-practice) trong ngày
  chatCount: number;   // lượt GIA SƯ CHAT (chat) trong ngày
  tokensIn: number;
  tokensOut: number;
}

export async function loadUsage(userId: string): Promise<UsageRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_ai_usage')
    .select('date, count, gen_count, chat_count, tokens_in, tokens_out')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { date: '', count: 0, genCount: 0, chatCount: 0, tokensIn: 0, tokensOut: 0 };
  return {
    date: data.date ?? '',
    count: data.count ?? 0,
    genCount: data.gen_count ?? 0,
    chatCount: data.chat_count ?? 0,
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
export async function incrementUsageAtomic(userId: string, kind: 'gen' | 'chat', date: string, tokensIn: number, tokensOut: number): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_kind: kind,
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
        gen_count: rec.genCount,
        chat_count: rec.chatCount,
        tokens_in: rec.tokensIn,
        tokens_out: rec.tokensOut,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu ai_usage lên Supabase:', error);
}

/**
 * ============================================================================
 *  RESERVE-BEFORE-CALL (đóng C1 TOCTOU, backlog #8) — migration_ai_quota_reserve.sql
 * ============================================================================
 *  reserve_ai_usage kiểm hạn mức + tăng count trong 1 transaction có SELECT..FOR
 *  UPDATE → N request đồng thời KHÔNG cùng vượt cap (mỗi cái thấy count đã tăng của
 *  cái trước). Caller RESERVE trước khi gọi OpenAI; lỗi OpenAI → refund; thành công
 *  → add_ai_tokens (count đã reserve).
 * ============================================================================
 */

export interface ReserveResult {
  allowed: boolean;
  used: number;    // số lượt đã dùng SAU khi reserve (nếu allowed) trong ngày
  limit: number;   // -1 = unlimited
}

/**
 * Reserve 1 lượt AI NGUYÊN TỬ. Trả:
 *   • ReserveResult khi RPC chạy được (đã reserve atomic).
 *   • null khi hàm CHƯA tồn tại (pre-migration 42883/PGRST202) → caller FALLBACK về
 *     checkQuota đọc-thuần (giữ hành vi TOCTOU cũ tới khi migrate — 0 regression).
 *   • {allowed:false, used:-1} khi RPC LỖI THẬT → FAIL-CLOSED (từ chối, KHÔNG gọi
 *     OpenAI) vì đây là cổng chặn chi phí; used:-1 phân biệt với "hết quota" (used>=limit).
 */
export async function reserveUsageAtomic(
  userId: string,
  kind: 'gen' | 'chat',
  date: string,
  limit: number
): Promise<ReserveResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('reserve_ai_usage', {
    p_user_id: userId,
    p_kind: kind,
    p_date: date,
    p_limit: limit,
  });
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') return null; // pre-migration
    console.error('reserve_ai_usage RPC lỗi (fail-closed, từ chối gọi AI):', error.message);
    return { allowed: false, used: -1, limit };
  }
  const row = (data ?? {}) as { allowed?: boolean; used?: number; limit?: number };
  return { allowed: !!row.allowed, used: row.used ?? 0, limit: row.limit ?? limit };
}

/**
 * Hoàn 1 slot đã reserve khi OpenAI LỖI (không phạt quota người dùng vì lỗi hạ tầng).
 * Best-effort: chỉ giảm khi cùng ngày (SQL guard), lỗi RPC nuốt (log) để KHÔNG che
 * lỗi gốc của route. Không cần fallback pre-migration: đường đó chưa reserve gì.
 */
export async function refundUsageAtomic(userId: string, kind: 'gen' | 'chat', date: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('refund_ai_usage', { p_user_id: userId, p_kind: kind, p_date: date });
  if (error && error.code !== '42883' && error.code !== 'PGRST202') {
    console.error('refund_ai_usage RPC lỗi (bỏ qua):', error.message);
  }
}

/**
 * Cộng token sau khi gọi OpenAI xong (count đã reserve từ bước reserve). Best-effort.
 */
export async function addAiTokensAtomic(userId: string, date: string, tokensIn: number, tokensOut: number): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('add_ai_tokens', {
    p_user_id: userId,
    p_date: date,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
  });
  if (error && error.code !== '42883' && error.code !== 'PGRST202') {
    console.error('add_ai_tokens RPC lỗi (bỏ qua):', error.message);
  }
}
