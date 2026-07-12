import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy, ensureEconomyRow, tryIncrementEconomyAtomic } from '@/lib/economy-store';
import { applyExamRewardFromDifficulties, MAX_EXAM_QUESTIONS, type Difficulty, type EconomyState } from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';

/**
 * NỘP BÀI THI (ROOT A follow-up đường thi) — server chấm + thưởng.
 *
 * Client gửi mảng {questionId, answer}[] (KHÔNG gửi correctCount/số xu). Với mỗi
 * câu, server gradeAnswer (compare-and-swap answered:false→true) → chấm đúng/sai
 * TỪ đáp án đã lưu lúc /api/exams/start, và mỗi câu chỉ tính điểm ĐÚNG 1 LẦN
 * (replay/nộp lại → câu đã answered → bỏ qua, không cộng thêm). Phần thưởng =
 * tổng đơn giá theo ĐỘ KHÓ THẬT của từng câu ĐÚNG (từ đề, lưu server).
 *
 * → Đóng faucet cũ: client không còn tự khai số câu đúng hay độ khó.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`exam-grade:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await req.json();
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];

    // Lọc + kẹp về trần (chống mảng phi lý). total = số câu client khai đã trả lời.
    const answers: SubmittedAnswer[] = rawAnswers
      .filter(
        (a: unknown): a is SubmittedAnswer =>
          !!a &&
          typeof (a as SubmittedAnswer).questionId === 'string' &&
          typeof (a as SubmittedAnswer).answer === 'string'
      )
      .slice(0, MAX_EXAM_QUESTIONS);

    // Chấm từng câu server-side (CAS). Kết quả correct/độ khó lấy TỪ SERVER, không
    // tin client. Câu đã answered (nộp lại) → gradeAnswer trả null → không tính.
    const correctDifficulties: Difficulty[] = [];
    let correct = 0;
    let graded = 0;

    // Tuần tự để tránh dồn nhiều update đồng thời lên cùng user (đề ~vài chục câu).
    for (const { questionId, answer } of answers) {
      const result = await gradeAnswer(questionId, user.id, answer);
      if (!result) continue; // câu lạ / không sở hữu / đã trả lời → bỏ qua
      graded++;
      if (result.correct) {
        correct++;
        const d: Difficulty = VALID_DIFFICULTY.includes(result.difficulty as Difficulty)
          ? (result.difficulty as Difficulty)
          : 'Medium';
        correctDifficulties.push(d);
      }
    }

    // Thưởng 1 lần cho cả bài (từ độ khó các câu ĐÚNG server chấm). Hệ số gói nhân xu.
    const [economy, tier] = await Promise.all([loadEconomy(user.id), getUserTier(user.id)]);
    const { state: nextEconomy, granted } = applyExamRewardFromDifficulties(economy, correctDifficulties, TIER_COIN_MULTIPLIER[tier]);

    // Cộng thưởng ATOMIC (đóng lost-update ROOT C: 2 nộp ĐỒNG THỜI cùng đọc coins
    // cũ → saveEconomy last-write-wins → under-grant). increment_economy khóa dòng +
    // cộng delta. FALLBACK về saveEconomy khi atomic null (pre-migration) HOẶC
    // ok=false: CAS (gradeAnswer) đã chạy TRƯỚC → delta tiêu once, fail-closed sẽ
    // MẤT xu khi retry (correctDifficulties rỗng) → giữ grant qua saveEconomy. Xấu
    // nhất under-grant (đúng bug đang sửa), KHÔNG faucet (CAS chặn double-grant).
    let economyOut: EconomyState = nextEconomy;
    if (granted.coins > 0 || granted.xp > 0) {
      await ensureEconomyRow(user.id);
      const atomic = await tryIncrementEconomyAtomic(user.id, granted.coins, granted.xp);
      if (atomic?.ok) {
        economyOut = { ...economy, coins: atomic.coins, xp: atomic.xp };
      } else {
        await saveEconomy(user.id, nextEconomy);
        economyOut = nextEconomy;
      }
    }

    return NextResponse.json({
      correct,
      graded,
      granted,
      economy: economyOut,
    });
  } catch (error) {
    console.error('Exam grade error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
