import { NextResponse } from 'next/server';
import { getCostReport } from '@/lib/ai-cost';

/**
 * AI COST REPORT (implementation_plan.md §9.5, task #5)
 *
 * GET → chi phí AI toàn hệ thống hôm nay: số lượt gọi, token in/out, chi phí
 *       USD ước tính, ngân sách ngày và phần còn lại.
 *
 * ⚠️ TODO(Phase 2): endpoint này lộ số liệu vận hành toàn hệ thống — khi có
 * hệ thống role (§9.3), PHẢI giới hạn chỉ cho admin. Hiện chưa có role nên để
 * mở trong môi trường dev; KHÔNG được public khi lên production.
 */
export async function GET() {
  return NextResponse.json(getCostReport());
}
