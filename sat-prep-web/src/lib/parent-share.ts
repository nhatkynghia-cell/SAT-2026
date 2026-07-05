import { randomBytes } from 'node:crypto';

/**
 * ============================================================================
 *  PARENT SHARE CODE — mã chia sẻ tiến độ cho phụ huynh (pure logic)
 * ============================================================================
 *  Học sinh sinh mã → phụ huynh mở /parent?code=XXX xem read-only (không cần
 *  tài khoản). Mã là BEARER TOKEN → phải đủ dài + rate-limit ở route.
 *
 *  Alphabet Crockford-ish (bỏ 0/O/1/I/L dễ nhầm) × 10 ký tự = 32^10 ≈ 1.1e15
 *  khả năng → chống brute-force (kết hợp rate-limit /api/parent/report).
 *  Dùng node:crypto (builtin → resolve được cả node --test lẫn Next runtime).
 * ============================================================================
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 ký tự (bỏ 0O1IL + U dễ nhầm)
const CODE_LEN = 10;
const PREFIX = 'PH-';

/** Sinh mã chia sẻ ngẫu nhiên crypto, dạng `PH-XXXXXXXXXX`. */
export function generateShareCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return PREFIX + out;
}

/** Kiểm tra định dạng mã hợp lệ (rẻ, chặn query rác trước khi tra DB). */
export function isValidCodeFormat(code: unknown): code is string {
  if (typeof code !== 'string' || !code.startsWith(PREFIX)) return false;
  const body = code.slice(PREFIX.length);
  if (body.length !== CODE_LEN) return false;
  for (const ch of body) if (!ALPHABET.includes(ch)) return false;
  return true;
}

export interface ShareCodeRow {
  code: string;
  student_user_id: string;
  revoked: boolean;
  expires_at: string | null;
}

/** Mã dùng được = chưa thu hồi VÀ (không hạn HOẶC chưa hết hạn). */
export function isCodeUsable(row: Pick<ShareCodeRow, 'revoked' | 'expires_at'> | null | undefined, nowMs: number): boolean {
  if (!row) return false;
  if (row.revoked) return false;
  if (row.expires_at != null) {
    const exp = Date.parse(row.expires_at);
    if (!Number.isNaN(exp) && exp <= nowMs) return false;
  }
  return true;
}
