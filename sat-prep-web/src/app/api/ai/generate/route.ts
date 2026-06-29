import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkQuota, recordUsage, type AiTier } from '@/lib/ai-quota';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';

/**
 * ============================================================================
 *  AI PROXY & QUOTA API — implementation_plan.md §9.2 + §9.5 (task 5.5)
 * ============================================================================
 *  ⚠️ TRƯỚC (lỗ hổng "proxy mù"): route nhận `systemPrompt` THÔ từ client →
 *  prompt injection; đếm quota bằng bảng RIÊNG `user_quotas` (split-brain với
 *  `user_ai_usage` của /api/chat); KHÔNG kill-switch ngân sách, KHÔNG ghi cost.
 *
 *  NAY (server-authoritative — đồng bộ với /api/chat):
 *    • System prompt DỰNG Ở SERVER; client chỉ gửi `userPrompt` (clamp độ dài).
 *    • Model & max_tokens CỐ ĐỊNH ở server (client không override được).
 *    • Quota dùng CHUNG engine `ai-quota.ts` (bảng `user_ai_usage`, free=5/ngày)
 *      → HẾT split-brain với /api/chat; cùng một sổ đếm theo user_id+ngày.
 *    • Kill-switch ngân sách (§9.5) + ghi `recordGlobalCost` (đo token/cost).
 *
 *  Lưu ý: bảng cũ `user_quotas` giờ KHÔNG còn được dùng (dead) — KHÔNG drop ở
 *  đây (DB PRODUCTION; để user dọn nếu muốn).
 *
 *  Route này KHÔNG nằm trong luồng chính (chỉ `test-ai/page.tsx` gọi). Vẫn
 *  hardening vì nó LIVE và bất kỳ user đăng nhập nào cũng gọi được.
 * ============================================================================
 */

const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;
const MAX_PROMPT_LEN = 2000;

// System prompt CỐ ĐỊNH ở server — client KHÔNG được phép gửi/đè.
const SYSTEM_PROMPT =
  'Bạn là một gia sư luyện thi SAT xuất sắc. Giải thích khái niệm rõ ràng, ' +
  'súc tích, sư phạm. Giữ nguyên tiếng Anh cho thuật ngữ/đề bài SAT; phần giải ' +
  'thích viết bằng Tiếng Việt 100%. Chỉ trả lời trong phạm vi luyện thi SAT.';

function clamp(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : '';
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    // Chỉ cho user đã đăng nhập (đảm bảo user.id là uuid thật cho user_ai_usage).
    if (!user.isAuthenticated) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để sử dụng tính năng này.' }, { status: 401 });
    }

    // TODO(Phase 2): lấy tier thật từ subscription. Tạm coi mọi user là 'free'.
    const tier: AiTier = 'free';

    // 1) Enforce quota TRƯỚC khi tốn tiền (dùng chung engine với /api/chat).
    const quota = await checkQuota(user.id, tier);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: 'Bạn đã dùng hết lượt tạo câu hỏi miễn phí hôm nay. Vui lòng nâng cấp Premium để học không giới hạn!',
          code: 'QUOTA_EXCEEDED',
          used: quota.used,
          limit: quota.limit,
        },
        { status: 403 }
      );
    }

    // 2) Parse input — chỉ nhận userPrompt từ client (clamp). systemPrompt bỏ qua.
    const body = await req.json();
    const userPrompt = clamp(body.userPrompt, MAX_PROMPT_LEN);
    if (!userPrompt.trim()) {
      return NextResponse.json({ error: 'Thiếu nội dung câu hỏi (userPrompt).' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Thiếu OPENAI_API_KEY trong biến môi trường');
      return NextResponse.json({ error: 'Hệ thống AI đang bảo trì (Thiếu API Key).' }, { status: 500 });
    }

    // 3) Kill-switch ngân sách toàn hệ thống (§9.5).
    if (!checkBudget().allowed) {
      return NextResponse.json(
        { error: 'Hệ thống AI tạm đạt giới hạn vận hành trong ngày. Vui lòng thử lại sau.', budgetExceeded: true },
        { status: 503 }
      );
    }

    // 4) Gọi OpenAI (model + max_tokens cố định ở server).
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: body.expectJson ? { type: 'json_object' } : undefined,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Lỗi từ OpenAI:', errText);
      return NextResponse.json({ error: 'Lỗi khi gọi AI Provider.' }, { status: 502 });
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content ?? '';

    // 5) Ghi nhận usage (tăng quota count + cộng dồn token) + chi phí toàn hệ thống.
    const tokIn = aiData.usage?.prompt_tokens ?? 0;
    const tokOut = aiData.usage?.completion_tokens ?? 0;
    await recordUsage(user.id, tokIn, tokOut);
    recordGlobalCost(tokIn, tokOut, MODEL).catch((e) => console.error('recordGlobalCost:', e));

    // 6) Trả kết quả (giữ contract cũ cho test-ai/page.tsx: data + usage{used,limit}).
    const after = await checkQuota(user.id, tier);
    return NextResponse.json({
      success: true,
      data: generatedText,
      usage: { used: after.used, limit: after.limit },
    });
  } catch (error) {
    console.error('Lỗi API Proxy AI:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ.' }, { status: 500 });
  }
}
