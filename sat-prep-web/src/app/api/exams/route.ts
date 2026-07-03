import { NextResponse } from 'next/server';
import { listExamsPublic } from '@/lib/exams';

/**
 * Danh sách đề thi thử cho trang mock-exams/real-exams (CHỈ metadata + câu hỏi
 * đã GIẤU đáp án).
 *
 * 🔴 ROOT A follow-up (đường thi, 2026-07-04): trước đây route trả NGUYÊN
 * `correct_choice` + `explanation` của mọi câu xuống client → client tự chấm rồi
 * POST `correctCount` tùy ý lên `/api/economy {action:'exam'}` (faucet xu). Nay:
 *   • GET này chỉ trả đề đã GIẤU đáp án (listExamsPublic) — dùng để hiển thị thẻ
 *     đề + xem trước, KHÔNG đủ để tự chấm.
 *   • Vào thi thật: POST `/api/exams/start` (server phát câu + lưu đáp án riêng).
 *   • Nộp: POST `/api/exams/grade` (server chấm + thưởng).
 *
 * SERVERLESS-SAFE: JSON import như module (webpack bundle), không fs động.
 */
export async function GET() {
  return NextResponse.json({ exams: listExamsPublic() });
}
