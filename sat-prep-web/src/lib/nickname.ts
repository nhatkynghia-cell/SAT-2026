/**
 * ============================================================================
 *  NICKNAME (pure) — validate BÍ DANH leaderboard (moderation cơ bản)
 * ============================================================================
 *  User là học sinh VỊ THÀNH NIÊN + bí danh hiển thị công khai trên bảng xếp
 *  hạng → cần chặn tên bậy/mạo danh/ký tự lạ. THUẦN (no I/O) để unit-test.
 *
 *  Nhiều lớp phòng thủ:
 *    1. Độ dài 3–20 (khớp CHECK constraint DB trong user_profiles.sql).
 *    2. Whitelist ký tự: chữ (kể cả có dấu tiếng Việt), số, khoảng trắng, _ - .
 *       → chặn zero-width / emoji / ký tự điều khiển (chống spoof/mạo danh).
 *    3. Blocklist từ bậy cơ bản: so khớp SAU normalize (bỏ dấu + hạ chữ + gỡ ký
 *       tự phân tách) → chống lách kiểu "f_u_c_k" / "đ.ị.t".
 *  Blocklist KHÔNG thể hoàn hảo — đây là moderation cơ bản, kèm cooldown +
 *  rate-limit ở tầng API. Có thể bổ sung ẩn thủ công sau.
 * ============================================================================
 */

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

/** Ký tự cho phép: chữ Unicode (có dấu), số, khoảng trắng, gạch dưới/ngang/chấm. */
const ALLOWED_PATTERN = /^[\p{L}\p{N} _.-]+$/u;

/**
 * Blocklist cơ bản (dạng đã bỏ dấu + thường). Danh sách gọn — chặn các từ tục
 * phổ biến tiếng Việt + Anh. Mở rộng dần khi cần.
 */
const BLOCKLIST = [
  'dit', 'lon', 'cac', 'buoi', 'cak', 'loz', 'dcm', 'dmm', 'vcl', 'vl', 'clm',
  'fuck', 'shit', 'bitch', 'dick', 'cunt', 'pussy', 'sex', 'nigger', 'admin',
  ' diu', 'condom', 'cu', 'dam', 'ngu', 'oc cho', 'occho',
];

export interface NicknameCheck {
  ok: boolean;
  /** Lý do khi không hợp lệ (dùng cho thông điệp toast). */
  reason?: 'empty' | 'too_short' | 'too_long' | 'bad_chars' | 'blocked';
  /** Bí danh đã chuẩn hoá (trim + gom khoảng trắng) khi hợp lệ. */
  normalized?: string;
}

/** Bỏ dấu tiếng Việt + hạ chữ + gỡ mọi ký tự KHÔNG phải chữ/số (để so blocklist). */
function normalizeForBlocklist(s: string): string {
  // NFD tách chữ có dấu → chữ nền + dấu tổ hợp; đ→d riêng (đ không tách trong
  // NFD); rồi gỡ MỌI ký tự không phải a-z0-9 (gồm cả dấu tổ hợp + ký tự phân
  // tách) → "é"→"e", "f_u_c_k"→"fuck", "đ.ị.t"→"dit".
  return s
    .normalize('NFD')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function validateNickname(raw: string): NicknameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };

  // Chuẩn hoá hiển thị: trim + gom nhiều khoảng trắng thành 1.
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) return { ok: false, reason: 'empty' };
  if (normalized.length < NICKNAME_MIN) return { ok: false, reason: 'too_short' };
  if (normalized.length > NICKNAME_MAX) return { ok: false, reason: 'too_long' };

  if (!ALLOWED_PATTERN.test(normalized)) return { ok: false, reason: 'bad_chars' };

  const collapsed = normalizeForBlocklist(normalized);
  for (const bad of BLOCKLIST) {
    const key = bad.replace(/[^a-z0-9]/g, '');
    if (key && collapsed.includes(key)) return { ok: false, reason: 'blocked' };
  }

  return { ok: true, normalized };
}

/** Thông điệp tiếng Việt cho từng lý do (dùng ở API/UI). */
export function nicknameReasonMessage(reason: NicknameCheck['reason']): string {
  switch (reason) {
    case 'too_short': return `Bí danh cần ít nhất ${NICKNAME_MIN} ký tự.`;
    case 'too_long': return `Bí danh tối đa ${NICKNAME_MAX} ký tự.`;
    case 'bad_chars': return 'Bí danh chỉ gồm chữ, số, khoảng trắng và _ - .';
    case 'blocked': return 'Bí danh chứa từ ngữ không phù hợp. Hãy chọn tên khác.';
    default: return 'Bí danh không hợp lệ.';
  }
}
