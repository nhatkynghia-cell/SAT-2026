import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { isValidCodeFormat } from '@/lib/parent-share';
import { resolveShareCode } from '@/lib/parent-share-store';
import { buildParentReport } from '@/lib/parent-report-store';

/**
 * PARENT REPORT (KHÔNG auth) — phụ huynh nhập mã chia sẻ → xem tiến độ con.
 *
 * Bảo mật:
 *  • Mã là bearer token đủ dài (parent-share.ts) → rate-limit theo mã + theo IP
 *    proxy chống brute-force dò mã.
 *  • resolveShareCode kiểm mã còn dùng được (chưa thu hồi/hết hạn) → studentId.
 *  • buildParentReport CHỈ trả tiến độ học (điểm, mastery, streak, trend, lịch sử
 *    thi), KHÔNG email/PII con.
 *  • Mã sai/thu hồi/hết hạn → 404 (không phân biệt để không lộ mã nào tồn tại).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';

  if (!isValidCodeFormat(code)) {
    return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 404 });
  }

  // Rate-limit theo mã (chống dò 1 mã) — 30 lần/phút đủ cho reload thật.
  const rl = rateLimit(`parent-report:${code}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // Rate-limit theo IP proxy (chống dò NHIỀU mã từ 1 nguồn — key-theo-mã ở trên
  // cho mỗi mã đoán 1 bucket mới nên không chặn enumeration). 60 lần/phút/IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rlIp = rateLimit(`parent-report-ip:${ip}`, 60, 60_000);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rlIp.retryAfterMs }, { status: 429 });
  }

  const studentId = await resolveShareCode(code);
  if (!studentId) {
    return NextResponse.json({ error: 'Mã không tồn tại hoặc đã hết hạn' }, { status: 404 });
  }

  try {
    const report = await buildParentReport(studentId);
    return NextResponse.json(report);
  } catch (e) {
    console.error('Parent report error:', e);
    return NextResponse.json({ error: 'Không thể tải báo cáo. Vui lòng thử lại.' }, { status: 500 });
  }
}
