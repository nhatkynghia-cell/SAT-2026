import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { pickSpeedQuizSkill } from '@/lib/adaptive';
import { tagQuestion } from '@/lib/speed-quiz-store';

/**
 * SPEED QUIZ QUESTION API — "Trả lời nhanh" adaptive (kế thừa engine Tower).
 *
 * GET ?answered=N → chọn skill + độ khó cho câu kế tiếp dựa trên MASTERY thật của
 * user (server-authoritative, ĐA MÔN — không chỉ Toán như Tower), rồi sinh câu qua
 * /api/generate-practice. Câu trả về mang skillId THẬT nên CorePracticeUI ghi
 * mastery đúng skill khi chấm ở /api/grade.
 *
 * `answered` = số câu ĐÚNG tính tới hiện tại trong lượt → càng cao câu càng khó
 * (speedQuizDifficulty). Client KHÔNG được tự chọn skill/độ khó (chống chơi xấu).
 * Mirror pattern /api/tower/question.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const answeredParam = request.nextUrl.searchParams.get('answered');
  const answered = Number(answeredParam ?? '0');
  if (!Number.isInteger(answered) || answered < 0) {
    return NextResponse.json({ error: 'answered phải là số nguyên >= 0' }, { status: 400 });
  }
  // sessionId (tùy chọn) — để TAG câu vào session (chống gian lận đếm). Không có
  // (pre-migration / client cũ) → vẫn phát câu bình thường, chỉ không tag.
  const sessionId = request.nextUrl.searchParams.get('session');

  const summary = await getMasterySummary(user.id);
  const pick = pickSpeedQuizSkill(summary.skills, answered);
  if (!pick) {
    return NextResponse.json({ error: 'Không tìm thấy kỹ năng để sinh câu hỏi' }, { status: 404 });
  }

  try {
    const res = await fetch(new URL('/api/generate-practice', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        moduleType: pick.moduleType,
        topic: pick.label,
        skillId: pick.skillId,
        difficulty: pick.difficulty,
      }),
    });

    if (!res.ok) {
      // Chuyển nguyên trạng thái lỗi (quota 429 / budget 503 / cấu hình 500) để
      // client hiển thị đúng thông điệp thay vì nuốt mất.
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu hỏi cho lượt trả lời nhanh.' },
        { status: res.status }
      );
    }

    const data = await res.json();

    // TAG câu vào session để finalize đếm được câu was_correct=true THẬT (chống
    // gian lận). RPC tự bảo vệ quyền sở hữu session; lỗi không chặn phát câu.
    if (sessionId && typeof data?.questionId === 'string') {
      await tagQuestion(sessionId, user.id, data.questionId);
    }

    // Gắn kèm difficulty + skillId đã chọn (đảm bảo client/Mastery dùng đúng mức,
    // không phụ thuộc field difficulty do AI tự ghi).
    return NextResponse.json({ ...data, difficulty: pick.difficulty, skillId: pick.skillId });
  } catch (e) {
    console.error('Speed Quiz question: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu hỏi cho lượt trả lời nhanh.' }, { status: 503 });
  }
}
