import { VNPay, HashAlgorithm, type ReturnQueryFromVNPay } from 'vnpay';

/**
 * ============================================================================
 *  VNPAY PAYMENT — Phase 2 Bước 2 (wrapper thư viện `vnpay`)
 * ============================================================================
 *  Dùng lib `vnpay` (lehuygiang28, MIT, chỉ phụ thuộc dayjs) cho phần chữ ký
 *  HMAC-SHA512 + build URL + verify IPN (battle-tested, tránh tự viết sai).
 *
 *  🔴 Amount: lib TỰ nhân 100 khi build URL và TỰ chia 100 khi verify → ta luôn
 *  làm việc với VND thô (khớp amount_vnd trong DB). Xem MUST-VERIFY ở verifyVnpayIpn.
 *
 *  Env (server-only): VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_HOST. Thiếu →
 *  getVnpayClient ném lỗi → route bắt → 503 (cổng chưa cấu hình).
 * ============================================================================
 */

let _client: VNPay | null = null;

/** Client VNPay singleton (đọc env server-only). Ném nếu thiếu creds. */
export function getVnpayClient(): VNPay {
  if (_client) return _client;

  const tmnCode = process.env.VNPAY_TMN_CODE;
  const secureSecret = process.env.VNPAY_HASH_SECRET;
  const vnpayHost = process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn';

  if (!tmnCode || !secureSecret) {
    throw new Error('VNPay chưa cấu hình (thiếu VNPAY_TMN_CODE / VNPAY_HASH_SECRET).');
  }

  _client = new VNPay({
    tmnCode,
    secureSecret,
    vnpayHost,
    testMode: vnpayHost.includes('sandbox'),
    hashAlgorithm: HashAlgorithm.SHA512,
  });
  return _client;
}

/** Cổng đã cấu hình chưa (route dùng để trả 503 sớm, không ném). */
export function isVnpayConfigured(): boolean {
  return !!process.env.VNPAY_TMN_CODE && !!process.env.VNPAY_HASH_SECRET;
}

/**
 * Build URL thanh toán VNPay. amountVnd là VND thô (lib tự ×100).
 * orderId = vnp_TxnRef (khóa idempotency). Trả URL để redirect browser.
 */
export function buildVnpayPaymentUrl(args: {
  orderId: string;
  amountVnd: number;
  orderInfo: string;
  ipAddr: string;
  returnUrl: string;
}): string {
  const vnpay = getVnpayClient();
  return vnpay.buildPaymentUrl({
    vnp_Amount: args.amountVnd, // lib tự nhân 100
    vnp_IpAddr: args.ipAddr,
    vnp_TxnRef: args.orderId,
    vnp_OrderInfo: args.orderInfo,
    vnp_ReturnUrl: args.returnUrl,
  });
}

export interface VnpayIpnResult {
  /** Chữ ký hợp lệ (dữ liệu toàn vẹn từ VNPay). */
  isVerified: boolean;
  /** Giao dịch thành công (vnp_ResponseCode/TransactionStatus = '00'). */
  isSuccess: boolean;
  /** Mã giao dịch merchant (vnp_TxnRef = orderId của ta). */
  orderId: string;
  /** Số tiền VND (lib đã chia 100). */
  amountVnd: number;
  /** Mã giao dịch phía VNPay (vnp_TransactionNo) để lưu đối soát. */
  gatewayTxnId: string;
}

/**
 * Verify lời gọi IPN từ VNPay. Lib lo phần bóc vnp_SecureHash + sort + HMAC-SHA512
 * so sánh → trả isVerified/isSuccess. Ta chỉ bóc các field cần cho xử lý đơn.
 *
 * ⚠️ MUST-VERIFY khi có creds: xác nhận `vnp_Amount` lib trả về là VND thô (đã
 * chia 100). Theo thiết kế lib (tự ×100 lúc build) thì verify tự ÷100; nếu roundtrip
 * thật báo amount_mismatch thì kiểm lại chỗ này (có thể phải /100 thủ công).
 */
export function verifyVnpayIpn(query: ReturnQueryFromVNPay): VnpayIpnResult {
  const vnpay = getVnpayClient();
  const result = vnpay.verifyIpnCall(query);

  return {
    isVerified: result.isVerified,
    isSuccess: result.isSuccess,
    orderId: String(result.vnp_TxnRef ?? ''),
    amountVnd: Number(result.vnp_Amount ?? 0),
    gatewayTxnId: String(result.vnp_TransactionNo ?? ''),
  };
}
