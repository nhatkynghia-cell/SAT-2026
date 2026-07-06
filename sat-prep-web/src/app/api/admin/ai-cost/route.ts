import { NextResponse } from 'next/server';
import { getCostReport } from '@/lib/ai-cost';
import { verifyAdminSecret } from '@/lib/admin-auth';

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
 */
export async function GET(req: Request) {
  if (!verifyAdminSecret(req.headers.get('x-admin-secret'))) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập.' }, { status: 403 });
  }
  return NextResponse.json(await getCostReport());
}
