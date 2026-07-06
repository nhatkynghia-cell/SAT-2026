import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer, issueQuestion } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy } from '@/lib/economy-store';
import { applyExamRewardFromDifficulties, MAX_EXAM_QUESTIONS, type Difficulty } from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';
import { generateModule } from '@/lib/exam-generator';
import { determineAdaptivePath } from '@/lib/exam-scoring';

/**
 * NỘP 1 MODULE THI ADAPTIVE — server chấm + thưởng, và (nếu Module 1) sinh Module 2.
 *
 * Kế thừa mô hình ROOT A của /api/exams/grade:
 *   • Client gửi {questionId, answer}[] (KHÔNG gửi correctCount/số xu/độ khó).
 *   • Server gradeAnswer từng câu (compare-and-swap answered:false→true) → chấm
 *     TỪ đáp án đã lưu lúc /start, mỗi câu tính điểm ĐÚNG 1 LẦN. Thưởng = tổng
 *     đơn giá theo ĐỘ KHÓ THẬT của các câu đúng, nhân hệ số gói.
 *
 * ADAPTIVE:
 *   • moduleNum:1 → sau khi chấm, dùng SỐ CÂU ĐÚNG (server) quyết adaptivePath
 *     (hard/easy) rồi sinh Module 2 tương ứng, phát đề (issueQuestion) + trả về.
 *   • moduleNum:2 → chỉ chấm; section này kết thúc.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`exam-session-submit:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await request.json();
    const section = body.section === 'math' ? 'math' : body.section === 'rw' ? 'rw' : null;
    const moduleNum = body.moduleNum === 2 ? 2 : body.moduleNum === 1 ? 1 : null;
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];

    if (!section || !moduleNum) {
      return NextResponse.json({ error: 'section/moduleNum không hợp lệ' }, { status: 400 });
    }

    const answers: SubmittedAnswer[] = rawAnswers
      .filter(
        (a: unknown): a is SubmittedAnswer =>
          !!a &&
          typeof (a as SubmittedAnswer).questionId === 'string' &&
          typeof (a as SubmittedAnswer).answer === 'string'
      )
      .slice(0, MAX_EXAM_QUESTIONS);

    // Chấm từng câu server-side (CAS). correct/độ khó lấy TỪ SERVER, không tin client.
    const correctDifficulties: Difficulty[] = [];
    let correct = 0;

    for (const { questionId, answer } of answers) {
      const result = await gradeAnswer(questionId, user.id, answer);
      if (!result) continue; // câu lạ / không sở hữu / đã trả lời → bỏ qua
      if (result.correct) {
        correct++;
        const d: Difficulty = VALID_DIFFICULTY.includes(result.difficulty as Difficulty)
          ? (result.difficulty as Difficulty)
          : 'Medium';
        correctDifficulties.push(d);
      }
    }

    // Thưởng cho module này (từ độ khó các câu ĐÚNG server chấm). Hệ số gói nhân xu.
    const [economy, tier] = await Promise.all([loadEconomy(user.id), getUserTier(user.id)]);
    const { state: nextEconomy, granted } = applyExamRewardFromDifficulties(
      economy,
      correctDifficulties,
      TIER_COIN_MULTIPLIER[tier]
    );
    if (granted.coins > 0 || granted.xp > 0) {
      await saveEconomy(user.id, nextEconomy);
    }

    // Module 1 → quyết adaptive path + sinh Module 2.
    if (moduleNum === 1) {
      const adaptivePath = determineAdaptivePath(correct, section);
      const origin = request.nextUrl.origin;
      const cookie = request.headers.get('cookie') ?? '';

      const generated = await generateModule(section, 2, origin, cookie, adaptivePath);
      if (generated.questions.length === 0) {
        return NextResponse.json(
          { error: 'Không thể sinh Module 2. Vui lòng thử lại.' },
          { status: 503 }
        );
      }

      const safeQuestions = await Promise.all(
        generated.questions.map(async (q) => {
          const questionId = await issueQuestion(user.id, q.correct_choice, q.skillId, q.difficulty, { src: 'exam' });
          const { correct_choice: _c, explanation: _e, difficulty: _d, ...safe } = q;
          return { ...safe, questionId };
        })
      );

      return NextResponse.json({
        moduleResult: { correct, total: answers.length },
        adaptivePath,
        granted,
        economy: nextEconomy,
        module: {
          name: generated.name,
          timeMinutes: generated.timeMinutes,
          moduleNum: generated.moduleNum,
          section: generated.section,
          questions: safeQuestions,
        },
      });
    }

    // Module 2 → section kết thúc.
    return NextResponse.json({
      moduleResult: { correct, total: answers.length },
      granted,
      economy: nextEconomy,
    });
  } catch (error) {
    console.error('exam-session submit error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
