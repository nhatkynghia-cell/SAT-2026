import { createClient } from '@/lib/supabase/server';
import { chatCacheHash } from './chat-cache';

/**
 * ============================================================================
 *  AI CHAT CACHE STORE (Supabase) — implementation_plan.md §9.5 / task 5.3
 * ============================================================================
 *  Cache câu trả lời Gia sư AI để TIẾT KIỆM TOKEN khi nhiều học sinh hỏi GIỐNG
 *  NHAU về cùng một câu hỏi Cambridge. Khác các bảng user_* (1 dòng/user): bảng này
 *  DÙNG CHUNG toàn hệ thống — 1 câu trả lời phục vụ mọi học sinh.
 *
 *  ⚠️ HỆ QUẢ RLS: KHÔNG scope theo `auth.uid()=user_id` được (cache chia sẻ).
 *  Policy phải là "mọi user đã đăng nhập đọc/ghi được" (xem ai_chat_cache.sql).
 *  Bảng chỉ chứa lời giải câu hỏi Cambridge — KHÔNG có PII → chia sẻ là an toàn.
 *
 *  CHỈ cache hội thoại 1-LƯỢT (history rỗng). Hội thoại nhiều lượt vốn duy nhất
 *  → hash sẽ gần như không trùng, cache vô nghĩa.
 *
 *  Lõi sinh khóa (thuần, không I/O) tách sang chat-cache.ts để unit-test được;
 *  re-export ở đây để caller cũ (api/chat) vẫn import từ store như trước.
 * ============================================================================
 */
export { chatCacheHash };

export interface CachedReply {
  reply: string;
  hitCount: number;
}

/** Tra cache theo hash. null nếu chưa có (miss). */
export async function getCachedReply(hash: string): Promise<CachedReply | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_chat_cache')
    .select('ai_response, hit_count')
    .eq('cache_hash', hash)
    .single();

  if (error || !data) return null;
  return { reply: data.ai_response, hitCount: data.hit_count ?? 1 };
}

/**
 * Tăng số lần dùng lại cache (best-effort, fire-and-forget).
 * Đây chỉ là chỉ số đo lường — sai lệch nhỏ do race là chấp nhận được, nên
 * KHÔNG dùng atomic increment (tránh thêm DB function vào schema PRODUCTION).
 */
export async function bumpHitCount(hash: string, current: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ai_chat_cache')
    .update({ hit_count: current + 1 })
    .eq('cache_hash', hash);
  if (error) console.error('Lỗi tăng hit_count chat cache:', error);
}

/** Lưu câu trả lời AI vào cache (upsert theo cache_hash). */
export async function saveCachedReply(
  hash: string,
  userQuery: string,
  aiResponse: string,
  questionId?: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ai_chat_cache')
    .upsert(
      {
        cache_hash: hash,
        question_id: questionId ?? null,
        user_query: userQuery,
        ai_response: aiResponse,
        hit_count: 1,
      },
      { onConflict: 'cache_hash' }
    );
  if (error) console.error('Lỗi lưu chat cache:', error);
}
