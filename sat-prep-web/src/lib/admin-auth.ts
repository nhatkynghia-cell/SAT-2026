import crypto from 'crypto';

/**
 * ============================================================================
 *  ADMIN AUTH (shared-secret) — Phase 2: Admin Fulfillment
 * ============================================================================
 *  App CHƯA có role system (§9.3). Để admin xử lý phiếu đổi quà (pending→fulfilled)
 *  mà KHÔNG dựng cả hệ role, dùng 1 secret dùng-chung đặt trong ENV `ADMIN_SECRET`
 *  (server-only, KHÔNG NEXT_PUBLIC_). Route admin đọc secret từ header
 *  `x-admin-secret` và so timing-safe với ENV.
 *
 *  🔴 2 CHỐT BẢO MẬT:
 *    1. FAIL-CLOSED: ENV `ADMIN_SECRET` chưa set / rỗng → TỪ CHỐI mọi request
 *       (KHÔNG "không set = ai cũng vào"). Không có secret nghĩa là khoá cửa.
 *    2. TIMING-SAFE: so sánh bằng crypto.timingSafeEqual (băm 2 vế về cùng độ
 *       dài trước) → không rò rỉ độ dài / vị trí lệch qua thời gian phản hồi.
 *
 *  ⚠️ THUẦN (pure) — không I/O ngoài đọc process.env + crypto. Tách để unit-test.
 *  Đây là biện pháp NHẸ cho beta; khi có role system đầy đủ thì thay thế.
 * ============================================================================
 */

/**
 * So 2 chuỗi bí mật theo thời-gian-hằng. Băm cả 2 về SHA-256 (32 byte cố định)
 * trước khi timingSafeEqual để tránh: (a) ném lỗi khi khác độ dài, (b) rò rỉ độ
 * dài secret qua kênh phụ. Khác giá trị → false.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  // ha/hb luôn 32 byte → timingSafeEqual không ném; kết quả chỉ true khi bằng hệt.
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Xác thực secret admin từ header. FAIL-CLOSED khi ENV chưa cấu hình.
 *
 * @param provided giá trị header `x-admin-secret` (hoặc null nếu thiếu)
 * @returns true CHỈ khi ENV `ADMIN_SECRET` có giá trị VÀ provided khớp hệt.
 */
export function verifyAdminSecret(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_SECRET;
  // Fail-closed: chưa cấu hình secret → khoá cửa, không cho ai vào.
  if (!expected || expected.length === 0) return false;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  return safeEqual(provided, expected);
}
