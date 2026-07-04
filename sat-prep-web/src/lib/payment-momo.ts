import crypto from 'crypto';

/**
 * ============================================================================
 *  MOMO PAYMENT (v2 Capture Wallet) — Phase 2 Bước 2
 * ============================================================================
 *  Tự viết theo sample CHÍNH THỨC `momo-wallet/payment/nodejs/MoMo.js`:
 *    endpoint POST https://test-payment.momo.vn/v2/gateway/api/create
 *    chữ ký = HMAC-SHA256(secretKey, rawSignature) hex.
 *
 *  🔴 CHỮ KÝ LÀ CHỐT BẢO MẬT. Hàm build/verify chữ ký là THUẦN (không I/O) để
 *  unit-test xác định. createMomoPayment() (I/O fetch) tách riêng bên dưới.
 *
 *  ⚠️ MUST-VERIFY khi có sandbox creds: THỨ TỰ FIELD của rawSignature IPN (khác
 *  create — thêm message/orderType/payType/responseTime/resultCode/transId).
 *  Thứ tự dưới đây theo spec MoMo v2 đã biết; nếu verify IPN thật fail thì đối
 *  chiếu lại thứ tự field với payload MoMo gửi về (giữ alphabet theo key).
 * ============================================================================
 */

/** Tham số tạo giao dịch (client KHÔNG gửi amount — server tra PLANS). */
export interface MomoCreateParams {
  partnerCode: string;
  accessKey: string;
  requestId: string;
  amount: string; // VND thô (KHÔNG ×100), dạng chuỗi theo sample MoMo
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  extraData: string; // '' khi không có store
  requestType: string; // 'captureWallet'
}

/**
 * Build rawSignature CHO create request — thứ tự field alphabet CỐ ĐỊNH theo
 * sample chính thức MoMo.js. KHÔNG được đổi thứ tự (MoMo verify y hệt phía họ).
 */
export function buildMomoCreateRawSignature(p: MomoCreateParams): string {
  return (
    `accessKey=${p.accessKey}` +
    `&amount=${p.amount}` +
    `&extraData=${p.extraData}` +
    `&ipnUrl=${p.ipnUrl}` +
    `&orderId=${p.orderId}` +
    `&orderInfo=${p.orderInfo}` +
    `&partnerCode=${p.partnerCode}` +
    `&redirectUrl=${p.redirectUrl}` +
    `&requestId=${p.requestId}` +
    `&requestType=${p.requestType}`
  );
}

/** Ký create request: HMAC-SHA256(secretKey, rawSignature) → hex. THUẦN. */
export function signMomoCreate(p: MomoCreateParams, secretKey: string): string {
  const raw = buildMomoCreateRawSignature(p);
  return crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
}

/**
 * Payload MoMo gửi về IPN (POST JSON). Chỉ khai các field dùng cho chữ ký + xử lý.
 */
export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number | string;
  orderInfo: string;
  orderType: string;
  transId: number | string;
  resultCode: number | string;
  message: string;
  payType: string;
  responseTime: number | string;
  extraData: string;
  signature: string;
}

/**
 * Build rawSignature CHO IPN callback — thứ tự field alphabet theo spec v2.
 * ⚠️ MUST-VERIFY thứ tự này với payload thật khi có creds (xem chú thích đầu file).
 */
export function buildMomoIpnRawSignature(p: MomoIpnPayload, accessKey: string): string {
  return (
    `accessKey=${accessKey}` +
    `&amount=${p.amount}` +
    `&extraData=${p.extraData}` +
    `&message=${p.message}` +
    `&orderId=${p.orderId}` +
    `&orderInfo=${p.orderInfo}` +
    `&orderType=${p.orderType}` +
    `&partnerCode=${p.partnerCode}` +
    `&payType=${p.payType}` +
    `&requestId=${p.requestId}` +
    `&responseTime=${p.responseTime}` +
    `&resultCode=${p.resultCode}` +
    `&transId=${p.transId}`
  );
}

/** So sánh chữ ký timing-safe (chống timing attack). THUẦN. */
export function safeCompareHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verify chữ ký IPN từ MoMo. Rebuild rawSignature từ payload (dùng accessKey +
 * secretKey server-side) rồi so timing-safe với p.signature. THUẦN.
 */
export function verifyMomoIpnSignature(
  p: MomoIpnPayload,
  accessKey: string,
  secretKey: string
): boolean {
  const raw = buildMomoIpnRawSignature(p, accessKey);
  const expected = crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
  return safeCompareHex(expected, String(p.signature ?? ''));
}

/** resultCode === 0 nghĩa là thanh toán thành công (spec MoMo v2). */
export function isMomoSuccess(resultCode: number | string): boolean {
  return Number(resultCode) === 0;
}

/**
 * ============================================================================
 *  I/O — gọi API create của MoMo (tách khỏi phần chữ ký thuần ở trên)
 * ============================================================================
 */

export interface MomoCreateResult {
  ok: boolean;
  payUrl?: string;
  message?: string;
  resultCode?: number;
}

/**
 * Gọi MoMo create → trả payUrl để redirect. Đọc creds từ env (server-only).
 * Ném lỗi/trả ok:false nếu thiếu creds hoặc MoMo trả lỗi (route bắt → 503).
 */
export async function createMomoPayment(args: {
  amountVnd: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  requestId: string;
}): Promise<MomoCreateResult> {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const createUrl = process.env.MOMO_CREATE_URL || 'https://test-payment.momo.vn/v2/gateway/api/create';

  if (!partnerCode || !accessKey || !secretKey) {
    return { ok: false, message: 'MoMo chưa được cấu hình (thiếu creds).' };
  }

  const params: MomoCreateParams = {
    partnerCode,
    accessKey,
    requestId: args.requestId,
    amount: String(args.amountVnd),
    orderId: args.orderId,
    orderInfo: args.orderInfo,
    redirectUrl: args.redirectUrl,
    ipnUrl: args.ipnUrl,
    extraData: '',
    requestType: 'captureWallet',
  };
  const signature = signMomoCreate(params, secretKey);

  const body = { ...params, signature, lang: 'vi' };

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (data?.resultCode === 0 && typeof data?.payUrl === 'string') {
    return { ok: true, payUrl: data.payUrl, resultCode: 0 };
  }
  return { ok: false, message: data?.message ?? 'MoMo tạo giao dịch thất bại.', resultCode: data?.resultCode };
}
