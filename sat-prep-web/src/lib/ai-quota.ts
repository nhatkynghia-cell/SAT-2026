import {
  loadUsage,
  saveUsage,
  incrementUsageAtomic,
  reserveUsageAtomic,
  refundUsageAtomic,
  addAiTokensAtomic,
  type UsageRecord,
} from './ai-usage-store';

/**
 * ============================================================================
 *  AI QUOTA & USAGE (implementation_plan.md §9.2 task #3, nền cho §9.5 task #5)
 * ============================================================================
 *  Đếm số lượt gọi AI theo user + ngày, enforce hạn mức gói freemium.
 *  Free = 5 lượt/ngày (theo plan §2.1). Khi có hệ thống subscription (Phase 2),
 *  chỉ cần map tier → DAILY_LIMITS, phần còn lại giữ nguyên.
 *
 *  Lưu trữ: bảng Supabase `user_ai_usage` (Phase 1.5) — thay file ai_usage.json.
 * ============================================================================
 */

export type AiTier = 'free' | 'premium' | 'ultimate';

/** Loại lượt gọi AI: sinh câu (gen) vs gia sư chat (chat) — 2 bucket quota riêng. */
export type AiKind = 'gen' | 'chat';

/** Hạn mức lượt gọi AI mỗi ngày theo gói + loại. -1 = không giới hạn. */
export const DAILY_LIMITS: Record<AiTier, Record<AiKind, number>> = {
  free:     { gen: 3, chat: 3 },
  premium:  { gen: -1, chat: -1 },
  ultimate: { gen: -1, chat: -1 },
};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Lấy bản ghi usage của hôm nay (tự reset khi sang ngày mới). */
async function loadToday(userId: string): Promise<UsageRecord> {
  const rec = await loadUsage(userId);
  if (rec.date !== today()) {
    return { date: today(), count: 0, genCount: 0, chatCount: 0, tokensIn: 0, tokensOut: 0 };
  }
  return rec;
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;       // -1 = unlimited
  remaining: number;   // Infinity khi unlimited
}

