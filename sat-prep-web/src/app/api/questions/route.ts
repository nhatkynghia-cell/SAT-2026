import { NextResponse } from 'next/server';
import goldenHourQuestions from '@/data/golden_hour_questions.json';
import { getCurrentUser } from '@/lib/auth';
import { issueQuestion } from '@/lib/issued-questions';

interface GoldenQuestion {
  id?: number;
  type?: string;
  question: string;
  choices: string[];
  correct: string;
  explanation?: string;
  translation?: string;
  passage?: string;
}

/**
 * "Câu hỏi vàng" (Golden Hour) cho AITutoring — 8 câu tĩnh legacy.
 *
 * ⚠️ SERVERLESS-SAFE (2026-07-02): JSON IMPORT như module (bundle lúc build) →
 * luôn có mặt trên Vercel, không cần fs.
 *
 * 🔴 ROOT A (2026-07-04): trước đây trả nguyên `correct` cho client → AITutoring
 * chấm client-side + tự khai thưởng (faucet). Nay issue câu (lưu đáp án server-side)
 * + GIẤU `correct` + trả questionId → AITutoring chấm qua /api/grade như mọi module.
 * Golden_hour không gắn skillId (type Math/Writing thô, không map taxonomy) → grade
 * không ghi mastery cho câu này (chấp nhận được), vẫn thưởng xu theo độ khó Medium.
 */
export async function GET() {
  const questions = goldenHourQuestions as GoldenQuestion[];
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Không có câu hỏi' }, { status: 500 });
  }

  const user = await getCurrentUser();

  // Lấy ngẫu nhiên 1 câu (route handler, KHÔNG phải render → Math.random an toàn).
  const q = questions[Math.floor(Math.random() * questions.length)];

  const questionId = await issueQuestion(user.id, q.correct, undefined, 'Medium', { src: 'golden_hour', explanation: q.explanation });
  if (!questionId) {
    return NextResponse.json({ error: 'Không thể chuẩn bị câu hỏi. Vui lòng thử lại.' }, { status: 503 });
  }
  const { correct: _hidden, explanation: _exp, ...safe } = q;
  return NextResponse.json({ ...safe, explanation: '', questionId }, { status: 200 });
}
