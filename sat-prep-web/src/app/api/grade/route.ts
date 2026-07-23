import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy, tryBumpAnswerStreakAtomic } from '@/lib/economy-store';
import { applyAnswerReward, type Difficulty } from '@/lib/economy';
import { recordAnswer } from '@/lib/mastery';
import { isValidSkill } from '@/lib/skill-taxonomy';
import { recordDailySnapshot } from '@/lib/daily-snapshot-store';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';

/**
 * GRADE API (ROOT A — server-authoritative grading + reward)
 *
 * Đây là NGUỒN SỰ THẬT DUY NHẤT cho phần thưởng 1 câu luyện tập. Trước đây
 * `/api/grade` chỉ chấm để tô màu UI, còn coins/XP/mastery lại do client tự khai
 * qua `/api/economy {action:'answer'}` + `/api/mastery` (tin `isCorrect` client)
 * → script POST isCorrect:true không cần trả lời vẫn đúc xu (faucet). Nay:
 *   1. gradeAnswer CAS answered:false→true → chấm đúng/sai TỪ đáp án lưu server,
 *      trao quyền cộng thưởng ĐÚNG 1 LẦN cho request lật được cờ.
 *   2. Route cộng coins/XP (applyAnswerReward) + ghi mastery NGAY TẠI ĐÂY, dựa
 *      trên kết quả chấm của server — client KHÔNG còn gửi số tiền hay isCorrect.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`grade:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const { questionId, answer } = await req.json();

    if (typeof questionId !== 'string' || !questionId) {
      return NextResponse.json({ error: 'questionId bắt buộc' }, { status: 400 });
    }
    // Cho phép answer = "" (chuỗi rỗng): dùng khi HẾT GIỜ tự nộp mà chưa chọn đáp
    // án. Rỗng LUÔN chấm sai (0 thưởng) nhưng vẫn CAS answered:false→true + lộ đáp
    // án đúng — KHÔNG có lỗ farm (rỗng không bao giờ khớp correct_choice).
    if (typeof answer !== 'string') {
      return NextResponse.json({ error: 'answer bắt buộc' }, { status: 400 });
    }

    const result = await gradeAnswer(questionId, user.id, answer);

    if (!result) {
      return NextResponse.json({ error: 'Câu hỏi không hợp lệ hoặc đã trả lời' }, { status: 404 });
    }

    // ── Phần thưởng server-authoritative (chỉ chạy khi gradeAnswer CAS thành công,
    //    tức đúng 1 lần cho mỗi câu). streak do client giữ (dùng tính combo) — KHÔNG
    //    phải vector tiền: combo tối đa ×1.5, và chỉ nhân lên khi câu THẬT SỰ đúng. ──
    const difficulty: Difficulty = VALID_DIFFICULTY.includes(result.difficulty as Difficulty)
      ? (result.difficulty as Difficulty)
      : 'Medium';
    // 🔴 ROOT A: câu DIAGNOSTIC (test xếp lớp) KHÔNG trao xu/XP. Bài diagnostic
    // có thể phát lại (re-issue) khi user chưa 'complete' → nếu thưởng thì gọi
    // lại 'start' rồi grade = faucet xu vô hạn trên bộ câu cố định. Diagnostic chỉ
    // GIEO mastery (mục đích xếp lớp), không phải bề mặt kiếm xu. Câu luyện thường
    // (src ai/bank/null) vẫn thưởng như cũ.
    const isDiagnostic = result.src === 'diagnostic';

    // 🔴 COMBO SERVER-AUTHORITATIVE: streak chuỗi câu ĐÚNG liên tiếp do SERVER giữ
    // (bảng user_answer_streak, RPC atomic) — KHÔNG tin streak client (POST streak
    // lớn để nhân xu). Chỉ bump cho câu LUYỆN THƯỜNG (diagnostic không vào combo,
    // và không reward nên bump vô nghĩa). gradeAnswer đã CAS answered:false→true ở
    // trên nên mỗi câu chỉ bump 1 lần → combo không farm được. Pre-migration
    // (RPC chưa có) → null → streak=0 → combo tắt (đúng hành vi cũ, 0 regression).
    let streak = 0;
    if (!isDiagnostic) {
      const bumped = await tryBumpAnswerStreakAtomic(user.id, result.correct);
      if (typeof bumped === 'number') streak = bumped;
    }
    const [economy, tier] = await Promise.all([loadEconomy(user.id), getUserTier(user.id)]);
    const coinMult = TIER_COIN_MULTIPLIER[tier];
    const { state: nextEconomy, granted: plannedGrant } = isDiagnostic
      ? { state: economy, granted: { coins: 0, xp: 0 } }
      : applyAnswerReward(economy, result.correct, difficulty, streak, coinMult);
    let granted = plannedGrant;
    let responseEconomy = nextEconomy;
    let persistenceError: string | null = null;

    // Ghi mastery (server quyết từ result.correct, không tin client). Route học tập
    // cốt lõi KHÔNG được báo success nếu ghi mastery fail: nếu không lưu được thì UI
    // sẽ tưởng năng lực đã cập nhật trong khi dashboard/score prediction không đổi.
    if (result.skillId && isValidSkill(result.skillId)) {
      try {
        await recordAnswer(user.id, result.skillId, result.correct, difficulty);
        // Snapshot phụ trợ: không chặn response vì mastery đã là nguồn sự thật chính.
        void recordDailySnapshot(user.id);
      } catch (e) {
        console.error('Grade: recordAnswer failed', e);
        persistenceError = 'Không thể lưu mastery. Đáp án vẫn đã được chấm; vui lòng thử câu khác sau khi kết nối ổn định.';
        granted = { coins: 0, xp: 0 };
        responseEconomy = economy;
      }
    }

    if (!persistenceError && (granted.coins > 0 || granted.xp > 0)) {
      try {
        await saveEconomy(user.id, nextEconomy);
      } catch (e) {
        console.error('Grade: saveEconomy failed', e);
        persistenceError = 'Không thể lưu phần thưởng. Đáp án vẫn đã được chấm; xu/XP chưa được cộng.';
        granted = { coins: 0, xp: 0 };
        responseEconomy = economy;
      }
    }

    return NextResponse.json({
      correct: result.correct,
      correctChoice: result.correctChoice,
      skillId: result.skillId,
      difficulty: result.difficulty,
      choice_analysis: result.choiceAnalysis, // lộ SAU khi nộp (render block "vì sao đáp án kia sai")
      explanation: result.explanation, // lộ SAU khi nộp (câu có lời giải tĩnh, vd đề thư viện)
      granted,
      economy: responseEconomy,
      persistenceError,
    });
  } catch (error) {
    console.error('Grade error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
