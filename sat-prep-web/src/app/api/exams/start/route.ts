import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getExamById } from '@/lib/exams';
import { issueQuestion } from '@/lib/issued-questions';
import { rateLimit } from '@/lib/rate-limit';

/**
 * BẮT ĐẦU 1 BÀI THI (ROOT A follow-up đường thi) — server phát đề + lưu đáp án.
 *
 * Với MỖI câu của đề, server issueQuestion (lưu correct_choice + difficulty vào
 * bảng issued_questions của user, giống ROOT A) rồi trả câu ĐÃ GIẤU đáp án kèm
 * `questionId`. Lúc nộp, client gửi lại {questionId, answer} → `/api/exams/grade`
 * chấm bằng compare-and-swap (mỗi câu tính điểm + thưởng ĐÚNG 1 LẦN). Nhờ vậy
 * client KHÔNG còn tự chấm/tự khai correctCount.
 *
 * skillId để trống: câu thi trộn nhiều kỹ năng (RW + Math) không map sạch sang 1
 * skill; đoán skill từ text bị CẤM (bẩn mastery) → thi KHÔNG ghi mastery (đó là
 * việc của đường luyện tập + Cổng Khảo Thí). Thi chỉ trao xu/XP theo câu đúng.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(`exam-start:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const { examId } = await req.json();
    if (typeof examId !== 'string' || !examId) {
      return NextResponse.json({ error: 'examId bắt buộc' }, { status: 400 });
    }

    const exam = getExamById(examId);
    if (!exam) {
      return NextResponse.json({ error: 'Không tìm thấy đề thi' }, { status: 404 });
    }

    // Phát từng câu song song: lưu đáp án server-side, trả câu đã giấu đáp án +
    // questionId. Giữ nguyên cấu trúc module (client cần để hiển thị + timer).
    const modules = await Promise.all(
      exam.modules.map(async (mod) => {
        const questions = await Promise.all(
          mod.questions.map(async (q) => {
            const questionId = await issueQuestion(user.id, q.correct_choice, undefined, q.difficulty, {
              src: 'exam',
            });
            const { correct_choice: _c, explanation: _e, ...safe } = q;
            return { ...safe, questionId };
          })
        );
        return { ...mod, questions };
      })
    );

    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      total_time_minutes: exam.total_time_minutes,
      modules,
    });
  } catch (error) {
    console.error('Exam start error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
