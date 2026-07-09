import { NextResponse } from 'next/server';
import {
  IpnSuccess,
  IpnOrderNotFound,
  InpOrderAlreadyConfirmed,
  IpnInvalidAmount,
  IpnFailChecksum,
  IpnUnknownError,
  type ReturnQueryFromVNPay,
} from 'vnpay';
import { verifyVnpayIpn } from '@/lib/payment-vnpay';
import { confirmPaymentAtomic } from '@/lib/payment-store';
import { grantSubscription } from '@/lib/subscription-store';

/**
 * ============================================================================
 *  VNPAY IPN — Phase 2 Bước 2 (server-to-server, AUTHORITATIVE)
 * ============================================================================
 *  VNPay gọi GET với query params sau khi user thanh toán. ĐÂY là nguồn sự thật
 *  để cấp gói (KHÔNG phải Return URL — browser giả mạo được).
 *
 *  Luồng: verify chữ ký HMAC-SHA512 (lib) → confirm_payment ATOMIC (chống double-
 *  grant + kiểm tiền) → grantSubscription CHỈ khi lật pending→paid lần đầu.
 *  Trả { RspCode, Message } đúng mã VNPay (tái dụng constants của lib).
 * ============================================================================
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries()) as unknown as ReturnQueryFromVNPay;

    const result = verifyVnpayIpn(query);

    // 1) Chữ ký sai → dữ liệu không toàn vẹn → từ chối.
    if (!result.isVerified) {
      return NextResponse.json(IpnFailChecksum);
    }

    // 2) Giao dịch THẤT BẠI/hủy (chữ ký hợp lệ nhưng responseCode≠'00') → KHÔNG
    //    đụng vào đơn (tránh lật pending→'paid' oan, kẹt đơn, nuốt thanh toán
    //    thật sau). Ack IpnSuccess để VNPay dừng retry — đối xứng momo-ipn:38.
    if (!result.isSuccess) {
      return NextResponse.json(IpnSuccess);
    }

    // 3) Xác nhận atomic (kiểm tiền + idempotent). amountVnd từ IPN đã ÷100 (lib).
    const outcome = await confirmPaymentAtomic(result.orderId, result.gatewayTxnId, result.amountVnd);

    if (!outcome.ok) {
      if (outcome.reason === 'not_found') return NextResponse.json(IpnOrderNotFound);
      if (outcome.reason === 'amount_mismatch') return NextResponse.json(IpnInvalidAmount);
      // confirm_unavailable / bad_status / error → báo lỗi để VNPay retry sau.
      return NextResponse.json(IpnUnknownError);
    }

    // 4) Đã xác nhận trước đó → idempotent, KHÔNG cấp lại gói.
    if (outcome.alreadyConfirmed) {
      return NextResponse.json(InpOrderAlreadyConfirmed);
    }

    // 5) Lật pending→paid THÀNH CÔNG lần đầu (isSuccess đã đảm bảo ở bước 2) → cấp gói.
    if (outcome.userId && outcome.tier && outcome.period) {
      await grantSubscription(outcome.userId, outcome.tier, outcome.period);
    }

    return NextResponse.json(IpnSuccess);
  } catch (error) {
    console.error('Lỗi vnpay-ipn:', error);
    return NextResponse.json(IpnUnknownError);
  }
}
