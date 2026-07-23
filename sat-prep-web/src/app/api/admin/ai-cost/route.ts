import { NextResponse } from 'next/server';
import { getCostReport } from '@/lib/ai-cost';
import { verifyAdminSecret } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * AI COST REPORT (implementation_plan.md §9.5, task #5)
 *
 * GET → chi phí AI toàn hệ thống hôm nay: số lượt gọi, token in/out, chi phí
 *       USD ước tính, ngân sách ngày và phần còn lại.
 *
 * 🔒 BẢO VỆ bằng shared-secret (header `x-admin-secret` so timing-safe với ENV
 * ADMIN_SECRET — admin-auth.ts), cùng cơ chế /api/admin/redemptions. App chưa có
 * role system → đây là biện pháp NHẸ. FAIL-CLOSED: ENV chưa set → mọi request
 * 403 (số liệu vận hành toàn hệ thống KHÔNG lộ ra ngoài).
 *
 * 🔴 Chống brute-force: CHỈ rate-limit lần thử SAI secret theo IP (10 lần/phút);
 * secret đúng không chạm limit. Middleware allow /api/admin (public) nên endpoint
 * này tự bảo vệ.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function GET(req: Request) {
  if (!verifyAdminSecret(req.headers.get('x-admin-secret'))) {
    const rl = rateLimit(`admin-auth-fail:${clientIp(req)}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử sai. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập.' }, { status: 403 });
  }
  return NextResponse.json(await getCostReport());
}