/** Kiểm tra user còn lượt gọi AI hôm nay không (chưa tính thêm), theo loại. */
export async function checkQuota(userId: string, tier: AiTier = 'free', kind: AiKind): Promise<QuotaCheck> {
  const limit = DAILY_LIMITS[tier][kind];
  const rec = await loadToday(userId);
  const used = kind === 'gen' ? rec.genCount : rec.chatCount;

  if (limit < 0) {
    return { allowed: true, used, limit, remaining: Infinity };
  }
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/** Ghi nhận 1 lượt gọi AI đã hoàn tất (tăng đúng bucket + cộng dồn token). */
export async function recordUsage(userId: string, kind: AiKind, tokensIn = 0, tokensOut = 0): Promise<void> {
  // Đường ATOMIC (audit 2026-07-03, ROOT C): tăng đúng bucket qua RPC (upsert x=x+1
  // + reset ngày mới ở DB) → 2 request đồng thời không ghi đè → quota/ngày chính
  // xác. FAIL-SAFE: RPC chưa có (pre-migration) → false → fallback load-modify-save.
  if (await incrementUsageAtomic(userId, kind, today(), tokensIn, tokensOut)) return;

  // ── Fallback đọc-sửa-ghi (pre-migration hoặc RPC lỗi) ──
  const rec = await loadToday(userId);
  if (kind === 'gen') rec.genCount += 1;
  else rec.chatCount += 1;
  rec.tokensIn += tokensIn;
  rec.tokensOut += tokensOut;
  await saveUsage(userId, rec);
}

/**
 * ============================================================================
 *  RESERVE-BEFORE-CALL (đóng C1 TOCTOU, backlog #8)
 * ============================================================================
 *  Vòng đời 1 lượt gọi AI có chặn chi phí NGUYÊN TỬ:
 *    1. reserveQuota()  — TRƯỚC khi gọi OpenAI. allowed=false → route trả 429/503.
 *    2. gọi OpenAI.
 *    3a. thành công → finalizeUsage(tokensIn, tokensOut)  — cộng token.
 *    3b. lỗi        → releaseUsage()                       — hoàn slot đã reserve.
 *  `reserved` cho biết reservation NGUYÊN TỬ có thực sự xảy ra (migration đã chạy)
 *  hay đang chạy đường LEGACY read-only (pre-migration) — route KHÔNG cần biết, chỉ
 *  chuyền cờ này vào finalize/release để làm đúng.
 * ============================================================================
 */

export interface ReserveOutcome extends QuotaCheck {
  /** true = đã reserve NGUYÊN TỬ (count đã +1 trong DB). false = đường legacy read-only. */
  reserved: boolean;
  /**
   * NGÀY (today() lúc reserve). Route THREAD lại vào finalize/release để refund/token
   * nhắm đúng ngày của RESERVATION, KHÔNG lệ thuộc today() lúc release. Đóng lỗ
   * over-refund qua ranh giới nửa đêm (adversarial review wf_a8d34d61): nếu release
   * dùng today() mới, request lỗi straddle-midnight sẽ trừ nhầm slot ngày MỚI của
   * request khác → user được 1 lượt lố. Dùng reserve-date → sau reset ngày, guard
   * `date=p_date` không khớp → no-op (đúng: ngày cũ đã reset, không cần hoàn).
   */
  date: string;
}

/**
 * Reserve 1 lượt AI TRƯỚC khi gọi OpenAI. Đóng TOCTOU: increment atomic có khóa dòng
 * nên N request đồng thời không cùng vượt cap.
 *   • Migration ĐÃ chạy → reserved:true, allowed theo reserve RPC.
 *   • Pre-migration (RPC null) → FALLBACK checkQuota đọc-thuần (reserved:false); route
 *     dùng finalizeUsage(reserved:false) = recordUsage cũ → 0 regression, giữ TOCTOU cũ
 *     TỚI khi migrate (đúng như trước bản vá — không tệ hơn).
 *   • RPC lỗi thật → FAIL-CLOSED allowed:false (chặn gọi AI, không đốt tiền).
 */
export async function reserveQuota(userId: string, tier: AiTier = 'free', kind: AiKind): Promise<ReserveOutcome> {
  const limit = DAILY_LIMITS[tier][kind];
  const day = today(); // chốt 1 lần → dùng cho cả reserve VÀ finalize/release (đóng cross-midnight).
  const res = await reserveUsageAtomic(userId, kind, day, limit);

  if (res === null) {
    // Pre-migration: giữ hành vi cũ (check đọc-thuần, record SAU khi gọi).
    const q = await checkQuota(userId, tier, kind);
    return { ...q, reserved: false, date: day };
  }

  if (res.used === -1) {
    // RPC lỗi thật → fail-closed.
    return { allowed: false, used: 0, limit, remaining: 0, reserved: true, date: day };
  }

  const remaining = limit < 0 ? Infinity : Math.max(0, limit - res.used);
  return { allowed: res.allowed, used: res.used, limit, remaining, reserved: true, date: day };
}

/**
 * Chốt usage sau khi gọi OpenAI THÀNH CÔNG. reserved=true → count đã +1 lúc reserve,
 * chỉ cộng token (nhắm đúng `date` của reservation). reserved=false (legacy) →
 * recordUsage cũ (tăng count + token theo today()).
 */
export async function finalizeUsage(
  userId: string,
  kind: AiKind,
  tokensIn: number,
  tokensOut: number,
  reserved: boolean,
  date: string
): Promise<void> {
  if (reserved) {
    await addAiTokensAtomic(userId, date, tokensIn, tokensOut);
  } else {
    await recordUsage(userId, kind, tokensIn, tokensOut);
  }
}

/**
 * Hoàn slot khi OpenAI LỖI. reserved=true → refund theo `date` của RESERVATION (KHÔNG
 * phải today() lúc release) → sau reset ngày, guard không khớp → no-op (đóng over-refund
 * cross-midnight). reserved=false (legacy) → no-op vì đường cũ CHƯA tăng count.
 */
export async function releaseUsage(userId: string, kind: AiKind, reserved: boolean, date: string): Promise<void> {
  if (reserved) {
    await refundUsageAtomic(userId, kind, date);
  }
}
