import { loadUsage, saveUsage, incrementUsageAtomic, type UsageRecord } from './ai-usage-store';

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
