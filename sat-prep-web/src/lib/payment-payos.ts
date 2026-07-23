import crypto from 'crypto';
import { safeCompareHex } from './payment-momo';

/**
 * ============================================================================
 *  PAYOS PAYMENT (by Casso) — cổng chuyển khoản VietQR cho cá nhân VN
 * ============================================================================
 *  payOS cho phép CÁ NHÂN đăng ký bằng CCCD (không cần GPKD/hợp đồng): dùng
 *  CHÍNH tài khoản ngân hàng cá nhân + VietQR + Open Banking. Khách quét QR
 *  chuyển khoản → payOS bắn webhook → app cấp gói. Tiền về thẳng TK, không phí %.
 *
 *  Tự viết theo tài liệu payOS v2:
 *    create : POST https://api-merchant.payos.vn/v2/payment-requests
 *             header x-client-id + x-api-key; signature = HMAC-SHA256(checksumKey,
 *             "amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=..")
 *             (5 field CỐ ĐỊNH, sort alphabet theo key).
 *    webhook: body { code, desc, success, data:{...}, signature }; signature =
 *             HMAC-SHA256(checksumKey, sort-alphabet mọi field trong `data`).
 *
 *  🔴 CHỮ KÝ LÀ CHỐT BẢO MẬT (money surface §9.1). Hàm build/verify chữ ký THUẦN
 *  (không I/O) để unit-test xác định. createPayosPayment() (I/O fetch) tách riêng.
 *
 *  🔴 orderCode payOS là SỐ NGUYÊN (≤ 2^53-1). App dùng order_id dạng chuỗi UNIQUE
 *  → lưu order_id = String(orderCode); webhook trả orderCode number → String() khớp.
 * ============================================================================
 */

/** Tham số ký create request. amount là VND thô (số nguyên, KHÔNG ×100). */
export interface PayosCreateParams {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
}

/**
 * Build chuỗi ký create — thứ tự field CỐ ĐỊNH alphabet theo spec payOS:
 * amount, cancelUrl, description, orderCode, returnUrl. KHÔNG đổi thứ tự.
 */
export function buildPayosCreateRaw(p: PayosCreateParams): string {
  return (
    `amount=${p.amount}` +
    `&cancelUrl=${p.cancelUrl}` +
    `&description=${p.description}` +
    `&orderCode=${p.orderCode}` +
    `&returnUrl=${p.returnUrl}`
  );
}

/** Ký create: HMAC-SHA256(checksumKey, raw) → hex. THUẦN. */
export function signPayosCreate(p: PayosCreateParams, checksumKey: string): string {
  const raw = buildPayosCreateRaw(p);
  return crypto.createHmac('sha256', checksumKey).update(raw).digest('hex');
}

/**
 * Build chuỗi ký cho object `data` webhook: sort key theo alphabet, nối
 * `key=value&key2=value2...`. Giá trị null/undefined → chuỗi rỗng (spec payOS).
 * Dùng cho cả webhook lẫn khi payOS trả `data` trong response create.
 */
export function buildPayosDataRaw(data: Record<string, unknown>): string {
  const keys = Object.keys(data).sort();
  return keys
    .map((k) => {
      const v = data[k];
      const val = v === null || v === undefined ? '' : String(v);
      return `${k}=${val}`;
    })
    .join('&');
}

/**
 * Verify chữ ký webhook payOS. Rebuild raw từ object `data` (server-side
 * checksumKey) rồi so timing-safe với `signature`. THUẦN.
 */
export function verifyPayosWebhook(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string
): boolean {
  const raw = buildPayosDataRaw(data);
  const expected = crypto.createHmac('sha256', checksumKey).update(raw).digest('hex');
  return safeCompareHex(expected, String(signature ?? ''));
}

/** code === '00' nghĩa là thành công (spec payOS). Chấp cả number lẫn string. */
export function isPayosSuccess(code: unknown): boolean {
  return String(code) === '00';
}

/** Cổng payOS đã cấu hình chưa (route dùng để trả 503 sớm, không ném). */
export function isPayosConfigured(): boolean {
  return (
    !!process.env.PAYOS_CLIENT_ID &&
    !!process.env.PAYOS_API_KEY &&
    !!process.env.PAYOS_CHECKSUM_KEY
  );
}

/**
 * Sinh orderCode SỐ NGUYÊN duy nhất cho payOS (≤ 2^53-1). Ghép mili-giây
 * hiện tại với counter 3 chữ số trong process. Trước đây dùng giây + random
 * 0..999 → burst vài chục đơn/giây có thể đụng UNIQUE order_id. Counter đơn
 * điệu đóng collision trong cùng server process; vẫn nằm dưới Number.MAX_SAFE_INTEGER.
 */
let payosOrderCounter = 0;
let payosOrderLastMs = 0;
export function generatePayosOrderCode(): number {
  const ms = Date.now(); // ~13 chữ số
  if (ms === payosOrderLastMs) {
    payosOrderCounter = (payosOrderCounter + 1) % 1000;
  } else {
    payosOrderLastMs = ms;
    payosOrderCounter = 0;
  }
  return ms * 1000 + payosOrderCounter;
}

/**
 * ============================================================================
 *  I/O — gọi API create của payOS (tách khỏi phần chữ ký thuần ở trên)
 * ============================================================================
 */

export interface PayosCreateResult {
  ok: boolean;
  payUrl?: string;
  message?: string;
}

/**
 * Gọi payOS create → trả checkoutUrl để redirect. Đọc creds từ env (server-only).
 * Trả ok:false nếu thiếu creds hoặc payOS trả lỗi (route bắt → 503).
 *
 * description payOS giới hạn ~25 ký tự → cắt gọn để tránh lỗi/lệch chữ ký.
 */
export async function createPayosPayment(args: {
  amountVnd: number;
  orderCode: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayosCreateResult> {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const createUrl =
    process.env.PAYOS_CREATE_URL || 'https://api-merchant.payos.vn/v2/payment-requests';

  if (!clientId || !apiKey || !checksumKey) {
    return { ok: false, message: 'payOS chưa được cấu hình (thiếu creds).' };
  }

  // description payOS tối đa 25 ký tự (VietQR content) → cắt an toàn.
  const description = args.description.slice(0, 25);

  const params: PayosCreateParams = {
    orderCode: args.orderCode,
    amount: args.amountVnd,
    description,
    cancelUrl: args.cancelUrl,
    returnUrl: args.returnUrl,
  };
  const signature = signPayosCreate(params, checksumKey);

  const body = { ...params, signature };

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    code?: string;
    desc?: string;
    data?: { checkoutUrl?: string } | null;
  };

  if (res.ok && String(json?.code) === '00' && json?.data?.checkoutUrl) {
    return { ok: true, payUrl: json.data.checkoutUrl };
  }
  return {
    ok: false,
    message: json?.desc ?? `payOS tạo giao dịch thất bại (HTTP ${res.status}).`,
  };
}
