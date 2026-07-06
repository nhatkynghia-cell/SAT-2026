import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateModule } from '@/lib/exam-generator';
import { issueQuestion } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';
import { getMasterySummary } from '@/lib/mastery';
import { loadGates } from '@/lib/gate-store';
import { buildSkillTree } from '@/lib/skill-tree';
import { getUserTier } from '@/lib/subscription-store';

/**
 * BẮT ĐẦU 1 SECTION THI ADAPTIVE (RW hoặc Math) — sinh Module 1 + phát đề.
 *
 * Kế thừa mô hình bảo mật ROOT A của /api/exams/start:
 *   • Sinh câu bằng AI (generateModule) → mỗi câu issueQuestion (lưu correct_choice
 *     + difficulty THẬT vào bảng issued_questions của user) → trả câu ĐÃ GIẤU đáp án
 *     kèm `questionId`. Client KHÔNG bao giờ thấy đáp án, KHÔNG tự chấm.
 *   • Lúc nộp: client gửi {questionId, answer}[] → /api/exam-session/submit chấm
 *     compare-and-swap + thưởng theo độ khó thật (mỗi câu tính điểm đúng 1 lần).
 *
 * PHÂN TẦNG (giống exams/start):
 *   • mode:'real' (Thi Thật QAS) = Premium+ VÀ tinh thông ≥6 kỹ năng (level≥7),
 *     enforce SERVER-SIDE tại đây.
 *   • mode:'mock' (mặc định) = miễn phí.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`exam-session-start:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await request.json();
    const section = body.section === 'math' ? 'math' : body.section === 'rw' ? 'rw' : null;
    const mode = body.mode === 'real' ? 'real' : 'mock';

    if (!section) {
      return NextResponse.json({ error: 'section phải là "rw" hoặc "math"' }, { status: 400 });
    }

    // Thi Thật (QAS): gate tier + năng lực server-side (đóng lỗ hổng gate-level client).
    if (mode === 'real') {
      const [tier, summary, gates] = await Promise.all([
        getUserTier(user.id),
        getMasterySummary(user.id),
        loadGates(user.id),
      ]);

      if (tier === 'free') {
        return NextResponse.json(
          { error: 'Thi Thật QAS là quyền lợi gói Premium. Nâng cấp để mở khóa.', reason: 'tier' },
          { status: 403 }
        );
      }

      const level = buildSkillTree(summary, gates).masteredCount + 1;
      if (level < 7) {
        return NextResponse.json(
          { error: 'Cần tinh thông 6 kỹ năng để mở khóa đề thi thật QAS.', reason: 'capability' },
          { status: 403 }
        );
      }
    }

    const origin = request.nextUrl.origin;
    const cookie = request.headers.get('cookie') ?? '';

    const generated = await generateModule(section, 1, origin, cookie);

    if (generated.questions.length === 0) {
      return NextResponse.json(
        { error: 'Không thể sinh câu hỏi. Vui lòng thử lại sau.' },
        { status: 503 }
      );
    }

    // Phát từng câu: lưu đáp án + độ khó server-side, trả câu đã giấu đáp án + questionId.
    const safeQuestions = await Promise.all(
      generated.questions.map(async (q) => {
        const questionId = await issueQuestion(user.id, q.correct_choice, q.skillId, q.difficulty, {
          src: 'exam',
        });
        const { correct_choice: _c, explanation: _e, difficulty: _d, ...safe } = q;
        return { ...safe, questionId };
      })
    );

    return NextResponse.json({
      section,
      mode,
      module: {
        name: generated.name,
        timeMinutes: generated.timeMinutes,
        moduleNum: generated.moduleNum,
        section: generated.section,
        questions: safeQuestions,
      },
    });
  } catch (error) {
    console.error('exam-session start error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
