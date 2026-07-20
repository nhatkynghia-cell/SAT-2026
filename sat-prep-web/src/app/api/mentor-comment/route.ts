import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { isValidCodeFormat } from '@/lib/parent-share';
import { resolveShareCode } from '@/lib/parent-share-store';
import { buildParentReport, type ParentReport } from '@/lib/parent-report-store';
import { getUserTierAdmin } from '@/lib/subscription-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';
import { todayVN } from '@/lib/daily-snapshot-store';

/**
 * ============================================================================
 *  MENTOR AI (Cụm A3) — nhận xét AI cho báo cáo phụ huynh, CHỈ gói ULTIMATE
 * ============================================================================
 *  Phụ huynh KHÔNG có session (Hướng A "mã chia sẻ") → TÁI DÙNG y hệt cơ chế
 *  auth/rate-limit của /api/parent/report:
 *    • ?code=PH-... → isValidCodeFormat → rate-limit theo mã + theo IP proxy
 *      chống brute-force → resolveShareCode → studentId.
 *
 *  Gate: getUserTierAdmin(studentId) !== 'ultimate' → { comment:null, locked:true }.
 *
 *  ⚠️ KHÔNG có quota per-user (phụ huynh vô danh) → PHẢI CACHE để chặn đốt token:
 *    • Key = sha256('mentor-comment:' + studentId + ngày-VN + hash-tóm-tắt-report).
 *      Prefix tách namespace khỏi cache chat. Ngày trong khóa ⇒ mỗi ngày regenerate
 *      tối đa 1 lần/học sinh (report ổn định trong ngày → 1 lần gọi OpenAI).
 *    • Cache DÙNG CHUNG bảng `ai_chat_cache` qua ADMIN client (service-role) — vì
 *      chat-cache-store dùng createClient() RLS cần session, phụ huynh không có.
 *    • Cache HIT → KHÔNG gọi OpenAI, KHÔNG tính chi phí.
 *
 *  💸 Chi phí ghi cost-ledger như /api/chat (kill-switch ngân sách ngày chung).
 *
 *  🛡️ FAIL-SAFE (OpenAI chặn địa lý VN 403 / lỗi / hết ngân sách): trả
 *     { comment:null } (HTTP 200, KHÔNG throw) → UI ẩn khối im lặng, phần số liệu
 *     của báo cáo GIỮ NGUYÊN. Nhận xét chỉ là lớp phủ, không được làm vỡ báo cáo.
 * ============================================================================
 */

// Cấu hình cứng ở server (giống /api/chat) — comment ngắn nên MAX_TOKENS thấp hơn.
const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7;

/** Tóm tắt số liệu report thành chuỗi ngắn (dùng cho cả prompt lẫn hash cache). */
function summarizeReport(report: ParentReport): string {
  const p = report.prediction;
  const t = report.weeklyTrend;
  const focus = p.focusSkills.slice(0, 4).map((s) => `${s.label} (${s.score}/100)`).join(', ') || 'chưa xác định';
  const imp = report.improvement
    ? `Cải thiện ${report.improvement.windowDays} ngày: mastery ${report.improvement.deltaOverall >= 0 ? '+' : ''}${report.improvement.deltaOverall}, điểm dự đoán ${report.improvement.deltaPredicted >= 0 ? '+' : ''}${report.improvement.deltaPredicted}.`
    : 'Chưa đủ dữ liệu để đo tốc độ cải thiện.';
  const bySubject = Object.entries(report.mastery.bySubject)
    .map(([subject, value]) => `${subject} ${value}`)
    .join(', ') || 'chưa có dữ liệu';
  return [
    `Cambridge Scale dự đoán: ${p.scale} (${p.cefr}), độ tin cậy ${p.confidence}.`,
    p.targetLevel !== null ? `Mục tiêu ${p.targetLevel} (${p.targetScale}), còn ${p.scaleToTarget} scale point.` : 'Chưa đặt mục tiêu.',
    `Mastery tổng: ${report.mastery.overall}/100 (${bySubject}).`,
    `Tổng câu đã luyện: ${p.totalAttempts}. Chuỗi ngày học: ${report.streak}.`,
    `Xu hướng ${report.trendWindowDays} ngày: scale thay đổi ${t.scoreDelta >= 0 ? '+' : ''}${t.scoreDelta}, ${t.activeDays} ngày có học, ${t.attemptsThisWeek} câu làm trong kỳ.`,
    imp,
    `Kỹ năng cần tập trung: ${focus}.`,
    `Số bài thi gần đây: ${report.recentTests.length}.`,
  ].join(' ');
}

/** Đọc nhận xét đã cache (admin, bypass RLS). null nếu miss/lỗi. */
async function getCachedComment(
  admin: ReturnType<typeof createAdminClient>,
  hash: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('ai_chat_cache')
    .select('ai_response')
    .eq('cache_hash', hash)
    .maybeSingle();
  if (error || !data) return null;
  return data.ai_response ?? null;
}

