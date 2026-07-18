import crypto from 'crypto';

/**
 * ============================================================================
 *  AI CHAT CACHE — LÕI THUẦN (pure) — task 5.3
 * ============================================================================
 *  Tách phần THUẦN (sinh khóa cache) khỏi I/O Supabase (chat-cache-store.ts),
 *  theo đúng mẫu economy.ts (pure) ↔ economy-store.ts (I/O). Nhờ vậy hash
 *  unit-test được mà không kéo theo `@/lib/supabase/server` (next/headers).
 * ============================================================================
 */

export interface ChatCacheParts {
  question: string;
  correctAnswer: string;
  selectedAnswer: string;
  userMessage: string;
  /**
   * Model AI sinh ra câu trả lời (quyền lợi A1 2026-07-07). PHẢI vào khóa: nếu
   * không, học sinh Ultimate hỏi trùng câu Free đã hỏi sẽ nhận lại đáp án
   * gpt-4o-mini (quyền lợi "model cao cấp" biến mất trong im lặng), và ngược lại
   * Free sẽ hưởng ké đáp án gpt-4o. Mỗi model = một khoang cache riêng.
   * Bỏ trống → coi như '' (giữ khóa cũ cho caller chưa truyền → 0 regression).
   */
  model?: string;
}

/**
 * Sinh khóa cache ổn định từ ngữ cảnh câu hỏi + tin nhắn của học sinh + model.
 * userMessage hạ thường để tăng tỉ lệ trùng (vd "Giải thích" ~ "giải thích").
 */
export function chatCacheHash(parts: ChatCacheParts): string {
  const norm = (s: string) => (s ?? '').trim();
  const key = [
    norm(parts.question),
    norm(parts.correctAnswer),
    norm(parts.selectedAnswer),
    norm(parts.userMessage).toLowerCase(),
    // Phân khoang theo model (thêm CUỐI): caller cũ không truyền → '' → khóa
    // trùng hệt bản trước khi tách model, nên cache cũ vẫn dùng lại được.
    norm(parts.model ?? ''),
  ].join('');
  return crypto.createHash('sha256').update(key).digest('hex');
}
