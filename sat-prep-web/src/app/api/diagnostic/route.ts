import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getDiagnosticQuestions, stripQuestion } from '@/lib/diagnostic';
import { issueQuestion } from '@/lib/issued-questions';
import { loadOnboarding, saveOnboardingComplete } from '@/lib/onboarding-store';
import { setGoal, predictScore } from '@/lib/score-prediction';
import { getUserTier } from '@/lib/subscription-store';

/**
 * DIAGNOSTIC ONBOARDING — bài test xếp lớp đầu vào (§10.A.2/§10.A.5).
 *
 * GET                → trạng thái onboarding (KHÔNG ghi gì).
 * POST {action:'start'}    → issueQuestion từng câu (lưu correct_choice +
 *                            choice_analysis server-side) → trả câu ĐÃ GIẤU đáp
 *                            án + questionId. Client render qua CorePracticeUI →
 *                            submit tự chấm + ghi mastery qua /api/grade (mỗi câu
 *                            có skillId cụ thể). KHÔNG re-issue nếu đã hoàn tất.
 * POST {action:'complete'} → đặt điểm mục tiêu (nếu có) + đánh dấu hoàn tất +
 *                            trả điểm dự đoán vừa gieo.
 *
 * Server-authoritative (§9.1): client KHÔNG tự khai điểm — mastery đã ghi qua
 * /api/grade dựa trên đáp án lưu server; route này chỉ phát đề + chốt cờ.
 */

export async function GET() {
  const user = await getCurrentUser();
  const state = await loadOnboarding(user.id);
  return NextResponse.json({
    completed: state?.completed ?? false,
    completedAt: state?.completedAt ?? null,
    targetLevel: state?.targetLevel ?? null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  const rl = rateLimit(`diagnostic:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'start') {
    // Chặn re-issue: đã hoàn tất thì không phát đề mới (tránh farm mastery).
    const existing = await loadOnboarding(user.id);
    if (existing?.completed) {
      return NextResponse.json({ completed: true });
    }

    const questions = await Promise.all(
      getDiagnosticQuestions().map(async (q) => {
        const questionId = await issueQuestion(user.id, q.correct_choice, q.skillId, q.difficulty, {
          src: 'diagnostic',
          choiceAnalysis: q.choice_analysis,
        });
        return { ...stripQuestion(q), questionId };
      })
    );

    // Nếu vì lý do nào đó không issue được câu nào (DB lỗi) → báo lỗi thay vì trả rỗng.
    if (questions.some((q) => !q.questionId)) {
      return NextResponse.json({ error: 'Không thể chuẩn bị bài test. Vui lòng thử lại.' }, { status: 503 });
    }

    return NextResponse.json({ questions });
  }

  if (action === 'complete') {
    const raw = body?.targetLevel;
    const targetLevel = raw === 'A1' || raw === 'A2' || raw === 'B1' ? raw : undefined;

    if (targetLevel !== undefined) {
      await setGoal(user.id, targetLevel); // chuẩn hoá CEFR bên trong
    }
    await saveOnboardingComplete(user.id, targetLevel);

    // Diagnostic là MỒI đầu phễu: LUÔN trả full prediction (kể cả free) để user
    // thấy trọn giá trị 1 lần — nhưng kèm `tier` để UI mời nâng cấp đúng aha-moment
    // (free thấy điểm yếu ở đây, vào dashboard sẽ bị khóa → CTA "giữ lộ trình này").
    const [prediction, tier] = await Promise.all([
      predictScore(user.id),
      getUserTier(user.id),
    ]);
    return NextResponse.json({ completed: true, prediction, tier });
  }

  return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
}
