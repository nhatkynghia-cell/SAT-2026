import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy } from '@/lib/economy-store';
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

    const { questionId, answer, streak: streakRaw } = await req.json();

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
    const streak = Number.isInteger(streakRaw) && streakRaw >= 0 ? streakRaw : 0;

    const [economy, tier] = await Promise.all([loadEconomy(user.id), getUserTier(user.id)]);
    const coinMult = TIER_COIN_MULTIPLIER[tier];
    const { state: nextEconomy, granted } = applyAnswerReward(economy, result.correct, difficulty, streak, coinMult);
    if (granted.coins > 0 || granted.xp > 0) {
      await saveEconomy(user.id, nextEconomy);
    }

    // Ghi mastery (server quyết từ result.correct, không tin client). Chỉ khi câu
    // có skillId hợp lệ. Không chặn response nếu ghi lỗi.
    if (result.skillId && isValidSkill(result.skillId)) {
      try {
        await recordAnswer(user.id, result.skillId, result.correct, difficulty);
        // Ghi ảnh chụp tiến độ hôm nay (time-series cho báo cáo tuần phụ huynh).
        // Fire-and-forget: KHÔNG await/chặn response, KHÔNG throw (store tự nuốt lỗi).
        void recordDailySnapshot(user.id);
      } catch (e) {
        console.error('Grade: recordAnswer failed', e);
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
      economy: nextEconomy,
    });
  } catch (error) {
    console.error('Grade error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
