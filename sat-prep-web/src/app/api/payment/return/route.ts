import { NextResponse } from 'next/server';
import { getTransaction } from '@/lib/payment-store';

/**
 * ============================================================================
 *  PAYMENT RETURN — Phase 2 Bước 2 (landing sau khi user rời cổng)
 * ============================================================================
 *  Cả VNPay (vnp_TxnRef) và MoMo (orderId) redirect browser về đây kèm orderId.
 *  🔴 CHỈ HIỂN THỊ trạng thái — KHÔNG cấp gói (browser giả mạo được; chỉ IPN
 *  server-to-server đã verify chữ ký mới cấp). Đọc trạng thái đã được IPN cập
 *  nhật (nếu IPN tới trước) rồi redirect về /upgrade với ?status=... để UI báo.
 * ============================================================================
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  // VNPay dùng vnp_TxnRef; MoMo dùng orderId.
  const orderId = url.searchParams.get('vnp_TxnRef') || url.searchParams.get('orderId') || '';

  const origin = process.env.APP_BASE_URL?.replace(/\/$/, '') || url.origin;

  let status = 'unknown';
  if (orderId) {
    const txn = await getTransaction(orderId);
    if (txn) status = txn.status; // 'pending' (IPN chưa tới) | 'paid' | ...
  }

  // Redirect về trang nâng cấp với trạng thái để UI hiển thị thân thiện.
  const dest = new URL('/upgrade', origin);
  dest.searchParams.set('status', status);
  if (orderId) dest.searchParams.set('order', orderId);
  return NextResponse.redirect(dest.toString());
}
