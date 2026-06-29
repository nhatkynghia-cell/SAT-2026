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
}

/**
 * Sinh khóa cache ổn định từ ngữ cảnh câu hỏi + tin nhắn của học sinh.
 * userMessage hạ thường để tăng tỉ lệ trùng (vd "Giải thích" ~ "giải thích").
 */
export function chatCacheHash(parts: ChatCacheParts): string {
  const norm = (s: string) => (s ?? '').trim();
  const key = [
    norm(parts.question),
    norm(parts.correctAnswer),
    norm(parts.selectedAnswer),
    norm(parts.userMessage).toLowerCase(),
  ].join('');
  return crypto.createHash('sha256').update(key).digest('hex');
}
