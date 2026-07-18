import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkQuota, reserveQuota, finalizeUsage, releaseUsage } from '@/lib/ai-quota';
import { getUserTier } from '@/lib/subscription-store';
import { checkBudget, recordGlobalCost, modelForTier } from '@/lib/ai-cost';
import {
  chatCacheHash,
  getCachedReply,
  bumpHitCount,
  saveCachedReply,
} from '@/lib/chat-cache-store';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';
import { rateLimit } from '@/lib/rate-limit';

/**
 * ============================================================================
 *  AI TUTOR CHAT (implementation_plan.md §9.2, task #3 + cache §9.5 task 5.3)
 * ============================================================================
 *  TRƯỚC: route forward nguyên `body` client sang OpenAI → client tự chọn
 *  model, max_tokens, nhồi prompt tùy ý (rủi ro chi phí + prompt injection).
 *
 *  NAY (server-authoritative cho lời gọi AI):
 *    • Model & max_tokens & temperature CỐ ĐỊNH ở server.
 *    • System prompt DỰNG Ở SERVER từ dữ liệu ngữ cảnh client gửi.
 *    • Enforce quota freemium theo user_id + ngày (Free = 5 lượt/ngày).
 *    • Ghi nhận token usage (nền cho task #5).
 *    • CACHE chia sẻ (ai_chat_cache): nếu nhiều HS hỏi GIỐNG NHAU về cùng câu
 *      hỏi → trả lại câu đã lưu, KHÔNG gọi OpenAI (tiết kiệm token). Cache hit
 *      KHÔNG tốn token nên KHÔNG trừ quota / không tính ngân sách.
 * ============================================================================
 */

// Cấu hình cứng ở server — client KHÔNG được phép override.
// MODEL nay theo GÓI (quyền lợi A1 2026-07-07): Ultimate = gpt-4o, còn lại =
// gpt-4o-mini. Lấy từ modelForTier() SAU khi biết tier (xem trong handler).
const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;

// Giới hạn input để chống lạm dụng.
const MAX_MSG_LEN = 1000;
const MAX_HISTORY = 12;
const MAX_CTX_LEN = 4000;

interface ChatRequest {
  question?: string;
  correctAnswer?: string;
  selectedAnswer?: string | null;
  explanation?: string;
  history?: { role: 'user' | 'ai'; text: string }[];
  userMessage?: string;
}