/** Lưu nhận xét vào cache (upsert theo cache_hash, admin). Best-effort. */
async function saveCachedComment(
  admin: ReturnType<typeof createAdminClient>,
  hash: string,
  comment: string,
  summary: string
): Promise<void> {
  const { error } = await admin
    .from('ai_chat_cache')
    .upsert(
      {
        cache_hash: hash,
        question_id: null,
        user_query: summary.slice(0, 1000),
        ai_response: comment,
        hit_count: 1,
      },
      { onConflict: 'cache_hash' }
    );
  if (error) console.error('mentor-comment saveCache lỗi:', error.message);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';

  if (!isValidCodeFormat(code)) {
    return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 404 });
  }

  // Rate-limit theo mã (chống dò 1 mã) — 30 lần/phút, khớp /api/parent/report.
  const rl = rateLimit(`mentor-comment:${code}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // Rate-limit theo IP proxy (chống dò NHIỀU mã từ 1 nguồn) — 60 lần/phút/IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rlIp = rateLimit(`mentor-comment-ip:${ip}`, 60, 60_000);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rlIp.retryAfterMs }, { status: 429 });
  }

  const studentId = await resolveShareCode(code);
  if (!studentId) {
    return NextResponse.json({ error: 'Mã không tồn tại hoặc đã hết hạn' }, { status: 404 });
  }

  try {
    // GATE: chỉ gói Ultimate của CON mới có Mentor AI.
    const tier = await getUserTierAdmin(studentId);
    if (tier !== 'ultimate') {
      return NextResponse.json({ comment: null, locked: true });
    }

    const report = await buildParentReport(studentId);
    const summary = summarizeReport(report);

    // Khóa cache: studentId + ngày VN + hash tóm tắt report (prefix tách namespace).
    const hash = crypto
      .createHash('sha256')
      .update(`mentor-comment:${studentId}:${todayVN()}:${summary}`)
      .digest('hex');

    const admin = createAdminClient();

    // CACHE LOOKUP — hit thì trả luôn, KHÔNG gọi OpenAI, KHÔNG tính chi phí.
    const cached = await getCachedComment(admin, hash);
    if (cached) {
      return NextResponse.json({ comment: cached, cached: true });
    }

    // Kill-switch ngân sách ngày chung → fail-safe ẩn khối (không vỡ báo cáo).
    const budget = await checkBudget();
    if (!budget.allowed) {
      return NextResponse.json({ comment: null });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ comment: null });
    }

    const systemPrompt =
      `Bạn là một mentor luyện thi SAT giàu kinh nghiệm, đang viết nhận xét cho PHỤ HUYNH ` +
      `về tiến độ học của con trong 90 ngày qua. Giọng văn ấm áp, chuyên nghiệp, động viên, ` +
      `dễ hiểu cho phụ huynh không rành SAT. TUYỆT ĐỐI KHÔNG phán xét y khoa/tâm lý (không nói ` +
      `về bệnh, rối loạn, năng khiếu bẩm sinh). Chỉ bàn về việc học SAT. Viết 100% bằng Tiếng Việt.\n\n` +
      `Cấu trúc bắt buộc:\n` +
      `1) Một đoạn ngắn (2-3 câu) tóm tắt con đang ở đâu và xu hướng tiến bộ.\n` +
      `2) 2-3 khuyến nghị CỤ THỂ, khả thi để phụ huynh đồng hành cùng con (dựa trên kỹ năng còn yếu ` +
      `và mức độ chuyên cần). Mỗi khuyến nghị 1 dòng, bắt đầu bằng dấu "•".\n` +
      `Tổng độ dài dưới 180 từ. Không dùng tiêu đề markdown.`;

    const userPrompt = `Số liệu tiến độ của con:\n${summary}`;

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    });

    // FAIL-SAFE: OpenAI lỗi (kể cả 403 chặn địa lý VN) → ẩn khối, giữ báo cáo.
    if (!response.ok) {
      console.error('mentor-comment OpenAI lỗi:', response.status, await response.text().catch(() => ''));
      return NextResponse.json({ comment: null });
    }

    const data = await response.json();
    const comment: string = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!comment) {
      return NextResponse.json({ comment: null });
    }

    // Ghi chi phí vào sổ cái chung (AWAIT — serverless có thể bị kill sớm).
    const tokIn = data.usage?.prompt_tokens ?? 0;
    const tokOut = data.usage?.completion_tokens ?? 0;
    await recordGlobalCost(tokIn, tokOut, MODEL).catch((e) => console.error('recordGlobalCost:', e));

    // Lưu cache (best-effort) cho lần xem sau trong ngày.
    await saveCachedComment(admin, hash, comment, summary).catch((e) => console.error('saveCache:', e));

    return NextResponse.json({ comment });
  } catch (e) {
    // Mọi lỗi khác cũng fail-safe ẩn khối (báo cáo số liệu không phụ thuộc mục này).
    console.error('mentor-comment error:', e);
    return NextResponse.json({ comment: null });
  }
}
