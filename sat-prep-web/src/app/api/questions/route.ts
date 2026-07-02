import { NextResponse } from 'next/server';
import goldenHourQuestions from '@/data/golden_hour_questions.json';

/**
 * "Câu hỏi vàng" (Golden Hour) cho AITutoring — 8 câu tĩnh legacy.
 *
 * ⚠️ SERVERLESS-SAFE (2026-07-02): trước đây đọc `fs.readFileSync` từ
 * `../10.SAT_Prep_App - Copy/data/...` — thư mục NGOÀI root deploy (sat-prep-web)
 * và đã bị gitignore → trên Vercel file không tồn tại → route 500. Nay JSON được
 * IMPORT như module (webpack bundle vào code lúc build) → luôn có mặt, không cần fs.
 */
export async function GET() {
  const questions = goldenHourQuestions as unknown[];
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Không có câu hỏi' }, { status: 500 });
  }
  // Lấy ngẫu nhiên 1 câu (route handler, KHÔNG phải render → Math.random an toàn).
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  return NextResponse.json(randomQuestion, { status: 200 });
}
