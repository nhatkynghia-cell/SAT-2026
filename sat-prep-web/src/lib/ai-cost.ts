import { loadLedger, recordCost, type CostLedger } from './cost-ledger-store';

/**
 * ============================================================================
 *  AI COST METER + BUDGET KILL-SWITCH (implementation_plan.md §9.5, task #5)
 * ============================================================================
 *  • Ước tính chi phí mỗi lời gọi AI theo bảng giá model.
 *  • Cộng dồn vào SỔ CÁI TOÀN HỆ THỐNG theo ngày (bảng Supabase dùng chung).
 *  • Kill-switch: khi chi phí ngày vượt trần → chặn gọi AI mới. Các route có
 *    Question Bank (generate-practice) degrade mềm về bank (§9.4) thay vì lỗi.
 *
 *  Model đang dùng: OpenAI gpt-4o-mini (KHÔNG phải Claude). Giá đặt thành hằng
 *  số rõ ràng — cập nhật ở đây khi nhà cung cấp đổi giá.
 *
 *  📦 SỔ CÁI (2026-07-02, task 5.1): chuyển từ file `ai_cost_global.json`
 *  (reset mỗi cold-start serverless → kill-switch mất tác dụng) sang bảng
 *  Supabase `ai_cost_ledger` (bền vững) qua `cost-ledger-store.ts`. Vì I/O giờ
 *  là async → `checkBudget`/`getCostReport` thành ASYNC. FAIL-OPEN khi bảng
 *  chưa tồn tại (xem store). `estimateCost`/`PRICING` giữ THUẦN (dùng cho test).
 * ============================================================================
 */

/** Giá USD cho mỗi 1 TRIỆU token (input / output). Nguồn: OpenAI pricing. */
export const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
};

const DEFAULT_MODEL = 'gpt-4o-mini';

/** Ngân sách AI mỗi ngày toàn hệ thống (USD). Override qua env AI_DAILY_BUDGET_USD. */
export const DAILY_BUDGET_USD = Number(process.env.AI_DAILY_BUDGET_USD ?? 5);

/** Ước tính chi phí USD cho 1 lời gọi. */
export function estimateCost(tokensIn: number, tokensOut: number, model = DEFAULT_MODEL): number {
  const p = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  return (tokensIn / 1_000_000) * p.inputPer1M + (tokensOut / 1_000_000) * p.outputPer1M;
}

export interface BudgetCheck {
  allowed: boolean;
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

/** Kiểm tra ngân sách AI ngày còn không (gọi TRƯỚC khi tốn tiền cho OpenAI). */
export async function checkBudget(): Promise<BudgetCheck> {
  const led = await loadLedger();
  const remaining = DAILY_BUDGET_USD - led.costUsd;
  return {
    allowed: remaining > 0,
    spentUsd: Number(led.costUsd.toFixed(4)),
    budgetUsd: DAILY_BUDGET_USD,
    remainingUsd: Number(Math.max(0, remaining).toFixed(4)),
  };
}

/** Ghi nhận chi phí 1 lời gọi AI vào sổ cái toàn hệ thống. */
export async function recordGlobalCost(tokensIn: number, tokensOut: number, model = DEFAULT_MODEL): Promise<void> {
  await recordCost(tokensIn, tokensOut, estimateCost(tokensIn, tokensOut, model));
}

/** Báo cáo chi phí AI hôm nay (cho admin/report endpoint). */
export async function getCostReport(): Promise<CostLedger & { budgetUsd: number; remainingUsd: number }> {
  const led = await loadLedger();
  return {
    ...led,
    costUsd: Number(led.costUsd.toFixed(4)),
    budgetUsd: DAILY_BUDGET_USD,
    remainingUsd: Number(Math.max(0, DAILY_BUDGET_USD - led.costUsd).toFixed(4)),
  };
}
