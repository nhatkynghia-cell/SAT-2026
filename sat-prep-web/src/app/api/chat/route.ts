import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkQuota, recordUsage, type AiTier } from '@/lib/ai-quota';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';
import {
  chatCacheHash,
  getCachedReply,
  bumpHitCount,
  saveCachedReply,
} from '@/lib/chat-cache-store';

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
const MODEL = 'gpt-4o-mini';
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

    // TODO(task #2/Phase 2): lấy tier thật từ subscription. Tạm coi mọi user là 'free'.
    const tier: AiTier = 'free';

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
      });
      const cached = await getCachedReply(cacheHash);
      if (cached) {
        bumpHitCount(cacheHash, cached.hitCount).catch((e) => console.error('bumpHitCount:', e));
        const q = await checkQuota(user.id, tier);
        return NextResponse.json({
          reply: cached.reply,
          cached: true,
          quota: { used: q.used, limit: q.limit, remaining: q.remaining },
        });
      }
    }

    // 1) Enforce quota TRƯỚC khi tốn tiền gọi OpenAI (chỉ khi cache MISS).
    const quota = await checkQuota(user.id, tier);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã dùng hết ${quota.limit} lượt hỏi Gia sư AI hôm nay. Nâng cấp Premium để hỏi không giới hạn nhé!`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 }
      );
    }

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
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      return NextResponse.json({ error: "Lỗi gọi OpenAI API" }, { status: response.status });
    }

    const data = await response.json();
    const reply: string = data.choices?.[0]?.message?.content ?? '';

    // 5) Ghi nhận usage (tăng quota count + cộng dồn token cho task #5).
    const tokIn = data.usage?.prompt_tokens ?? 0;
    const tokOut = data.usage?.completion_tokens ?? 0;
    await recordUsage(user.id, tokIn, tokOut);
    // Cộng chi phí vào sổ cái toàn hệ thống (kill-switch ngày — §9.5).
    recordGlobalCost(tokIn, tokOut, MODEL).catch((e) => console.error('recordGlobalCost:', e));

    // 6) Lưu vào cache chia sẻ để HS sau hỏi giống thì khỏi gọi OpenAI (§5.3).
    if (cacheable && reply) {
      saveCachedReply(cacheHash, userMessage, reply).catch((e) => console.error('saveCachedReply:', e));
    }

    const after = await checkQuota(user.id, tier);
    return NextResponse.json({
      reply,
      quota: { used: after.used, limit: after.limit, remaining: after.remaining },
    });
  } catch (error) {
    console.error("Lỗi xử lý chat:", error);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
