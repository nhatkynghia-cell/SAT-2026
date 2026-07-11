import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer, getGradedResult, issueQuestion } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy } from '@/lib/economy-store';
import { applyExamRewardFromDifficulties, MAX_EXAM_QUESTIONS, type Difficulty } from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';
import { generateModule } from '@/lib/exam-generator';
import { determineAdaptivePath } from '@/lib/exam-scoring';
import { isE2E, e2eModule, e2eGrade, E2E_ECONOMY } from '@/lib/e2e';

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

    // E2E: chấm tất định (đáp án "A" = đúng), bỏ DB/OpenAI. Module 1 → trả Module 2
    // tất định; Module 2 → kết thúc section. Đủ để drive luồng UI tới bảng điểm.
    if (isE2E()) {
      const correctE2E = e2eGrade(rawAnswers);
      if (moduleNum === 1) {
        return NextResponse.json({
          moduleResult: { correct: correctE2E, total: rawAnswers.length },
          adaptivePath: 'hard',
          granted: { coins: 0, xp: 0 },
          economy: E2E_ECONOMY,
          module: e2eModule(section, 2),
        });
      }
      return NextResponse.json({
        moduleResult: { correct: correctE2E, total: rawAnswers.length },
        granted: { coins: 0, xp: 0 },
        economy: E2E_ECONOMY,
      });
    }

    const answers: SubmittedAnswer[] = rawAnswers
      .filter(
        (a: unknown): a is SubmittedAnswer =>
          !!a &&
          typeof (a as SubmittedAnswer).questionId === 'string' &&
          typeof (a as SubmittedAnswer).answer === 'string'
      )
      .slice(0, MAX_EXAM_QUESTIONS);

    // Chấm từng câu server-side. TÁCH scoring khỏi reward để NỘP LẠI idempotent:
    //   • correct (điểm + adaptive path): đếm CẢ câu chấm-mới LẪN câu ĐÃ chấm trước
    //     (đọc was_correct đã lưu) → retry sau khi response mất vẫn ra ĐÚNG số câu
    //     đúng, KHÔNG mất điểm + KHÔNG hạ nhầm nhánh adaptive về easy.
    //   • correctDifficulties (thưởng xu): CHỈ câu chấm-mới (CAS thắng) → retry ra
    //     0 câu mới → 0 xu → KHÔNG double-grant. Giữ ROOT A/ROOT C.
    const correctDifficulties: Difficulty[] = [];
    let correct = 0;
    // Mẫu số cho adaptive ratio: SỐ CÂU M1 server THỰC SỰ chấm (owned + verified),
    // KHÔNG phải answers.length client gửi. gradeAnswer non-null (chấm mới) HOẶC
    // getGradedResult non-null (đã chấm, retry) đều là câu sở hữu hợp lệ → đếm.
    // Câu ID lạ/không sở hữu → cả 2 null → KHÔNG đếm (client không thổi được mẫu số).
    let gradedTotal = 0;

    for (const { questionId, answer } of answers) {
      const result = await gradeAnswer(questionId, user.id, answer);
      if (result) {
        // Chấm MỚI (CAS thắng) → tính điểm + đủ điều kiện thưởng.
        gradedTotal++;
        if (result.correct) {
          correct++;
          const d: Difficulty = VALID_DIFFICULTY.includes(result.difficulty as Difficulty)
            ? (result.difficulty as Difficulty)
            : 'Medium';
          correctDifficulties.push(d);
        }
        continue;
      }
      // gradeAnswer null: câu ĐÃ chấm trước (retry) / lạ / không sở hữu. Nếu là câu
      // ĐÃ chấm của user này → lấy điểm ĐÃ LƯU để đếm (idempotent), KHÔNG thưởng lại.
      const prior = await getGradedResult(questionId, user.id);
      if (prior) {
        gradedTotal++;
        if (prior.correct) correct++;
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
      const adaptivePath = determineAdaptivePath(correct, gradedTotal, section);
      const origin = request.nextUrl.origin;
      const cookie = request.headers.get('cookie') ?? '';

      const generated = await generateModule(section, 2, origin, cookie, adaptivePath);
      if (generated.questions.length === 0) {
        // Module 1 ĐÃ chấm xong (CAS) + thưởng đã cộng server-side; chỉ Module 2
        // sinh hụt (thường do OpenAI chặn VN). KHÔNG trả 503 — vì client throw thì
        // MẤT điểm Module 1 vừa chấm (điểm section về sàn). Trả kết quả M1 kèm
        // module:null để client GHI điểm rồi kết thúc section êm. Endpoint không
        // idempotent (CAS) nên client KHÔNG được retry — đây là đường thoát an toàn.
        return NextResponse.json({
          moduleResult: { correct, total: gradedTotal },
          adaptivePath,
          granted,
          economy: nextEconomy,
          module: null,
          moduleGenerationFailed: true,
        });
      }

      const safeQuestions = await Promise.all(
        generated.questions.map(async (q) => {
          const questionId = await issueQuestion(user.id, q.correct_choice, q.skillId, q.difficulty, { src: 'exam' });
          const { correct_choice: _c, explanation: _e, difficulty: _d, ...safe } = q;
          return { ...safe, questionId };
        })
      );

      return NextResponse.json({
        moduleResult: { correct, total: gradedTotal },
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
      moduleResult: { correct, total: gradedTotal },
      granted,
      economy: nextEconomy,
    });
  } catch (error) {
    console.error('exam-session submit error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
