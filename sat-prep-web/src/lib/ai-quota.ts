import { loadUsage, saveUsage, type UsageRecord } from './ai-usage-store';

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

/** Hạn mức lượt gọi AI mỗi ngày theo gói. -1 = không giới hạn. */
export const DAILY_LIMITS: Record<AiTier, number> = {
  free: 5,
  premium: -1,
  ultimate: -1,
};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Lấy bản ghi usage của hôm nay (tự reset khi sang ngày mới). */
async function loadToday(userId: string): Promise<UsageRecord> {
  const rec = await loadUsage(userId);
  if (rec.date !== today()) {
    return { date: today(), count: 0, tokensIn: 0, tokensOut: 0 };
  }
  return rec;
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;       // -1 = unlimited
  remaining: number;   // Infinity khi unlimited
}

/** Kiểm tra user còn lượt gọi AI hôm nay không (chưa tính thêm). */
export async function checkQuota(userId: string, tier: AiTier = 'free'): Promise<QuotaCheck> {
  const limit = DAILY_LIMITS[tier];
  const rec = await loadToday(userId);

  if (limit < 0) {
    return { allowed: true, used: rec.count, limit, remaining: Infinity };
  }
  return {
    allowed: rec.count < limit,
    used: rec.count,
    limit,
    remaining: Math.max(0, limit - rec.count),
  };
}

/** Ghi nhận 1 lượt gọi AI đã hoàn tất (tăng count + cộng dồn token). */
export async function recordUsage(userId: string, tokensIn = 0, tokensOut = 0): Promise<void> {
  const rec = await loadToday(userId);
  rec.count += 1;
  rec.tokensIn += tokensIn;
  rec.tokensOut += tokensOut;
  await saveUsage(userId, rec);
}