function clamp(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : '';
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    // Rate-limit per-user (chống burst đồng thời vượt quota + giảm race TOCTOU).
    // Áp cho MỌI tier — premium/ultimate quota vô hạn nên đây là trần duy nhất
    // chặn 1 tài khoản đốt sạch budget chung.
    const rl = rateLimit(`chat:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Bạn hỏi hơi nhanh. Chờ chút rồi thử lại nhé.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    // Phase 2: tier THẬT từ subscription (fail-safe → 'free' khi lỗi/không có gói).
    const tier = await getUserTier(user.id);
    // Quyền lợi A1 (2026-07-07): Ultimate dùng model cao cấp (gpt-4o), còn lại
    // gpt-4o-mini. Model vào KHÓA CACHE (dưới) để các gói không hưởng ké nhau.
    const model = modelForTier(tier);

    const body: ChatRequest = await request.json();

    const userMessage = clamp(body.userMessage, MAX_MSG_LEN);
    if (!userMessage.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung câu hỏi" }, { status: 400 });
    }

    // Ngữ cảnh câu hỏi (clamp 1 lần, dùng lại cho cả hash cache lẫn system prompt).
    const ctxQuestion = clamp(body.question, MAX_CTX_LEN);
    const ctxCorrect = clamp(body.correctAnswer, MAX_MSG_LEN);
    const ctxSelected = clamp(body.selectedAnswer, MAX_MSG_LEN);
    const ctxExplanation = clamp(body.explanation, MAX_CTX_LEN);

    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

    // CACHE LOOKUP (chỉ hội thoại 1-LƯỢT — nhiều lượt vốn duy nhất, hash không
    // trùng). Tra TRƯỚC quota/budget vì cache hit không tốn token của ta.
    const cacheable = history.length === 0;
    let cacheHash = '';
    if (cacheable) {
      cacheHash = chatCacheHash({
        question: ctxQuestion,
        correctAnswer: ctxCorrect,
        selectedAnswer: ctxSelected,
        userMessage,
        model, // phân khoang cache theo model → Ultimate không nhận đáp án mini
      });
      const cached = await getCachedReply(cacheHash);
      if (cached) {
        bumpHitCount(cacheHash, cached.hitCount).catch((e) => console.error('bumpHitCount:', e));
        const q = await checkQuota(user.id, tier, 'chat');
        return NextResponse.json({
          reply: cached.reply,
          cached: true,
          quota: { used: q.used, limit: q.limit, remaining: q.remaining },
        });
      }
    }

    // 1) Quota freemium: enforce qua RESERVE-BEFORE-CALL (đóng C1 TOCTOU) — đặt
    // NGAY TRƯỚC lời gọi OpenAI, SAU khi qua cổng apiKey + budget (để bail sớm
    // KHÔNG chiếm slot). Xem khối reserve phía dưới.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chưa cấu hình OPENAI_API_KEY ở server" }, { status: 500 });
    }

    // 2) Kill-switch ngân sách toàn hệ thống (§9.5): chặn gọi AI mới nếu đã vượt
    // trần chi phí ngày. Chat không có Question Bank để degrade nên trả 503.
    const budget = await checkBudget();
    if (!budget.allowed) {
      return NextResponse.json(
        {
          error: "Gia sư AI tạm nghỉ do đã đạt giới hạn vận hành trong ngày. Vui lòng quay lại sau nhé!",
          budgetExceeded: true,
        },
        { status: 503 }
      );
    }

    // 2b) RESERVE 1 lượt NGUYÊN TỬ (increment có khóa dòng) TRƯỚC khi gọi OpenAI.
    // N request đồng thời không cùng vượt cap (mỗi cái thấy count đã +1 của cái
    // trước) → không burst đốt OpenAI vượt hạn mức. Lỗi RPC → fail-closed (từ chối).
    const reservation = await reserveQuota(user.id, tier, 'chat');
    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã dùng hết ${reservation.limit} lượt hỏi Gia sư AI hôm nay. Nâng cấp Premium để hỏi không giới hạn nhé!`,
          quotaExceeded: true,
          used: reservation.used,
          limit: reservation.limit,
        },
        { status: 429 }
      );
    }

    // 3) DỰNG system prompt ở server (client chỉ cung cấp dữ liệu ngữ cảnh).
    const systemPrompt =
      `Bạn là một chuyên gia khảo thí và gia sư luyện thi SAT cực kỳ xuất sắc. ` +
      `Câu hỏi hiện tại: "${ctxQuestion}". ` +
      `Đáp án đúng: "${ctxCorrect}". ` +
      `Đáp án học sinh đã chọn: "${ctxSelected || 'Chưa chọn'}". ` +
      `Lời giải thích gốc: "${ctxExplanation}". ` +
      `QUY TẮC BẮT BUỘC: Tuyệt đối giữ nguyên tiếng Anh cho Đề bài và Đáp án. ` +
      `Toàn bộ phần giải thích lý do đúng/sai và lời khuyên học tập phải viết bằng Tiếng Việt 100%, ` +
      `hành văn chuyên nghiệp, sư phạm, không dịch máy ngô nghê. ` +
      `Chỉ trả lời trong phạm vi câu hỏi SAT này; từ chối lịch sự nếu được hỏi ngoài lề.`;

    // 4) Lịch sử hội thoại: cắt số lượng + độ dài, ép vai trò hợp lệ.
    const historyMessages = history.map((m) => ({
      role: m.role === 'ai' ? ('assistant' as const) : ('user' as const),
      content: clamp(m.text, MAX_MSG_LEN),
    }));

    const requestBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    };

    // Gọi OpenAI. Mọi đường LỖI (HTTP !ok, network throw, parse throw) → RELEASE
    // slot đã reserve: lỗi hạ tầng KHÔNG được tính vào quota người dùng.
    let data;
    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenAI API Error:", errorData);
        await releaseUsage(user.id, 'chat', reservation.reserved, reservation.date);
        return NextResponse.json({ error: "Lỗi gọi OpenAI API" }, { status: response.status });
      }

      data = await response.json();
    } catch (e) {
      await releaseUsage(user.id, 'chat', reservation.reserved, reservation.date);
      throw e;
    }

    const reply: string = data.choices?.[0]?.message?.content ?? '';

    // 5) Chốt usage: count đã reserve ở bước 2b, giờ chỉ cộng token (reserved:true).
    // Pre-migration (reserved:false) → finalizeUsage gọi recordUsage cũ (tăng count
    // + token) → giữ hành vi cũ 0 regression.
    const tokIn = data.usage?.prompt_tokens ?? 0;
    const tokOut = data.usage?.completion_tokens ?? 0;
    await finalizeUsage(user.id, 'chat', tokIn, tokOut, reservation.reserved, reservation.date);
    // Cộng chi phí vào sổ cái toàn hệ thống (kill-switch ngày — §9.5). AWAIT
    // (audit 2026-07-03, ROOT D): fire-and-forget trên serverless có thể bị
    // kill trước khi ghi → thất thoát trần ngân sách. .catch giữ để lỗi ghi
    // KHÔNG làm hỏng reply.
    await recordGlobalCost(tokIn, tokOut, model).catch((e) => console.error('recordGlobalCost:', e));

    // 6) Lưu vào cache chia sẻ để HS sau hỏi giống thì khỏi gọi OpenAI (§5.3).
    if (cacheable && reply) {
      saveCachedReply(cacheHash, userMessage, reply).catch((e) => console.error('saveCachedReply:', e));
    }

    const after = await checkQuota(user.id, tier, 'chat');
    return NextResponse.json({
      reply,
      quota: { used: after.used, limit: after.limit, remaining: after.remaining },
    });
  } catch (error) {
    console.error("Lỗi xử lý chat:", error);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
