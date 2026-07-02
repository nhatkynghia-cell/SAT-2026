import { NextResponse } from 'next/server';
import mockExams from '@/data/mock_exams.json';

/**
 * Danh sách đề thi thử (mock exams) cho trang mock-exams/real-exams.
 *
 * ⚠️ SERVERLESS-SAFE (2026-07-02): trước đây đọc `fs.readFileSync` từ
 * `process.cwd()/data/mock_exams.json`. Next.js file-tracing KHÔNG đảm bảo
 * bundle file đọc qua đường dẫn động vào serverless function → trên Vercel có
 * thể trả rỗng âm thầm (fallback {exams:[]}). Nay JSON được IMPORT như module
 * (webpack bundle vào code lúc build) → luôn có mặt, không cần fs.
 */
export async function GET() {
  return NextResponse.json(mockExams);
}
