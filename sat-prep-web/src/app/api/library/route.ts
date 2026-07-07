import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { listExamsPublic, getExamById, getExamQuestionMap } from '@/lib/exams';
import { issueQuestion } from '@/lib/issued-questions';

/**
 * LIBRARY — Thư viện đề thực chiến (làm bài THẬT có tính giờ).
 *
 * Nguồn câu hỏi: mock_exams.json (qua src/lib/exams.ts) — câu hỏi có sẵn đoạn
 * văn + 4 đáp án + đáp án đúng + lời giải tĩnh. Server LUÔN biết đáp án.
 *
 * GET          → danh sách thẻ câu (đã GIẤU đáp án) cho tìm kiếm/lọc.
 * POST {id}    → issueQuestion (lưu correct_choice + explanation server-side) →
 *                trả câu ĐÃ GIẤU đáp án + questionId + timeLimit. Client render
 *                qua CorePracticeUI → submit tự chấm qua /api/grade (server-auth).
 *
 * ID định dạng "<examId>::<questionId>" để tra ngược đúng câu trong đề.
 */

const SEP = '::';

/** Suy môn học từ tên module ("Reading & Writing (Module 1)" / "Math (Module 1)"). */
function subjectFromModule(name: string): 'Reading & Writing' | 'Math' {
  return /math|toán/i.test(name) ? 'Math' : 'Reading & Writing';
}

/** Cắt gọn câu hỏi để hiển thị preview trên thẻ. */
function preview(text: string, max = 90): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

export async function GET() {
  await getCurrentUser(); // yêu cầu đăng nhập (ném nếu chưa auth)

  const cards: Array<{
    id: string;
    tag: string;
    text: string;
    source: string;
    subject: 'Reading & Writing' | 'Math';
    difficulty: string;
  }> = [];

  for (const exam of listExamsPublic()) {
    for (const mod of exam.modules) {
      const subject = subjectFromModule(mod.name);
      for (const q of mod.questions) {
        cards.push({
          id: `${exam.id}${SEP}${q.id}`,
          tag: mod.name,
          text: preview(q.practice_question),
          source: exam.title,
          subject,
          difficulty: q.difficulty,
        });
      }
    }
  }

  return NextResponse.json({ questions: cards });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  const rl = rateLimit(`library:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const compositeId = body?.id;
  if (typeof compositeId !== 'string' || !compositeId.includes(SEP)) {
    return NextResponse.json({ error: 'id không hợp lệ' }, { status: 400 });
  }

  const [examId, questionRawId] = compositeId.split(SEP);
  const exam = getExamById(examId);
  if (!exam) {
    return NextResponse.json({ error: 'Không tìm thấy đề' }, { status: 404 });
  }

  // Tìm câu + module chứa nó (để suy timeLimit theo thời gian module / số câu).
  const qMap = getExamQuestionMap(exam);
  const q = qMap.get(questionRawId);
  if (!q) {
    return NextResponse.json({ error: 'Không tìm thấy câu hỏi' }, { status: 404 });
  }
  const mod = exam.modules.find((m) => m.questions.some((x) => x.id === questionRawId));

  // timeLimit (giây): thời gian module chia đều số câu, fallback 90s, kẹp [30, 300].
  let timeLimit = 90;
  if (mod && mod.questions.length > 0 && mod.time_minutes > 0) {
    timeLimit = Math.round((mod.time_minutes * 60) / mod.questions.length);
  }
  timeLimit = Math.min(300, Math.max(30, timeLimit));

  // Phát câu server-side: lưu đáp án đúng + lời giải trong context (GIẤU khỏi client).
  const questionId = await issueQuestion(user.id, q.correct_choice, undefined, q.difficulty, {
    src: 'library',
    explanation: q.explanation,
  });
  if (!questionId) {
    return NextResponse.json({ error: 'Không thể chuẩn bị câu hỏi. Vui lòng thử lại.' }, { status: 503 });
  }

  // Payload cho CorePracticeUI (PracticeQuestion) — KHÔNG kèm correct_choice/explanation.
  const question = {
    title: mod ? `${subjectFromModule(mod.name)} · ${exam.title}` : exam.title,
    full_passage: q.full_passage,
    practice_question: q.practice_question,
    choices: q.choices,
    explanation: '', // lộ SAU khi nộp qua /api/grade (revealedExplanation)
    difficulty: q.difficulty,
    trapRate: q.trapRate ?? 40,
    questionId,
  };

  return NextResponse.json({ question, questionId, timeLimit });
}
